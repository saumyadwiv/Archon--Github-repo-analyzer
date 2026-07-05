const { Repository, AIConversation, FileNode, DependencyEdge } = require('../models');
const ApiError = require('../utils/ApiError');
const geminiService = require('./geminiService');
const aiContextService = require('./aiContextService');
const cycleService = require('./cycleService');

const MAX_HISTORY_MESSAGES = 20; // trailing messages sent as chat history to Gemini

async function getAnalyzedRepo(repositoryId, userId) {
  const repo = await Repository.findOne({ _id: repositoryId, owner: userId });
  if (!repo) throw ApiError.notFound('Repository not found');
  if (!repo.latestAnalysisJob || repo.status !== 'completed') {
    throw ApiError.badRequest('This repository has not finished analysis yet');
  }
  return repo;
}

/**
 * Generates an AI explanation for a single file using its position in the
 * dependency graph (imports/importers) plus overall repo context, and
 * persists the exchange as a `file_explain` AIConversation (one per file per
 * user, so re-explaining the same file appends to its own thread).
 */
async function explainFile(repositoryId, userId, filePath) {
  if (!filePath || !filePath.trim()) throw ApiError.badRequest('filePath is required');

  const repo = await getAnalyzedRepo(repositoryId, userId);
  const file = await FileNode.findOne({
    repository: repo._id,
    analysisJob: repo.latestAnalysisJob,
    filePath,
  });
  if (!file) throw ApiError.notFound(`File not found in the latest analysis: ${filePath}`);

  const [outgoingEdges, incomingEdges] = await Promise.all([
    DependencyEdge.find({ analysisJob: repo.latestAnalysisJob, source: file._id }).select('targetPath'),
    DependencyEdge.find({ analysisJob: repo.latestAnalysisJob, target: file._id }).select('sourcePath'),
  ]);

  const repoContext = await aiContextService.getRepoContext(repo);
  const explanation = await geminiService.explainFile({
    repoContext,
    file,
    outgoing: outgoingEdges.map((e) => e.targetPath),
    incoming: incomingEdges.map((e) => e.sourcePath),
  });

  let conversation = await AIConversation.findOne({
    repository: repo._id,
    user: userId,
    type: 'file_explain',
    title: filePath,
  });
  if (!conversation) {
    conversation = new AIConversation({
      repository: repo._id,
      user: userId,
      type: 'file_explain',
      title: filePath,
      messages: [],
    });
  }
  conversation.messages.push({ role: 'user', content: `Explain this file: ${filePath}`, contextFilePath: filePath });
  conversation.messages.push({ role: 'assistant', content: explanation, contextFilePath: filePath });
  conversation.lastMessageAt = new Date();
  await conversation.save();

  return { explanation, conversationId: conversation._id };
}

/** One ongoing repo-aware chat thread per (repository, user) — created lazily. */
async function getOrCreateChatConversation(repo, userId) {
  let conversation = await AIConversation.findOne({ repository: repo._id, user: userId, type: 'chat' });
  if (!conversation) {
    conversation = await AIConversation.create({
      repository: repo._id,
      user: userId,
      type: 'chat',
      title: `Chat — ${repo.fullName}`,
      messages: [],
    });
  }
  return conversation;
}

async function getChatHistory(repositoryId, userId) {
  const repo = await Repository.findOne({ _id: repositoryId, owner: userId });
  if (!repo) throw ApiError.notFound('Repository not found');
  return getOrCreateChatConversation(repo, userId);
}

async function resetChat(repositoryId, userId) {
  const repo = await Repository.findOne({ _id: repositoryId, owner: userId });
  if (!repo) throw ApiError.notFound('Repository not found');
  await AIConversation.findOneAndDelete({ repository: repo._id, user: userId, type: 'chat' });
}

/**
 * Sends a chat message and returns the assistant's reply, persisting both
 * turns. Pass `onChunk` to receive incremental text as it streams in (used
 * by the Socket.IO handler); omit it for a plain non-streaming REST response.
 */
