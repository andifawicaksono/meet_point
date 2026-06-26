const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { hSet, hDel, setEx, get } = require('./redis');

const BOARD_REDIS_TTL = 24 * 60 * 60; // 24 h
const dbSaveTimers = new Map(); // roomId → NodeJS.Timeout

let io;

// ── Late-require helper avoids circular-dep at module init ────────────────
function services() {
  const models = require('../models');
  return {
    boardService: require('../services/boardService'),
    roomService: require('../services/roomService'),
    Room: models.Room,
    RoomParticipant: models.RoomParticipant,
    User: models.User,
    StickyNote: models.StickyNote,
    Chat: models.Chat,
  };
}

// ── Naming helpers ─────────────────────────────────────────────────────────
const ROOM_CH = (id) => `room:${id}`;
const PARTICIPANTS_KEY = (id) => `room:${id}:participants`;
const BOARD_KEY = (id) => `board:${id}`;

// ── Board debounce ─────────────────────────────────────────────────────────
function debounceDbSave(roomId, snapshot, version, userId) {
  if (dbSaveTimers.has(roomId)) clearTimeout(dbSaveTimers.get(roomId));
  const timer = setTimeout(async () => {
    try {
      const { boardService } = services();
      await boardService.saveSnapshot(roomId, snapshot, version, userId);
    } catch (err) {
      console.error('[Socket] Board DB flush failed:', err.message);
    } finally {
      dbSaveTimers.delete(roomId);
    }
  }, 10_000);
  dbSaveTimers.set(roomId, timer);
}

