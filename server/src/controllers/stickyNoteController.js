const Joi = require('joi');
const { sequelize, StickyNote, User, Room } = require('../models');
const { getIO } = require('../config/socket');
const { auditLog } = require('../utils/auditLogger');

const createSchema = Joi.object({
  type: Joi.string().valid('idea', 'problem', 'solution', 'action_item').default('idea'),
  title: Joi.string().max(200).default('Catatan Baru'),
  content: Joi.string().max(2000).allow('').default(''),
  position_x: Joi.number().min(0).default(100),
  position_y: Joi.number().min(0).default(100),
});

const updateSchema = Joi.object({
  type: Joi.string().valid('idea', 'problem', 'solution', 'action_item'),
  title: Joi.string().max(200),
  content: Joi.string().max(2000).allow(''),
}).min(1);

const AVG_SUBQUERY = `(SELECT COALESCE(AVG(stars)::NUMERIC(10,2), 0) FROM votes WHERE note_id = "StickyNote"."id")`;
const COUNT_SUBQUERY = `(SELECT COUNT(*) FROM votes WHERE note_id = "StickyNote"."id")`;

function withStats(extra = []) {
  return {
    include: [{ model: User, as: 'author', attributes: ['id', 'name'] }],
    attributes: {
      include: [
        [sequelize.literal(AVG_SUBQUERY), 'averageStars'],
        [sequelize.literal(COUNT_SUBQUERY), 'totalVotes'],
        ...extra,
      ],
    },
  };
}

async function loadNote(id) {
  return StickyNote.findByPk(id, withStats());
}

async function createNote(req, res) {
  const { error, value } = createSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { roomId } = req.params;
  const note = await StickyNote.create({ ...value, roomId, authorId: req.user.id });
  const fullNote = await loadNote(note.id);

  getIO().to(`room:${roomId}`).emit('noteCreated', { roomId, note: fullNote });
  auditLog(req.user.id, 'STICKY_CREATED', { noteId: note.id, roomId });

  return res.status(201).json({ note: fullNote });
}

async function getNotes(req, res) {
  const { roomId } = req.params;
  const notes = await StickyNote.findAll({
    where: { roomId },
    ...withStats(),
    order: [['createdAt', 'ASC']],
  });
  return res.json({ notes });
}

async function updateNote(req, res) {
  const { error, value } = updateSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { roomId, id } = req.params;
  const note = await StickyNote.findOne({ where: { id, roomId } });
  if (!note) return res.status(404).json({ message: 'Catatan tidak ditemukan' });

  if (note.authorId !== req.user.id) {
    return res.status(403).json({ message: 'Hanya penulis yang dapat mengubah catatan ini' });
  }

  await note.update(value);
  const fullNote = await loadNote(id);
  getIO().to(`room:${roomId}`).emit('noteUpdated', { roomId, note: fullNote });

  return res.json({ note: fullNote });
}

async function deleteNote(req, res) {
  const { roomId, id } = req.params;
  const note = await StickyNote.findOne({ where: { id, roomId } });
  if (!note) return res.status(404).json({ message: 'Catatan tidak ditemukan' });

  const isAuthor = note.authorId === req.user.id;
  if (!isAuthor) {
    const room = await Room.findByPk(roomId, { attributes: ['ownerId'] });
    if (room?.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Tidak diizinkan menghapus catatan ini' });
    }
  }

  await note.destroy();
  getIO().to(`room:${roomId}`).emit('noteDeleted', { roomId, id });

  return res.json({ message: 'Catatan dihapus' });
}

module.exports = { createNote, getNotes, updateNote, deleteNote };
