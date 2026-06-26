const { Router } = require('express');
const auth = require('../middleware/auth');
const { getChatHistory } = require('../controllers/chatController');

const router = Router();

router.get('/:roomId/chat', auth, getChatHistory);

module.exports = router;
