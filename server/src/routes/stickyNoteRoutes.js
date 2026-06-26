const { Router } = require('express');
const auth = require('../middleware/auth');
const {
  createNote,
  getNotes,
  updateNote,
  deleteNote,
} = require('../controllers/stickyNoteController');

const router = Router();

router.post('/:roomId/notes', auth, createNote);
router.get('/:roomId/notes', auth, getNotes);
router.patch('/:roomId/notes/:id', auth, updateNote);
router.delete('/:roomId/notes/:id', auth, deleteNote);

module.exports = router;
