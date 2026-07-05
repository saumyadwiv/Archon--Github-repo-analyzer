const asyncHandler = require('../utils/asyncHandler');
const aiChatService = require('../services/aiChatService');

// POST /ai/explain — used by FileExplainDialog's "Explain this file with AI" button.
const explainFile = asyncHandler(async (req, res) => {
  const { repositoryId, filePath } = req.body;
  const { explanation } = await aiChatService.explainFile(repositoryId, req.user._id, filePath);
  res.json({ success: true, data: { explanation } });
});

// POST /ai/explain-cycle — used by the Cycles dialog's "Explain this cycle" button.
const explainCycle = asyncHandler(async (req, res) => {
  const { repositoryId, cycleId } = req.body;
  const { explanation } = await aiChatService.explainCycle(repositoryId, req.user._id, cycleId);
  res.json({ success: true, data: { explanation } });
});

// POST /ai/chat — non-streaming fallback for the repo chat page (primary path is Socket.IO).
const chat = asyncHandler(async (req, res) => {
  const { repositoryId, message } = req.body;
  const { conversation, assistantMessage } = await aiChatService.sendChatMessage(repositoryId, req.user._id, message);
  res.json({
    success: true,
    data: {
      message: assistantMessage,
      conversation: { _id: conversation._id, title: conversation.title, lastMessageAt: conversation.lastMessageAt },
    },
  });
});

// GET /ai/chat/:repositoryId — fetch (or lazily create) the ongoing chat thread for this repo.
const getChatHistory = asyncHandler(async (req, res) => {
  const conversation = await aiChatService.getChatHistory(req.params.repositoryId, req.user._id);
  res.json({ success: true, data: { conversation } });
});

// DELETE /ai/chat/:repositoryId — clear the thread and start fresh.
const resetChat = asyncHandler(async (req, res) => {
  await aiChatService.resetChat(req.params.repositoryId, req.user._id);
  res.json({ success: true, message: 'Conversation reset' });
});

// POST /ai/readme — generates a full README.md from the repo's analysis context.
const generateReadme = asyncHandler(async (req, res) => {
  const { repositoryId } = req.body;
  const { readme, generatedAt } = await aiChatService.generateReadme(repositoryId, req.user._id);
  res.json({ success: true, data: { readme, generatedAt } });
});

// POST /ai/readme/refine — revises the most recently generated README per a free-text instruction.
const refineReadme = asyncHandler(async (req, res) => {
  const { repositoryId, instruction } = req.body;
  const { readme, generatedAt } = await aiChatService.refineReadme(repositoryId, req.user._id, instruction);
  res.json({ success: true, data: { readme, generatedAt } });
});

module.exports = { explainFile, explainCycle, chat, getChatHistory, resetChat, generateReadme, refineReadme };
