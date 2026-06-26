const { Router } = require('express');
const {
  createRoom,
  getMyRooms,
  getRoomById,
  joinByCode,
  deleteRoom,
  toggleLock,
  leaveRoom,
  removeParticipant,
} = require('../controllers/roomController');
const { authenticate } = require('../middlewares/auth');

const router = Router();

// All room routes require a valid access token
router.use(authenticate);

// /api/rooms/join/:code MUST appear before /api/rooms/:id
// so Express doesn't swallow "join" as an id segment.
router.get('/join/:code', joinByCode);

router.post('/',                                  createRoom);
router.get('/',                                   getMyRooms);
router.get('/:id',                                getRoomById);
router.delete('/:id',                             deleteRoom);
router.patch('/:id/lock',                         toggleLock);
router.post('/:id/leave',                         leaveRoom);
router.delete('/:id/participants/:userId',        removeParticipant);

module.exports = router;
