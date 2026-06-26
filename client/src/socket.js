import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const socket = io(SERVER_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  transports: ['websocket', 'polling'],
});

socket.on('connect_error', (err) => {
  console.error('[Socket] Connection error:', err.message);
});

socket.on('reconnect_attempt', (attempt) => {
  console.info(`[Socket] Reconnect attempt ${attempt}/5`);
});

socket.on('reconnect_failed', () => {
  console.error('[Socket] All reconnect attempts failed');
});

/**
 * Connect with a JWT access token.
 * Call this after a successful login / token refresh.
 */
export function connect(token) {
  socket.auth = { token };
  if (!socket.connected) {
    socket.connect();
  }
}

/**
 * Gracefully disconnect and clear auth credentials.
 */
export function disconnect() {
  socket.auth = {};
  socket.disconnect();
}

export default socket;
