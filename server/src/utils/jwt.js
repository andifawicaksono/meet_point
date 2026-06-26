const jwt = require('jsonwebtoken');
const { setEx, get } = require('../config/redis');

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Issue a short-lived access token.
 * Payload: { sub: userId, role, iat, exp }
 */
function generateAccessToken(userId, role) {
  return jwt.sign(
    { sub: userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
  );
}

/**
 * Issue a long-lived refresh token and persist it in Redis
 * under key `refresh:{userId}` so the token can be invalidated
 * for the entire user session by deleting the key.
 */
async function generateRefreshToken(userId) {
  const token = jwt.sign(
    { sub: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' },
  );
  await setEx(`refresh:${userId}`, REFRESH_TTL_SECONDS, token);
  return token;
}

/**
 * Verify an access token synchronously.
 * Throws JsonWebTokenError | TokenExpiredError on failure.
 */
function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

/**
 * Verify a refresh token:
 *   1. Check signature + expiry
 *   2. Check it has not been blacklisted (e.g. after logout)
 * Returns the decoded payload, or throws.
 */
async function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

  const blacklisted = await get(`blacklist:${token}`);
  if (blacklisted !== null) {
    const err = new Error('Refresh token has been revoked');
    err.status = 401;
    throw err;
  }

  return decoded;
}

/**
 * Blacklist a refresh token for the remainder of its natural lifetime.
 * Call on logout to prevent reuse.
 */
async function blacklistRefreshToken(token) {
  await setEx(`blacklist:${token}`, REFRESH_TTL_SECONDS, '1');
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  blacklistRefreshToken,
};
