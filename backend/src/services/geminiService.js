const { GoogleGenerativeAI } = require('@google/generative-ai');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

let client = null;

function getClient() {
  if (!env.gemini.apiKey) return null;
  if (!client) client = new GoogleGenerativeAI(env.gemini.apiKey);
  return client;
}

function assertConfigured() {
  const c = getClient();
  if (!c) {
    throw ApiError.serviceUnavailable(
      'The AI assistant is not configured on this server. Set GEMINI_API_KEY and restart the API.'
    );
  }
  return c;
}

const EXPLAIN_SYSTEM_INSTRUCTION = `You are Archon's AI code assistant. Archon has already statically analyzed a
repository (AST parsing, dependency graph, cyclomatic complexity, circular dependency detection). You will be given
facts about ONE file from that analysis — its imports, importers, complexity, and role in the graph — plus overall
repository context for grounding.

Write a concise, developer-facing explanation of what this file most likely does and why it matters architecturally.
Cover, briefly: (1) its probable responsibility based on its path/name/exports, (2) how it fits into the dependency
graph (what it depends on, what depends on it), (3) any complexity or circular-dependency concerns worth flagging.
Do not invent function-level behavior you can't infer from the given facts — reason from structure, naming, and
metrics. Keep it to 3-5 short paragraphs, no headers, no markdown bullet spam. Plain prose.`;

const CHAT_SYSTEM_INSTRUCTION = `You are Archon's AI architecture assistant. You help a developer understand a
codebase using facts from Archon's static analysis: file listing, per-file complexity, circular dependencies,
entry points, and an overall health score. This context is provided as the first message of the conversation.

Answer questions about the codebase's architecture, complexity hotspots, circular dependencies, and structure using
that context. If asked something the provided context can't answer (e.g. exact runtime behavior, business logic
inside a function body Archon didn't extract), say so plainly rather than guessing. Be direct and concise. Use
markdown formatting (lists, code spans for file paths) where it aids readability, but don't pad with filler.`;

function getModel(systemInstruction) {
  const c = assertConfigured();
  return c.getGenerativeModel({ model: env.gemini.model, systemInstruction });
}

function toGeminiHistory(messages) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

function contextPrimingTurns(repoContext) {
  return [
    {
      role: 'user',
      parts: [{ text: `Here is the static analysis context for this repository:\n\n${repoContext || '(no analysis context available)'}` }],
    },
    {
      role: 'model',
      parts: [{ text: 'Understood — I have the repository structure, complexity, and dependency data. Ask away.' }],
    },
  ];
}

async function explainFile({ repoContext, file, incoming, outgoing }) {
  const model = getModel(EXPLAIN_SYSTEM_INSTRUCTION);

  const prompt = `Repository context:
${repoContext || '(no analysis context available)'}

== Target file ==
Path: ${file.filePath}
Language: ${file.language}
Lines of code: ${file.linesOfCode}
Average function complexity: ${file.averageComplexity}
Max function complexity: ${file.maxComplexity}
Part of a circular dependency: ${file.inCycle ? 'yes' : 'no'}
Likely entry point: ${file.isEntryPoint ? 'yes' : 'no'}
Functions: ${(file.functions || []).map((f) => `${f.name}(complexity ${f.cyclomaticComplexity})`).join(', ') || 'none extracted'}
Imports (files this file depends on): ${outgoing.length ? outgoing.join(', ') : 'none within the repo'}
Imported by (files that depend on this one): ${incoming.length ? incoming.join(', ') : 'none within the repo'}

Explain this file.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    logger.error(`[geminiService] explainFile failed: ${err.message}`);
    throw ApiError.badGateway('The AI assistant failed to generate an explanation. Please try again.');
  }
}

async function chat({ repoContext, history, question }) {
  const model = getModel(CHAT_SYSTEM_INSTRUCTION);
  const chatSession = model.startChat({
    history: [...contextPrimingTurns(repoContext), ...toGeminiHistory(history)],
  });

  try {
    const result = await chatSession.sendMessage(question);
    return result.response.text();
  } catch (err) {
    logger.error(`[geminiService] chat failed: ${err.message}`);
    throw ApiError.badGateway('The AI assistant failed to respond. Please try again.');
  }
}

/**
 * Streams a chat response, invoking onChunk(text) for each incremental piece.
 * Returns the full concatenated response once the stream completes.
 */
async function streamChat({ repoContext, history, question }, onChunk) {
  const model = getModel(CHAT_SYSTEM_INSTRUCTION);
  const chatSession = model.startChat({
    history: [...contextPrimingTurns(repoContext), ...toGeminiHistory(history)],
  });

  let full = '';
  try {
    const result = await chatSession.sendMessageStream(question);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        full += text;
        onChunk(text);
      }
    }
    return full;
  } catch (err) {
    logger.error(`[geminiService] streamChat failed: ${err.message}`);
    // If we already streamed partial content, surface what we have rather than
    // discarding it — a partial answer plus an error note beats silence.
    if (full) {
      onChunk('\n\n_[The connection to the AI assistant was interrupted before it finished responding.]_');
      return full;
    }
    throw ApiError.badGateway('The AI assistant failed to respond. Please try again.');
  }
}

const CYCLE_EXPLAIN_SYSTEM_INSTRUCTION = `You are Archon's AI architecture assistant. Archon has detected a circular
dependency: a closed loop of imports where file A imports file B (which imports file C, and so on) until the chain
eventually imports back into A. You will be given the ordered chain of files in the loop, the specific imported
names crossing each edge, and per-file facts (lines of code, complexity) from Archon's static analysis.

Write a concise, developer-facing explanation with three parts, in plain prose (short paragraphs, no headers, no
markdown bullet spam): (1) why this cycle most likely exists architecturally — reason from the actual file paths,
names, and what's imported across each edge, not generic cycle theory; (2) which single edge in the chain is the
best candidate to break, naming its source and target file paths explicitly, and why that one specifically (e.g.
fewest imported names crossing it, the more "leaf-like" or lower-complexity file, or the direction that best matches
the apparent layering); (3) a concrete, actionable fix that references the real file paths involved — invert the
import direction, extract a shared module, use a lazy/dynamic import, or restructure the interface — not generic
advice like "avoid circular dependencies." Keep it to 3-5 short paragraphs.`;

async function explainCycle({ repoContext, chain }) {
  const model = getModel(CYCLE_EXPLAIN_SYSTEM_INSTRUCTION);

  const chainDescription = chain.edges
    .map(
      (e, i) =>
        `${i + 1}. ${e.sourcePath} --imports--> ${e.targetPath} (imported names: ${
          e.importedNames.length ? e.importedNames.join(', ') : 'none captured'
        })`
    )
    .join('\n');

  const fileFacts = chain.fileFacts
    .map(
      (f) =>
        `- ${f.filePath}: ${f.linesOfCode ?? '?'} LOC, avg complexity ${f.averageComplexity ?? '?'}, max complexity ${
          f.maxComplexity ?? '?'
        }`
    )
    .join('\n');

  const prompt = `Repository context:
${repoContext || '(no analysis context available)'}

== Circular dependency chain (${chain.cycleId}) ==
${chain.files.join(' -> ')}

Edges in the loop, in order:
${chainDescription}

Per-file facts:
${fileFacts}

Explain this cycle.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    logger.error(`[geminiService] explainCycle failed: ${err.message}`);
    throw ApiError.badGateway('The AI assistant failed to explain this cycle. Please try again.');
  }
}

