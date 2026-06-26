const rateLimit = require('express-rate-limit');
const { get, setEx } = require('../config/redis');

// ── Express middlewares ────────────────────────────────────────────────────

/**
 * Auth limiter: 5 attempts / 15 min per IP.
 * Apply to POST /api/auth/login and POST /api/auth/register.
 *
 *   const { authLimiter } = require('./middlewares/rateLimiter');
 *   router.post('/login', authLimiter, loginController);
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    error: 'Terlalu banyak percobaan. Silakan coba kembali dalam 15 menit.',
  },
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  },
});

/**
 * General API limiter: 100 req / min per authenticated user (falls back to IP).
 * Apply to specific high-traffic routes, or as a secondary guard on /api/*.
 *
 *   const { apiLimiter } = require('./middlewares/rateLimiter');
 *   router.post('/:roomId/notes', auth, apiLimiter, createNote);
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.ip,
  message: {
    error: 'Terlalu banyak permintaan. Silakan coba kembali dalam 1 menit.',
  },
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  },
});

// ── Socket event rate limiter ──────────────────────────────────────────────

const SOCKET_EVENT_LIMIT = 100;   // max events per window
const SOCKET_WINDOW_SECS = 60;    // window size in seconds

/**
 * Check whether a socket connection has exceeded its per-minute event quota.
 * Uses Redis as the backing store so the limit is process-agnostic.
 *
 * Returns true  → request is within limit, proceed normally.
 * Returns false → limit exceeded; the socket has been emitted 'rateLimitExceeded'
 *                 and disconnected — the caller should discard the event immediately.
 *
 * Usage inside socket.js connection handler:
 *
 *   const { checkSocketRate } = require('../middlewares/rateLimiter');
 *   socket.on('chatMessage', async (payload) => {
 *     if (!await checkSocketRate(socket)) return;
 *     // handle event...
 *   });
 */
async function checkSocketRate(socket) {
  const key = `ratelimit:socket:${socket.user.id}`;

  const current = (await get(key)) ?? 0;

  if (current >= SOCKET_EVENT_LIMIT) {
    socket.emit('rateLimitExceeded', {
      message: 'Terlalu banyak event. Coba lagi dalam beberapa detik.',
    });
    socket.disconnect(true);
    return false;
  }

  // Increment counter; reset TTL each call (sliding-window approximation).
  await setEx(key, SOCKET_WINDOW_SECS, current + 1);
  return true;
}

module.exports = { authLimiter, apiLimiter, checkSocketRate };
