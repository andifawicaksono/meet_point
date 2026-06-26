const { Op } = require('sequelize');
const { Room, RoomParticipant, User, sequelize } = require('../models');
const roomService = require('../services/roomService');
const { logAction } = require('../utils/auditLogger');

// ── Helpers ───────────────────────────────────────────────────────────────

function getIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return fwd ? fwd.split(',')[0].trim() : (req.socket?.remoteAddress ?? null);
}

function roomShape(room, participantCount = 0) {
  return {
    id: room.id,
    name: room.name,
    description: room.description,
    inviteCode: room.inviteCode,
    isLocked: room.isLocked,
    maxParticipants: room.maxParticipants,
    status: room.status,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    owner: room.owner ?? null,
    participantCount: Number(room.dataValues?.participantCount ?? participantCount),
  };
}

// ── POST /api/rooms ───────────────────────────────────────────────────────

async function createRoom(req, res, next) {
  try {
    const { name, description = '' } = req.body;
    if (!name?.trim()) {
      return res.status(422).json({ error: 'Room name is required' });
    }

    const { room, participants } = await roomService.createRoom({
      name: name.trim(),
      description: description.trim(),
      ownerId: req.user.id,
    });

    logAction({
      userId: req.user.id,
      roomId: room.id,
      action: 'ROOM_CREATED',
      metadata: { name: room.name, inviteCode: room.inviteCode },
      ipAddress: getIp(req),
    });

    return res.status(201).json({ room: roomShape(room, participants.length), participants });
  } catch (err) {
    return next(err);
  }
}

// ── GET /api/rooms ────────────────────────────────────────────────────────

async function getMyRooms(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const offset = (page - 1) * limit;

    // Step 1: IDs of rooms the user participates in
    const { count, rows: participations } = await RoomParticipant.findAndCountAll({
      where: { userId: req.user.id },
      attributes: ['roomId', 'joinedAt'],
      order: [['joinedAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    const roomIds = participations.map((p) => p.roomId);

    // Step 2: Room details + participant count via subquery
    const rooms = roomIds.length
      ? await Room.findAll({
          where: { id: { [Op.in]: roomIds } },
          include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'avatarUrl'] }],
          attributes: {
            include: [
              [
                sequelize.literal(
                  `(SELECT COUNT(*) FROM room_participants WHERE room_id = "Room"."id")`,
                ),
                'participantCount',
              ],
            ],
          },
          order: [[sequelize.literal(`"joinedAt"`), 'DESC']],
        })
      : [];

    // Preserve the order from participations
    const orderedRooms = roomIds
      .map((id) => rooms.find((r) => r.id === id))
      .filter(Boolean)
      .map((r) => roomShape(r));

    return res.json({
      rooms: orderedRooms,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    });
  } catch (err) {
    return next(err);
  }
}

// ── GET /api/rooms/:id ────────────────────────────────────────────────────

async function getRoomById(req, res, next) {
  try {
    const room = await Room.findByPk(req.params.id, {
      include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'avatarUrl'] }],
    });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const isParticipant = await RoomParticipant.findOne({
      where: { roomId: room.id, userId: req.user.id },
    });
    if (!isParticipant) return res.status(403).json({ error: 'You are not a member of this room' });

    const participants = await roomService.getRoomParticipants(room.id);
    return res.json({ room: roomShape(room, participants.length), participants });
  } catch (err) {
    return next(err);
  }
}

// ── GET /api/rooms/join/:code ─────────────────────────────────────────────

async function joinByCode(req, res, next) {
  try {
    const { code } = req.params;
    const { room, participants } = await roomService.joinRoomByCode(
      code.toUpperCase(),
      req.user.id,
    );

    logAction({
      userId: req.user.id,
      roomId: room.id,
      action: 'ROOM_JOINED',
      metadata: { inviteCode: code },
      ipAddress: getIp(req),
    });

    return res.json({ room: roomShape(room, participants.length), participants });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}

// ── DELETE /api/rooms/:id ─────────────────────────────────────────────────

async function deleteRoom(req, res, next) {
  try {
    const room = await Room.findByPk(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Only the room owner can delete this room' });
    }

    await room.destroy();

    // Evict caches
    const { del: redisDel } = require('../config/redis');
    await Promise.allSettled([
      redisDel(`room:${room.id}`),
      redisDel(`room:${room.id}:participants`),
    ]);

    // Notify remaining sockets
    try {
      const { getIO } = require('../config/socket');
      getIO().to(`room:${room.id}`).emit('roomClosed', { roomId: room.id });
    } catch { /* socket not ready */ }

    return res.json({ message: 'Room deleted' });
  } catch (err) {
    return next(err);
  }
}

// ── PATCH /api/rooms/:id/lock ─────────────────────────────────────────────

async function toggleLock(req, res, next) {
  try {
    const room = await Room.findByPk(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Only the room owner can lock/unlock this room' });
    }

    await room.update({ isLocked: !room.isLocked });
    return res.json({ isLocked: room.isLocked });
  } catch (err) {
    return next(err);
  }
}

// ── POST /api/rooms/:id/leave ─────────────────────────────────────────────

async function leaveRoom(req, res, next) {
  try {
    await roomService.leaveRoom(req.params.id, req.user.id);

    // Notify room
    try {
      const { getIO } = require('../config/socket');
      getIO().to(`room:${req.params.id}`).emit('participantLeft', { userId: req.user.id });
    } catch { /* socket not ready */ }

    return res.json({ message: 'Left room' });
  } catch (err) {
    return next(err);
  }
}

// ── DELETE /api/rooms/:id/participants/:userId ────────────────────────────

async function removeParticipant(req, res, next) {
  try {
    await roomService.removeParticipant(
      req.params.id,
      req.params.userId,
      req.user.id,
    );

    logAction({
      userId: req.user.id,
      roomId: req.params.id,
      action: 'PARTICIPANT_REMOVED',
      metadata: { targetUserId: req.params.userId },
      ipAddress: getIp(req),
    });

    return res.json({ message: 'Participant removed' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}

module.exports = {
  createRoom,
  getMyRooms,
  getRoomById,
  joinByCode,
  deleteRoom,
  toggleLock,
  leaveRoom,
  removeParticipant,
};
