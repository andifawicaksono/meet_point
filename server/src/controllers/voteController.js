const Joi = require('joi');
const { sequelize, Vote, StickyNote } = require('../models');
const { getIO } = require('../config/socket');
const { auditLog } = require('../utils/auditLogger');

const castVoteSchema = Joi.object({
  stars: Joi.number().integer().min(1).max(5).required(),
});

async function castVote(req, res) {
  const { error, value } = castVoteSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { roomId, noteId } = req.params;
  const { stars } = value;
  const voterId = req.user.id;

  const note = await StickyNote.findOne({ where: { id: noteId, roomId } });
  if (!note) return res.status(404).json({ message: 'Catatan tidak ditemukan' });

  // Upsert: one vote per user per note
  let vote = await Vote.findOne({ where: { noteId, voterId } });
  if (vote) {
    await vote.update({ stars });
  } else {
    vote = await Vote.create({ roomId, noteId, voterId, stars });
  }

  // Calculate live stats (vote_count is maintained by DB trigger; averageStars is dynamic)
  const stats = await StickyNote.findByPk(noteId, {
    attributes: [
      'vote_count',
      [
        sequelize.literal(
          `(SELECT COALESCE(AVG(stars)::NUMERIC(10,2), 0) FROM votes WHERE note_id = "StickyNote"."id")`
        ),
        'averageStars',
      ],
    ],
    raw: true,
  });

  const averageStars = parseFloat(stats.averageStars) || 0;
  const totalVotes = parseInt(stats.vote_count, 10) || 0;

  getIO().to(`room:${roomId}`).emit('voteUpdated', { noteId, averageStars, totalVotes });
  auditLog(voterId, 'VOTE_CAST', { noteId, roomId, stars });

  return res.json({ vote, averageStars, totalVotes });
}

module.exports = { castVote };
