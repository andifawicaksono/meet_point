const { Chat, User } = require('../models');

async function getChatHistory(req, res) {
  const { roomId } = req.params;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = (page - 1) * limit;

  const { count, rows } = await Chat.findAndCountAll({
    where: { roomId },
    include: [
      { model: User, as: 'author', attributes: ['id', 'name', 'avatarUrl'] },
      {
        model: Chat,
        as: 'replyTo',
        required: false,
        include: [{ model: User, as: 'author', attributes: ['id', 'name'] }],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  return res.json({
    messages: rows.reverse(), // oldest-first for rendering
    pagination: {
      total: count,
      page,
      limit,
      pages: Math.ceil(count / limit),
      hasMore: offset + rows.length < count,
    },
  });
}

module.exports = { getChatHistory };
