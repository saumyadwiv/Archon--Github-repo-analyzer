/**
 * Archon Analysis Worker
 * ----------------------
 * Consumes jobs from the "repo-analysis" BullMQ queue and runs the full
 * pipeline: clone -> discover files -> parse AST -> build dependency graph
 * -> detect cycles -> compute complexity -> score health -> persist.
 *
 * Normally run as its own process (`npm run worker`) alongside the API
 * server. Platforms whose free tier only offers one process type (e.g.
 * Render's free plan has no Background Worker option) can instead set
 * RUN_WORKER_INLINE=true and let server.js call startWorker() directly —
 * see the require.main check at the bottom of this file.
 */
const { Worker } = require('bullmq');
const { createRedisConnection } = require('../config/redis');
const logger = require('../config/logger');
const { runAnalysisJob } = require('../services/analysisService');

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '2', 10);

function startWorker() {
  const connection = createRedisConnection();

  const worker = new Worker(
    'repo-analysis',
    async (job) => {
      const { analysisJobId } = job.data;
      logger.info(`[worker] Starting analysis job ${analysisJobId} (bull job ${job.id})`);
      return runAnalysisJob(analysisJobId);
    },
    { connection, concurrency: CONCURRENCY }
  );

  worker.on('completed', (job) => {
    logger.info(`[worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`[worker] Job ${job?.id} failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.error(`[worker] Worker error: ${err.message}`);
  });

  logger.info(`Archon analysis worker started (concurrency=${CONCURRENCY})`);
  return worker;
}

// Standalone mode — `node src/jobs/worker.js` / `npm run worker`. This is
// what runs on a real (paid) Background Worker service, or locally in dev.
if (require.main === module) {
  const { connectDB } = require('../config/database');

  const main = async () => {
    await connectDB();
    const worker = startWorker();

    const shutdown = async (signal) => {
      logger.info(`[worker] ${signal} received, closing gracefully...`);
      await worker.close();
      process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  };

  main().catch((err) => {
    logger.error(`Worker failed to start: ${err.message}`, { stack: err.stack });
    process.exit(1);
  });
}

module.exports = { startWorker };
