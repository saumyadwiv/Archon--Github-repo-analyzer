const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('./env');
const logger = require('./logger');
const { createRedisConnection } = require('./redis');
const { PROGRESS_CHANNEL } = require('../services/progressService');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientUrl, credentials: true },
  });

  // Authenticate socket connections using the same JWT as the REST API
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('Authentication required'));

      const payload = jwt.verify(token, env.jwt.secret);
      socket.userId = payload.sub;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  // The analysis pipeline runs in a separate `npm run worker` process, which
  // has no Socket.IO server of its own. progressService publishes analysis
  // events to this Redis channel from whichever process calls it; here in
  // the API process (the one that actually holds the `io` instance and the
  // client connections) we subscribe and re-emit into the right room. This
  // is what makes live progress work across the two-process setup.
  const subscriber = createRedisConnection();
  subscriber.subscribe(PROGRESS_CHANNEL, (err) => {
    if (err) logger.error(`Failed to subscribe to ${PROGRESS_CHANNEL}: ${err.message}`);
  });
  subscriber.on('message', (channel, raw) => {
    if (channel !== PROGRESS_CHANNEL) return;
    try {
      const { room, event, data } = JSON.parse(raw);
      io.to(room).emit(event, data);
    } catch (err) {
      logger.error(`Failed to relay socket event from Redis: ${err.message}`);
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: user=${socket.userId} socket=${socket.id}`);

    // Client joins a room per repository to receive analysis progress events.
    // Full event emission (analysis:progress, analysis:complete, etc.) is
    // implemented in Part 2 (job worker) and Part 4 (chat streaming).
    socket.on('repository:subscribe', (repositoryId) => {
      if (typeof repositoryId === 'string') {
        socket.join(`repo:${repositoryId}`);
      }
    });

    socket.on('repository:unsubscribe', (repositoryId) => {
      if (typeof repositoryId === 'string') {
        socket.leave(`repo:${repositoryId}`);
      }
    });

    // Streaming repo-chat: client sends one message with a requestId, server
    // streams the Gemini response back as incremental chunks and a final
    // "done" event carrying the persisted message. Falls back to REST
    // (POST /ai/chat) automatically on the client if the socket is down.
    socket.on('ai:chat:send', async ({ repositoryId, message, requestId } = {}) => {
      // Lazy require: aiChatService pulls in models/Gemini and isn't needed
      // by processes (e.g. the worker) that only import this socket config
      // for its types, so keep it out of the top-level require graph.
      const aiChatService = require('../services/aiChatService');
      try {
        const { conversation, assistantMessage } = await aiChatService.sendChatMessage(
          repositoryId,
          socket.userId,
          message,
          { onChunk: (chunk) => socket.emit('ai:chat:chunk', { requestId, chunk }) }
        );
        socket.emit('ai:chat:done', {
          requestId,
          message: assistantMessage,
          conversation: { _id: conversation._id, title: conversation.title, lastMessageAt: conversation.lastMessageAt },
        });
      } catch (err) {
        socket.emit('ai:chat:error', { requestId, message: err.message || 'AI chat failed' });
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: user=${socket.userId} socket=${socket.id}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO not initialized — call initSocket(httpServer) first');
  return io;
}

module.exports = { initSocket, getIO };
