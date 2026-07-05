const http = require('http');
const env = require('./config/env');
const logger = require('./config/logger');
const app = require('./app');
const { connectDB } = require('./config/database');
const { getRedisConnection } = require('./config/redis');
const { initSocket } = require('./config/socket');

async function main() {
  await connectDB();

  // Verify Redis is reachable at boot (BullMQ/worker rely on it in Part 2+)
  const redis = getRedisConnection();
  await new Promise((resolve) => {
    if (redis.status === 'ready') return resolve();
    redis.once('ready', resolve);
    setTimeout(resolve, 3000); // don't block boot forever if Redis is slow to connect
  });

  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.port, () => {
    logger.info(`Archon API listening on port ${env.port} [${env.nodeEnv}]`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(() => logger.info('HTTP server closed'));
    await redis.quit().catch(() => {});
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled Rejection: ${reason}`);
  });
  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
    process.exit(1);
  });
}

main().catch((err) => {
  logger.error(`Failed to start server: ${err.message}`, { stack: err.stack });
  process.exit(1);
});
