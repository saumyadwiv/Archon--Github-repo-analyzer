const { Queue } = require('bullmq');
const { createRedisConnection } = require('../config/redis');
const { AnalysisJob, Repository } = require('../models');

// Dedicated connection for BullMQ (separate from general-purpose Redis client)
const connection = createRedisConnection();

const analysisQueue = new Queue('repo-analysis', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600 }, // keep completed jobs 1hr for debugging
    removeOnFail: { age: 86400 },
  },
});

/**
 * Creates an AnalysisJob record and enqueues the corresponding BullMQ job.
 * Returns the created AnalysisJob document.
 */
async function enqueueAnalysis(repositoryId, userId) {
  const analysisJob = await AnalysisJob.create({
    repository: repositoryId,
    user: userId,
    status: 'queued',
    stage: 'queued',
  });

  const bullJob = await analysisQueue.add(
    'analyze-repository',
    { analysisJobId: analysisJob._id.toString() },
    { jobId: analysisJob._id.toString() }
  );

  analysisJob.bullJobId = bullJob.id;
  await analysisJob.save();

  // Set immediately (not just on completion) so clients polling
  // GET /repositories/jobs/:jobId have something to poll from the moment
  // the job is queued, rather than only once it finishes.
  await Repository.findByIdAndUpdate(repositoryId, {
    $set: { status: 'pending', latestAnalysisJob: analysisJob._id },
  });

  return analysisJob;
}

module.exports = { analysisQueue, connection, enqueueAnalysis };
