const AnalysisJob = require('../models/AnalysisJob');
const { getRedisConnection } = require('../config/redis');
const logger = require('../config/logger');

const PROGRESS_CHANNEL = 'archon:socket-events';

/**
 * Updates the AnalysisJob document and publishes an `analysis:progress` event
 * for the `repo:{repositoryId}` Socket.IO room.
 *
 * Progress reporting happens from the BullMQ *worker* process (`npm run
 * worker`), which is a separate Node process from the API server that owns
 * the Socket.IO instance — so we can't call `getIO()` directly here, it would
 * only ever work when this code happens to run inside the API process.
 * Instead we publish to a Redis channel that the API process subscribes to
 * (see config/socket.js) and re-emits over Socket.IO. This works no matter
 * which process calls reportProgress/reportCompleted/reportFailed.
 */
async function reportProgress(jobId, repositoryId, { stage, progressPercent, progressMessage, extra = {} }) {
  await AnalysisJob.findByIdAndUpdate(jobId, {
    $set: {
      stage,
      progressPercent,
      progressMessage,
      status: 'active',
      ...extra,
    },
  });

  publishSocketEvent(repositoryId, 'analysis:progress', {
    jobId: jobId.toString(),
    stage,
    progressPercent,
    progressMessage,
  });
}

async function reportCompleted(jobId, repositoryId, payload = {}) {
  await AnalysisJob.findByIdAndUpdate(jobId, {
    $set: {
      status: 'completed',
      stage: 'completed',
      progressPercent: 100,
      progressMessage: 'Analysis complete',
      finishedAt: new Date(),
    },
  });

  publishSocketEvent(repositoryId, 'analysis:completed', { jobId: jobId.toString(), ...payload });
}

async function reportFailed(jobId, repositoryId, error) {
  await AnalysisJob.findByIdAndUpdate(jobId, {
    $set: {
      status: 'failed',
      stage: 'failed',
      progressMessage: error.message,
      error: { message: error.message, stack: error.stack },
      finishedAt: new Date(),
    },
  });

  publishSocketEvent(repositoryId, 'analysis:failed', {
    jobId: jobId.toString(),
    message: error.message,
  });
}

function publishSocketEvent(repositoryId, event, data) {
  try {
    const redis = getRedisConnection();
    redis.publish(PROGRESS_CHANNEL, JSON.stringify({ room: `repo:${repositoryId}`, event, data }));
  } catch (err) {
    logger.debug(`Failed to publish ${event} to Redis: ${err.message}`);
  }
}

module.exports = { reportProgress, reportCompleted, reportFailed, PROGRESS_CHANNEL };
