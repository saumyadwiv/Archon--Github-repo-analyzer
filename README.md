# Archon — Codebase Intelligence Platform

Full-stack app: paste a GitHub repo URL → Archon clones it, parses every JS/TS/Python
file via AST, builds a dependency graph, detects circular dependencies, scores
cyclomatic complexity, generates a 0–100 health score, and lets you chat with
Gemini about the architecture.

**Stack:** Node.js/Express/MongoDB/Redis/BullMQ (backend) · Next.js/Tailwind/shadcn/React Flow (frontend) · Gemini (AI) · @babel/parser+traverse (analysis)

## Build plan (4 parts, delivered as separate zips)

- [x] **Part 1 — Backend foundation**
  - Express app skeleton, config (env/logger/db/redis/passport/socket)
  - All 7 MongoDB models: User, Repository, AnalysisJob, FileNode, DependencyEdge, MetricsSnapshot, AIConversation
  - Email/password auth + Google OAuth (Passport, JWT access+refresh tokens, cookie handling)
  - Middleware: auth guard, centralized error handler, validation, rate limiting
  - BullMQ queue + worker process stubs, Socket.IO server with JWT-authenticated connections and repo subscribe/unsubscribe rooms
- [x] **Part 2 — Analysis engine**
  - `gitService.js` — shallow clone via simple-git, size-limit guard, cleanup
  - `fileDiscoveryService.js` — walks the repo for .js/.jsx/.ts/.tsx/.mjs/.cjs/.py, ignores node_modules/dist/venv/etc., caps at 3000 files
  - `astParserService.js` + `complexityCalculator.js` — @babel/parser+traverse extraction of imports (ESM + CJS require), exports (named/default/module.exports), functions, and per-function McCabe cyclomatic complexity
  - `pythonParserService.js` + `scripts/parse_python_ast.py` — Python's stdlib `ast` module (invoked as a subprocess) extracts imports/exports/functions/complexity; requires `python3` on PATH at runtime
  - `dependencyGraphService.js` — resolves relative import specifiers (JS + Python, including `.`/`..` relative imports and index/`__init__.py` files) into DependencyEdge records
  - `cycleDetectionService.js` — DFS with white/gray/black coloring, detects circular dependencies across disconnected subgraphs, dedupes cycle signatures
  - `healthScoreService.js` — weighted 0-100 score (complexity 40pts / cycles 30pts / file size 15pts / parse-error structure 15pts) + A-F grade
  - `progressService.js` — updates AnalysisJob + emits Socket.IO `analysis:progress/completed/failed` to the `repo:{id}` room
  - `analysisService.js` — orchestrates the full pipeline end-to-end
  - `jobs/worker.js` — real BullMQ `Worker` (run via `npm run worker`), `jobs/queues.js` — `enqueueAnalysis()` helper
  - Repository routes now do real work: `POST /import` and `POST /:id/analyze` enqueue analysis; `GET /:id/graph` returns nodes+edges; `GET /:id/metrics` returns the latest MetricsSnapshot; `GET /jobs/:jobId` polls job status
  - Unit-verified in isolation (cycle detection, import resolution, health scoring all tested with sample data); AST parser is syntax-checked but needs `npm install` to exercise against real Babel
- [x] **Part 3 — Frontend** *(this zip)*
  - Next.js 14 App Router + TypeScript, Tailwind with a custom design system (graphite canvas, indigo-violet brand accent, semantic red/amber/emerald for cycles & health grades), JetBrains Mono for data/code, Inter for UI
  - shadcn/ui-style primitives built from Radix: button, input, label, card, badge, progress, tabs, dialog, separator, skeleton, toast
  - Auth pages: `/login`, `/register` (email/password + "Continue with Google"), `/auth/callback` (handles the OAuth redirect token)
  - `lib/api.ts` — typed Axios client matching every Part 1/2 endpoint exactly, with automatic refresh-token retry on 401
  - `lib/socket.ts` + `AnalysisProgress.tsx` — Socket.IO client subscribed to `repo:{id}`, live stage-by-stage progress bar with a 4s polling fallback
  - `/dashboard` — paste-a-URL import flow + grid of previously analyzed repos with health grade, status, and cycle count badges
  - `/dashboard/[repoId]/graph` — **React Flow** dependency graph (dagre auto-layout), red pulsing edges for circular dependencies, click-to-inspect file panel with an "Explain with AI" button wired to `/ai/explain` (endpoint lands in Part 4)
  - `/dashboard/[repoId]/metrics` — health score gauge with score breakdown, complexity bar chart (recharts), sortable/filterable file breakdown table
  - Landing page hero: an ambient animated dependency-graph SVG as the page backdrop
  - Type-checked with `tsc` against real syntax rules (only expected "missing node_modules" resolution errors remain); zero genuine type errors
