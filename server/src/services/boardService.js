const { BoardElement } = require('../models');
const { setEx, get } = require('../config/redis');

const BOARD_REDIS_TTL = 24 * 60 * 60; // 24 h

/**
 * Upsert the tldraw snapshot for a room.
 * Called by the socket debounce timer — not on every board event.
 */
async function saveSnapshot(roomId, snapshot, version, updatedBy) {
  const [board, created] = await BoardElement.findOrCreate({
    where: { roomId },
    defaults: {
      tldrawSnapshot: snapshot,
      version,
      updatedBy: updatedBy ?? null,
      updatedAt: new Date(),
    },
  });

  if (!created) {
    await board.update({
      tldrawSnapshot: snapshot,
      version,
      updatedBy: updatedBy ?? null,
      updatedAt: new Date(),
    });
  }
}

/**
 * Retrieve the current snapshot for a room.
 * Redis-first; falls back to DB and re-populates cache on miss.
 * Returns { snapshot, version } or null if no board exists yet.
 */
async function getSnapshot(roomId) {
  // Hot path: Redis
  const cached = await get(`board:${roomId}`);
  if (cached && cached.snapshot) return cached;

  // Cold path: database
  const board = await BoardElement.findOne({ where: { roomId } });
  if (!board || !board.tldrawSnapshot) return null;

  const result = { snapshot: board.tldrawSnapshot, version: board.version ?? 0 };

  // Re-populate Redis cache
  await setEx(`board:${roomId}`, BOARD_REDIS_TTL, result);

  return result;
}

module.exports = { saveSnapshot, getSnapshot };
