const { Router } = require('express');
const auth = require('../middleware/auth');
const { castVote } = require('../controllers/voteController');

const router = Router();

router.post('/:roomId/notes/:noteId/vote', auth, castVote);

module.exports = router;