async function sendChatMessage(repositoryId, userId, message, { onChunk } = {}) {
  if (!message || !message.trim()) throw ApiError.badRequest('message is required');

  const repo = await getAnalyzedRepo(repositoryId, userId);
  const conversation = await getOrCreateChatConversation(repo, userId);

  const history = conversation.messages
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content }));

  const trimmedMessage = message.trim();
  const repoContext = await aiContextService.getRepoContext(repo);

  const answer = onChunk
    ? await geminiService.streamChat({ repoContext, history, question: trimmedMessage }, onChunk)
    : await geminiService.chat({ repoContext, history, question: trimmedMessage });

  conversation.messages.push({ role: 'user', content: trimmedMessage });
  const assistantMessage = { role: 'assistant', content: answer, createdAt: new Date() };
  conversation.messages.push(assistantMessage);
  conversation.lastMessageAt = new Date();
  if (conversation.messages.length <= 2) {
    conversation.title = trimmedMessage.slice(0, 60);
  }
  await conversation.save();

  return { conversation, assistantMessage };
}

/**
 * Generates a full README.md for the repository from its analysis context
 * and persists it as a `readme_generate` AIConversation (one thread per
 * repo per user — each generation appends a new assistant message so past
 * versions remain in history).
 */
async function generateReadme(repositoryId, userId) {
  const repo = await getAnalyzedRepo(repositoryId, userId);
  const repoContext = await aiContextService.getRepoContext(repo);
  const readme = await geminiService.generateReadme({ repoContext, repository: repo });

  let conversation = await AIConversation.findOne({
    repository: repo._id,
    user: userId,
    type: 'readme_generate',
  });
  if (!conversation) {
    conversation = new AIConversation({
      repository: repo._id,
      user: userId,
      type: 'readme_generate',
      title: `README — ${repo.fullName}`,
      messages: [],
    });
  }
  conversation.messages.push({ role: 'user', content: 'Generate a README for this repository.' });
  conversation.messages.push({ role: 'assistant', content: readme });
  conversation.lastMessageAt = new Date();
  await conversation.save();

  return { readme, generatedAt: conversation.lastMessageAt };
}

/**
 * Revises the repository's most recently generated README based on a
 * free-text instruction (e.g. "make the tech stack section shorter"),
 * appending the turn to the same `readme_generate` conversation so the
 * full edit history stays in one thread.
 */
async function refineReadme(repositoryId, userId, instruction) {
  const trimmed = (instruction || '').trim();
  if (!trimmed) throw ApiError.badRequest('instruction is required');

  const repo = await getAnalyzedRepo(repositoryId, userId);

  const conversation = await AIConversation.findOne({
    repository: repo._id,
    user: userId,
    type: 'readme_generate',
  });
  const lastReadme = [...(conversation?.messages || [])].reverse().find((m) => m.role === 'assistant');
  if (!conversation || !lastReadme) {
    throw ApiError.badRequest('Generate a README before requesting changes to it');
  }

  const repoContext = await aiContextService.getRepoContext(repo);
  const readme = await geminiService.refineReadme({
    repoContext,
    repository: repo,
    currentReadme: lastReadme.content,
    instruction: trimmed,
  });

  conversation.messages.push({ role: 'user', content: trimmed });
  conversation.messages.push({ role: 'assistant', content: readme });
  conversation.lastMessageAt = new Date();
  await conversation.save();

  return { readme, generatedAt: conversation.lastMessageAt };
}

/**
 * Generates an AI explanation for one detected circular dependency: why it
 * likely exists, the best edge to break, and a concrete fix. Persists the
 * exchange as a `cycle_explain` AIConversation keyed by cycleId (one thread
 * per cycle per user, so re-explaining the same cycle appends to its own
 * thread rather than spawning duplicates).
 */
async function explainCycle(repositoryId, userId, cycleId) {
  if (!cycleId || !cycleId.trim()) throw ApiError.badRequest('cycleId is required');

  const repo = await getAnalyzedRepo(repositoryId, userId);
  const chain = await cycleService.getCycleById(repo, cycleId);

  const repoContext = await aiContextService.getRepoContext(repo);
  const explanation = await geminiService.explainCycle({ repoContext, chain });

  let conversation = await AIConversation.findOne({
    repository: repo._id,
    user: userId,
    type: 'cycle_explain',
    title: cycleId,
  });
  if (!conversation) {
    conversation = new AIConversation({
      repository: repo._id,
      user: userId,
      type: 'cycle_explain',
      title: cycleId,
      messages: [],
    });
  }
  conversation.messages.push({
    role: 'user',
    content: `Explain this circular dependency: ${chain.files.join(' -> ')}`,
  });
  conversation.messages.push({ role: 'assistant', content: explanation });
  conversation.lastMessageAt = new Date();
  await conversation.save();

  return { explanation, conversationId: conversation._id };
}

module.exports = {
  explainFile,
  getChatHistory,
  resetChat,
  sendChatMessage,
  generateReadme,
  refineReadme,
  explainCycle,
};
