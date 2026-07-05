import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: (cb) => cb({ token: getAccessToken() }),
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
}

export function subscribeToRepo(repositoryId: string) {
  const s = connectSocket();
  s.emit('repository:subscribe', repositoryId);
  return () => s.emit('repository:unsubscribe', repositoryId);
}

// --- AI chat streaming ---
// Server events: 'ai:chat:chunk' ({requestId, chunk}), 'ai:chat:done'
// ({requestId, message, conversation}), 'ai:chat:error' ({requestId, message}).
// Each request carries a client-generated requestId so the UI can ignore
// stray events from a previous message if the user sends another quickly.
export function sendChatMessage(repositoryId: string, message: string, requestId: string) {
  const s = connectSocket();
  s.emit('ai:chat:send', { repositoryId, message, requestId });
}