- [x] **Part 4 — AI + realtime polish** *(this zip)*
  - `services/geminiService.js` — thin wrapper around `@google/generative-ai`; system-instructed prompts for both "explain this file" and repo-aware chat, plus a streaming variant (`sendMessageStream`) used by the Socket.IO chat path
  - `services/aiContextService.js` — renders a compact, token-budget-aware plain-text summary of a repo's latest analysis (health score/breakdown, cycles, entry points, per-file complexity) for Gemini grounding; cached per `analysisJob` id for 10 minutes so a chat session doesn't refetch/rebuild it on every turn
  - `services/aiChatService.js` — shared business logic (ownership checks, AIConversation persistence, history trimming) used by both the REST controller and the socket handler, so REST and streaming paths can never drift apart
  - `POST /ai/explain` — real implementation of the endpoint `FileExplainDialog.tsx` was already calling; looks up the file's imports/importers from `DependencyEdge`, asks Gemini to explain it, persists the exchange as a `file_explain` AIConversation (one thread per file)
  - `POST /ai/chat`, `GET /ai/chat/:repositoryId`, `DELETE /ai/chat/:repositoryId` — non-streaming chat fallback + history fetch + reset, backed by one ongoing `chat`-type AIConversation per (repository, user)
  - Socket.IO `ai:chat:send` → streamed `ai:chat:chunk` events → final `ai:chat:done` (or `ai:chat:error`) — same persistence path as the REST endpoint, just streamed token-by-token
  - `/dashboard/[repoId]/chat` — new repo-aware chat page: markdown-rendered assistant replies (`react-markdown`, already a dependency), streaming "typing" bubble, example-prompt empty state, REST fallback if the socket isn't connected, reset button. "Chat" nav links added to the graph and metrics page headers
  - `docker-compose.yml` — Mongo + Redis for local dev (app processes still run on the host via `npm run dev` for fast reload)
  - `aiLimiter` rate limit (40 req / 15 min) on all `/ai` routes, separate from the general API limiter, since Gemini calls are the most expensive requests in the app

## Build plan (4 parts, delivered as separate zips) — complete

All four parts are done. See below for the full local setup.

## Quick start (full stack)

```bash
# 0. Infra — Mongo + Redis via Docker (or point MONGO_URI/REDIS_HOST at your own instances)
docker compose up -d

# Terminal 1 — API
cd backend && cp .env.example .env && npm install && npm run dev

# Terminal 2 — analysis worker
cd backend && npm run worker

# Terminal 3 — frontend
cd frontend && cp .env.local.example .env.local && npm install && npm run dev
```

Open http://localhost:3000, register an account, paste a GitHub URL (e.g.
`https://github.com/expressjs/express`), and watch the live progress bar walk
through cloning → parsing → graph building → cycle detection → scoring, then
land on the dependency graph.

To use the AI features (file explanations + repo chat), set `GEMINI_API_KEY`
in `backend/.env` — get a key from [Google AI Studio](https://aistudio.google.com/app/apikey).
Without it, `/ai/explain` and `/ai/chat` respond with a 503 explaining that
the assistant isn't configured; everything else (import, analysis, graph,
metrics) works independently of Gemini.

Requires: Docker (for Mongo/Redis, or run them yourself) and **`python3` on
PATH** (backend, for `.py` parsing).

## Repo layout

```
archon/
  docker-compose.yml    Mongo + Redis for local dev
  backend/
    src/
      config/       env, logger, database, redis, passport, socket
      models/        User, Repository, AnalysisJob, FileNode, DependencyEdge, MetricsSnapshot, AIConversation
      controllers/    authController, repositoryController, aiController
      routes/         authRoutes, repositoryRoutes, aiRoutes, healthRoutes, index
      middleware/     auth, errorHandler, validate, rateLimiter
      services/       authService, gitService, fileDiscoveryService,
                       astParserService, complexityCalculator, pythonParserService,
                       dependencyGraphService, cycleDetectionService,
                       healthScoreService, progressService, analysisService,
                       geminiService, aiContextService, aiChatService
      utils/          ApiError, asyncHandler, token
      jobs/           queues.js (enqueueAnalysis), worker.js (real BullMQ Worker)
      app.js, server.js
    scripts/          parse_python_ast.py
    package.json, .env.example, .gitignore
  frontend/
    app/
      page.tsx                            landing page (animated graph hero + CTA)
      login/page.tsx, register/page.tsx   auth forms + Google OAuth button
      auth/callback/page.tsx              OAuth redirect handler
      dashboard/page.tsx                  import form + repo grid
      dashboard/[repoId]/page.tsx         live analysis progress
      dashboard/[repoId]/graph/page.tsx   React Flow dependency graph
      dashboard/[repoId]/metrics/page.tsx health score + charts + file table
      dashboard/[repoId]/chat/page.tsx    repo-aware Gemini chat (streaming)
      layout.tsx, globals.css
    components/
      ui/        button, input, label, card, badge, progress, tabs, dialog, separator, skeleton, toast
      layout/    Navbar, RequireAuth
      dashboard/ GraphBackdrop, ImportRepoForm, RepoCard, AnalysisProgress
      graph/     FileGraphNode, graphLayout (dagre), DependencyGraph, FileExplainDialog
      metrics/   HealthScoreGauge, ComplexityChart, FileBreakdownTable
      chat/      ChatBubble, ChatComposer, ChatEmptyState
    lib/         api.ts, socket.ts, auth-context.tsx, types.ts, utils.ts
    package.json, tailwind.config.js, tsconfig.json, .env.local.example
```

## AI endpoints (Part 4)

| Method | Route                        | Purpose                                                              |
|--------|-------------------------------|-----------------------------------------------------------------------|
| POST   | `/api/ai/explain`             | Explain one file using its graph position + repo context             |
| POST   | `/api/ai/chat`                | Send a chat message (non-streaming); returns the assistant's reply   |
| GET    | `/api/ai/chat/:repositoryId`  | Fetch (or lazily create) the ongoing chat thread for a repo          |
| DELETE | `/api/ai/chat/:repositoryId`  | Clear the chat thread                                                 |

Socket.IO (same JWT-authenticated connection as analysis progress):

| Event (client → server) | Event (server → client)                          |
|--------------------------|---------------------------------------------------|
| `ai:chat:send`            | `ai:chat:chunk` (streamed text) → `ai:chat:done` (persisted message), or `ai:chat:error` |

All AI routes/events require the repository's latest analysis to be `completed` and are subject to a 40-requests-per-15-minutes rate limit.