// ── initSocket ─────────────────────────────────────────────────────────────
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (process.env.CLIENT_URL || 'http://localhost:5173').split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  // ── JWT auth middleware ────────────────────────────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      let name = socket.handshake.auth?.name;
      if (!name) {
        const { User } = services();
        const user = await User.findByPk(decoded.sub, { attributes: ['name'] });
        name = user?.name ?? 'Anonymous';
      }

      socket.user = { id: decoded.sub, role: decoded.role, name, color: null };
      return next();
    } catch {
      return next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.user.id;
    socket._rooms = new Set();
    socket._lastCursorTime = 0;

    console.log(`[Socket] Connected: ${socket.id} (user: ${userId})`);

    // ── joinRoom ──────────────────────────────────────────────────────
    socket.on('joinRoom', async ({ roomId }) => {
      if (!roomId) return;
      try {
        const { boardService, roomService, Room, RoomParticipant } = services();

        await socket.join(ROOM_CH(roomId));
        socket._rooms.add(roomId);

        const participantRecord = await RoomParticipant.findOne({
          where: { roomId, userId },
          attributes: ['cursorColor', 'role'],
        });
        socket.user.color = participantRecord?.cursorColor ?? '#4ECDC4';
        const role = participantRecord?.role ?? 'member';

        await hSet(PARTICIPANTS_KEY(roomId), userId, {
          userId,
          name: socket.user.name,
          color: socket.user.color,
          role,
        });

        const [room, participants, boardData] = await Promise.all([
          Room.findByPk(roomId),
          roomService.getRoomParticipants(roomId),
          boardService.getSnapshot(roomId),
        ]);

        socket.emit('roomData', {
          room: room?.toJSON() ?? null,
          participants,
          boardSnapshot: boardData?.snapshot ?? null,
          boardVersion: boardData?.version ?? 0,
        });

        socket.to(ROOM_CH(roomId)).emit('participantJoined', {
          user: {
            id: userId,
            name: socket.user.name,
            cursorColor: socket.user.color,
            role,
            isOnline: true,
          },
          participants,
        });

        console.log(`[Socket] ${userId} joined room:${roomId}`);
      } catch (err) {
        console.error('[Socket] joinRoom error:', err.message);
        socket.emit('error', { event: 'joinRoom', message: err.message });
      }
    });

    // ── leaveRoom ─────────────────────────────────────────────────────
    socket.on('leaveRoom', async ({ roomId }) => {
      if (!roomId) return;
      try {
        socket.leave(ROOM_CH(roomId));
        socket._rooms.delete(roomId);
        await hDel(PARTICIPANTS_KEY(roomId), userId);

        const { roomService } = services();
        const participants = await roomService.getRoomParticipants(roomId);
        socket.to(ROOM_CH(roomId)).emit('participantLeft', { userId, participants });

        console.log(`[Socket] ${userId} left room:${roomId}`);
      } catch (err) {
        console.error('[Socket] leaveRoom error:', err.message);
      }
    });

    // ── boardUpdate ───────────────────────────────────────────────────
    socket.on('boardUpdate', async ({ roomId, snapshot, version }) => {
      if (!roomId || snapshot == null || version == null) return;
      try {
        const current = await get(BOARD_KEY(roomId));
        const currentVersion = current?.version ?? 0;

        if (version < currentVersion) {
          socket.emit('boardUpdateRejected', { reason: 'stale', currentVersion });
          return;
        }

        await setEx(BOARD_KEY(roomId), BOARD_REDIS_TTL, { snapshot, version });
        socket.to(ROOM_CH(roomId)).emit('boardUpdated', { snapshot, version });
        debounceDbSave(roomId, snapshot, version, userId);
      } catch (err) {
        console.error('[Socket] boardUpdate error:', err.message);
      }
    });

    // ── cursorMove ────────────────────────────────────────────────────
    socket.on('cursorMove', ({ roomId, x, y }) => {
      if (!roomId) return;
      const now = Date.now();
      if (now - socket._lastCursorTime < 33) return;
      socket._lastCursorTime = now;

      socket.to(ROOM_CH(roomId)).emit('cursorMoved', {
        userId,
        name: socket.user.name,
        color: socket.user.color ?? '#4ECDC4',
        x,
        y,
      });
    });

    // ── moveNote ──────────────────────────────────────────────────────
    socket.on('moveNote', async ({ roomId, id, position_x, position_y }) => {
      if (!roomId || !id) return;
      try {
        const { StickyNote } = services();
        await StickyNote.update({ position_x, position_y }, { where: { id, roomId } });
        socket.to(ROOM_CH(roomId)).emit('noteMoved', { roomId, id, position_x, position_y });
      } catch (err) {
        console.error('[Socket] moveNote error:', err.message);
      }
    });

    // ── chatMessage ───────────────────────────────────────────────────
    socket.on('chatMessage', async ({ roomId, content, replyToId }) => {
      if (!roomId || !content?.trim()) return;
      try {
        const { Chat, User } = services();

        const message = await Chat.create({
          roomId,
          authorId: userId,
          content: content.trim(),
          replyToId: replyToId || null,
        });

        const fullMessage = await Chat.findByPk(message.id, {
          include: [
            { model: User, as: 'author', attributes: ['id', 'name', 'avatarUrl'] },
            {
              model: Chat,
              as: 'replyTo',
              required: false,
              include: [{ model: User, as: 'author', attributes: ['id', 'name'] }],
            },
          ],
        });

        const mentions = [...(content.matchAll(/@(\w+)/g) ?? [])].map((m) => m[1]);
        io.to(ROOM_CH(roomId)).emit('newMessage', { message: fullMessage, mentions });
      } catch (err) {
        console.error('[Socket] chatMessage error:', err.message);
      }
    });

    // ── disconnect ────────────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      console.log(`[Socket] Disconnected: ${socket.id} (${userId}) — ${reason}`);
      const { roomService } = services();

      for (const roomId of socket._rooms) {
        try {
          await hDel(PARTICIPANTS_KEY(roomId), userId);
          const participants = await roomService.getRoomParticipants(roomId);
          io.to(ROOM_CH(roomId)).emit('participantLeft', { userId, participants });
        } catch (err) {
          console.error(`[Socket] disconnect cleanup (room ${roomId}):`, err.message);
        }
      }
      socket._rooms.clear();
    });
  });

  console.log('[Socket] Socket.io initialised');
  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialised — call initSocket() first');
  return io;
}

module.exports = { initSocket, getIO };
