const IORedis = require('ioredis');
const env = require('./env');
const logger = require('./logger');

// BullMQ requires maxRetriesPerRequest: null on the connection it manages.
function createRedisConnection(opts = {}) {
  const connection = new IORedis({
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    ...opts,
  });

  connection.on('connect', () => logger.info('Redis connected'));
  connection.on('error', (err) => logger.error(`Redis error: ${err.message}`));

  return connection;
}

// Singleton general-purpose client (pub/sub, caching, socket.io adapter if needed)
let sharedConnection = null;
function getRedisConnection() {
  if (!sharedConnection) {
    sharedConnection = createRedisConnection();
  }
  return sharedConnection;
}

module.exports = { createRedisConnection, getRedisConnection };
