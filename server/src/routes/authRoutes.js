const { Router } = require('express');
const { register, login, refresh, logout, getMe } = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');
const { validate, registerSchema, loginSchema } = require('../middlewares/validate');

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login',    validate(loginSchema),    login);
router.post('/refresh',                            refresh);
router.post('/logout',                             logout);
router.get('/me',        authenticate,             getMe);

module.exports = router;
