/**
 * Archon Analysis Worker
 * ----------------------
 * Consumes jobs from the "repo-analysis" BullMQ queue and runs the full
 * pipeline: clone -> discover files -> parse AST -> build dependency graph
 * -> detect cycles -> compute complexity -> score health -> persist.
 *
 * Run as a separate process from the API server: `npm run worker`
 */
const { Worker } = require('bullmq');
const { connectDB } = require('../config/database');
const { createRedisConnection } = require('../config/redis');
const logger = require('../config/logger');
const { runAnalysisJob } = require('../services/analysisService');

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '2', 10);

async function main() {
  await connectDB();
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

  const shutdown = async (signal) => {
    logger.info(`[worker] ${signal} received, closing gracefully...`);
    await worker.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error(`Worker failed to start: ${err.message}`, { stack: err.stack });
  process.exit(1);
});