const README_SYSTEM_INSTRUCTION = `You are Archon's AI assistant. You write professional, well-structured README.md files for
software repositories using facts from Archon's static analysis (file listing, languages, entry points, dependency
structure, health score) — you do NOT have the actual source code or business context beyond what's given.

Write real, complete markdown (not a description of what a README should contain). Include, in order, only the
sections that make sense given the available facts: a title (repo name), a one-line description synthesized from
the repo name/path structure/languages if no description was given, a Tech Stack section (from the language
breakdown and any recognizable frameworks implied by file paths), a Project Structure section (a short directory
overview, not an exhaustive file dump), a Getting Started / Installation section, and a note on Architecture or
Health if the analysis found anything notable (circular dependencies, complexity hotspots) worth flagging to
contributors.

Where you cannot know something for certain (exact install/run commands, license, contribution guidelines), write a
reasonable best guess based on the detected language/ecosystem and mark it clearly with an inline HTML comment like
"<!-- TODO: verify this command -->" rather than inventing specifics as fact. Do not pad with generic filler
paragraphs. Output only the markdown document, no commentary before or after it, no surrounding code fences.`;

async function generateReadme({ repoContext, repository }) {
  const model = getModel(README_SYSTEM_INSTRUCTION);

  const prompt = `Repository: ${repository.fullName}
GitHub URL: ${repository.githubUrl}
${repository.description ? `Existing description: ${repository.description}\n` : ''}
Static analysis context:
${repoContext || '(no analysis context available)'}

Write a complete README.md for this repository.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    logger.error(`[geminiService] generateReadme failed: ${err.message}`);
    throw ApiError.badGateway('The AI assistant failed to generate a README. Please try again.');
  }
}

const REFINE_README_SYSTEM_INSTRUCTION = `You are Archon's AI assistant, revising an existing README.md for a developer based on one specific instruction
they just gave (e.g. "make the tech stack section shorter", "add a badges row", "remove the architecture section",
"use a more casual tone"). You do NOT have the actual source code or business context beyond Archon's static
analysis context you were given when the README was first drafted.

Apply the requested change precisely and re-output the COMPLETE updated README.md — not a diff, not just the
changed section. Keep everything the instruction doesn't ask you to touch as close to the original as possible;
don't rewrite unrelated sections, don't reorder sections that weren't mentioned, don't "improve" wording nobody
asked about. If the instruction is ambiguous or asks for something Archon's analysis has no basis for (e.g. a
specific license or exact contribution workflow), make a reasonable choice and mark it with an inline HTML comment
like "<!-- TODO: verify this -->" rather than inventing specifics as fact. Output only the markdown document, no
commentary before or after it, no surrounding code fences.`;

async function refineReadme({ repoContext, repository, currentReadme, instruction }) {
  const model = getModel(REFINE_README_SYSTEM_INSTRUCTION);

  const prompt = `Repository: ${repository.fullName}
GitHub URL: ${repository.githubUrl}

Static analysis context:
${repoContext || '(no analysis context available)'}

== Current README.md ==
${currentReadme}

== Requested change ==
${instruction}

Output the complete, updated README.md.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    logger.error(`[geminiService] refineReadme failed: ${err.message}`);
    throw ApiError.badGateway('The AI assistant failed to update the README. Please try again.');
  }
}

module.exports = {
  explainFile,
  explainCycle,
  chat,
  streamChat,
  generateReadme,
  refineReadme,
  isConfigured: () => !!getClient(),
};
