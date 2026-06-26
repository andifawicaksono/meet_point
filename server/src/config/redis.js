const Redis = require('ioredis');

const MAX_RETRIES = 3;

const client = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  maxRetriesPerRequest: MAX_RETRIES,
  retryStrategy(times) {
    if (times > MAX_RETRIES) {
      console.error('[Redis] Max retry attempts reached — giving up');
      return null; // stop retrying
    }
    return 500; // fixed 500 ms between attempts
  },
  reconnectOnError(err) {
    // Reconnect on READONLY errors (Redis cluster failover)
    return err.message.includes('READONLY');
  },
});

client.on('connect', () => console.log('[Redis] Connected'));
client.on('ready', () => console.log('[Redis] Ready'));
client.on('error', (err) => console.error('[Redis] Error:', err.message));
client.on('close', () => console.warn('[Redis] Connection closed'));

// ── Helper functions ────────────────────────────────────────────────────────

/**
 * Store a value with a TTL (seconds). Value is JSON-serialised automatically.
 */
async function setEx(key, seconds, value) {
  const serialised = typeof value === 'string' ? value : JSON.stringify(value);
  return client.setex(key, seconds, serialised);
}

/**
 * Get a value and parse it as JSON. Returns null if the key does not exist.
 */
async function get(key) {
  const raw = await client.get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw; // return as-is if not JSON
  }
}

/**
 * Delete one or more keys.
 */
async function del(...keys) {
  return client.del(...keys);
}

/**
 * Set multiple fields in a hash. Values are JSON-serialised.
 * Usage: hSet('room:123:participants', 'userId', { color: '#FF0000', online: true })
 */
async function hSet(hashKey, field, value) {
  const serialised = typeof value === 'string' ? value : JSON.stringify(value);
  return client.hset(hashKey, field, serialised);
}

/**
 * Get all fields of a hash. Values are JSON-parsed.
 * Returns an object: { field: parsedValue, ... }
 */
async function hGetAll(hashKey) {
  const raw = await client.hgetall(hashKey);
  if (!raw) return {};
  return Object.fromEntries(
    Object.entries(raw).map(([field, val]) => {
      try {
        return [field, JSON.parse(val)];
      } catch {
        return [field, val];
      }
    }),
  );
}

/**
 * Delete a single field from a hash.
 */
async function hDel(hashKey, field) {
  return client.hdel(hashKey, field);
}

module.exports = { client, setEx, get, del, hSet, hGetAll, hDel };
