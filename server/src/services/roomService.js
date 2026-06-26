const crypto = require('crypto');
const { Op } = require('sequelize');
const { Room, RoomParticipant, User, sequelize } = require('../models');
const { setEx, hSet, hGetAll, hDel, del } = require('../config/redis');

const ROOM_TTL = 24 * 60 * 60; // 24 h in seconds
const PARTICIPANT_TTL = 24 * 60 * 60;

const CURSOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
];

// ── Internal helpers ────────────────────────────────────────────────────────

function generateInviteCode() {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

async function uniqueInviteCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const exists = await Room.count({ where: { inviteCode: code } });
    if (!exists) return code;
  }
  throw new Error('Failed to generate a unique invite code — try again');
}

function participantShape(user, participant) {
  return {
    id: user.id ?? participant.userId,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    role: participant.role,
    isOnline: participant.isOnline,
    cursorColor: participant.cursorColor,
  };
}

async function cacheParticipant(roomId, data) {
  await hSet(`room:${roomId}:participants`, data.id, data);
}

async function getCachedParticipants(roomId) {
  const raw = await hGetAll(`room:${roomId}:participants`);
  return raw ? Object.values(raw) : [];
}

// ── Public service methods ──────────────────────────────────────────────────

/**
 * Create a new room and add the owner as first participant.
 */
async function createRoom({ name, description, ownerId }) {
  const inviteCode = await uniqueInviteCode();

  const room = await sequelize.transaction(async (t) => {
    const newRoom = await Room.create(
      { name, description, inviteCode, ownerId },
      { transaction: t },
    );

    const ownerUser = await User.findByPk(ownerId, {
      attributes: ['id', 'name', 'avatarUrl'],
      transaction: t,
    });

    await RoomParticipant.create(
      {
        roomId: newRoom.id,
        userId: ownerId,
        role: 'owner',
        isOnline: true,
        cursorColor: CURSOR_COLORS[0],
      },
      { transaction: t },
    );

    const ownerParticipant = { role: 'owner', isOnline: true, cursorColor: CURSOR_COLORS[0] };
    const shape = participantShape(ownerUser, ownerParticipant);
    return { room: newRoom, owner: ownerUser, participants: [shape] };
  });

  // Cache room + first participant
  await Promise.all([
    setEx(`room:${room.room.id}`, ROOM_TTL, room.room.toJSON()),
    cacheParticipant(room.room.id, room.participants[0]),
  ]);

  return { room: room.room, participants: room.participants };
}

/**
 * Join a room by its invite code.
 * Upserts the participant record, assigns a cursor colour from the palette.
 */
async function joinRoomByCode(inviteCode, userId) {
  const room = await Room.findOne({ where: { inviteCode } });
  if (!room) {
    const err = new Error('Room not found'); err.status = 404; throw err;
  }
  if (room.isLocked) {
    const err = new Error('This room is locked'); err.status = 403; throw err;
  }

  // Check capacity
  const currentCount = await RoomParticipant.count({ where: { roomId: room.id } });
  if (currentCount >= room.maxParticipants) {
    const err = new Error('Room is at maximum capacity'); err.status = 403; throw err;
  }

  // Pick an unused cursor colour
  const existing = await RoomParticipant.findAll({
    where: { roomId: room.id },
    attributes: ['cursorColor'],
  });
  const usedColors = new Set(existing.map((p) => p.cursorColor));
  const cursorColor =
    CURSOR_COLORS.find((c) => !usedColors.has(c)) ??
    CURSOR_COLORS[crypto.randomInt(CURSOR_COLORS.length)];

  const user = await User.findByPk(userId, { attributes: ['id', 'name', 'avatarUrl'] });

  const [participant] = await RoomParticipant.findOrCreate({
    where: { roomId: room.id, userId },
    defaults: { role: 'member', isOnline: true, cursorColor },
  });

  if (!participant.isOnline) {
    await participant.update({ isOnline: true, cursorColor });
  }

  const participants = await getRoomParticipants(room.id);

  // Refresh room cache
  await Promise.all([
    setEx(`room:${room.id}`, ROOM_TTL, room.toJSON()),
    cacheParticipant(room.id, participantShape(user, participant)),
  ]);

  return { room, participants };
}

/**
 * Get room participants.
 * Redis-first with DB fallback; re-populates cache on miss.
 */
async function getRoomParticipants(roomId) {
  const cached = await getCachedParticipants(roomId);
  if (cached.length > 0) return cached;

  // DB fallback
  const records = await RoomParticipant.findAll({
    where: { roomId },
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'avatarUrl'] }],
  });

  const shapes = records.map((p) => participantShape(p.user, p));

  // Repopulate cache
  await Promise.all(
    shapes.map((s) => cacheParticipant(roomId, s)),
  );

  return shapes;
}

/**
 * Mark a user offline in a room.
 * Transfers ownership if the departing user is the current owner.
 */
async function leaveRoom(roomId, userId) {
  await RoomParticipant.update(
    { isOnline: false },
    { where: { roomId, userId } },
  );

  await hDel(`room:${roomId}:participants`, userId);

  const room = await Room.findByPk(roomId);
  if (!room || room.ownerId !== userId) return;

  // Transfer ownership to the longest-standing member
  const nextOwner = await RoomParticipant.findOne({
    where: { roomId, userId: { [Op.ne]: userId } },
    order: [['joinedAt', 'ASC']],
  });

  if (!nextOwner) return;

  await Promise.all([
    room.update({ ownerId: nextOwner.userId }),
    nextOwner.update({ role: 'owner' }),
  ]);

  // Update cache entry for new owner
  const ownerUser = await User.findByPk(nextOwner.userId, {
    attributes: ['id', 'name', 'avatarUrl'],
  });
  if (ownerUser) {
    await cacheParticipant(roomId, participantShape(ownerUser, { ...nextOwner.toJSON(), role: 'owner' }));
  }
}

/**
 * Remove a participant from a room (kick).
 * Only the room owner can do this.
 */
async function removeParticipant(roomId, targetUserId, requesterId) {
  const requesterParticipant = await RoomParticipant.findOne({
    where: { roomId, userId: requesterId },
  });

  if (!requesterParticipant || requesterParticipant.role !== 'owner') {
    const err = new Error('Only the room owner can remove participants'); err.status = 403; throw err;
  }

  if (targetUserId === requesterId) {
    const err = new Error('Owner cannot remove themselves — use leave instead'); err.status = 400; throw err;
  }

  await RoomParticipant.destroy({ where: { roomId, userId: targetUserId } });
  await hDel(`room:${roomId}:participants`, targetUserId);

  // Emit real-time event if Socket.io is ready
  try {
    const { getIO } = require('../config/socket');
    getIO().to(`room:${roomId}`).emit('participantRemoved', { userId: targetUserId });
  } catch {
    // Socket not yet initialised or room channel empty — safe to ignore
  }
}

module.exports = {
  createRoom,
  joinRoomByCode,
  getRoomParticipants,
  leaveRoom,
  removeParticipant,
};
