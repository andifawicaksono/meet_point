const { User } = require('../models');
const jwt = require('jsonwebtoken');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  blacklistRefreshToken,
} = require('../utils/jwt');
const { logAction } = require('../utils/auditLogger');

const IS_PROD = process.env.NODE_ENV === 'production';

const REFRESH_COOKIE = 'refreshToken';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days ms
  path: '/api/auth',
};

function getIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress ?? null);
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
}

// ── POST /api/auth/register ───────────────────────────────────────────────

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    // passwordHash field name is intentional — beforeCreate hook hashes it
    const user = await User.create({ name, email, passwordHash: password });

    const [accessToken, refreshToken] = await Promise.all([
      generateAccessToken(user.id, user.role),
      generateRefreshToken(user.id),
    ]);

    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);

    logAction({
      userId: user.id,
      action: 'REGISTER',
      metadata: { email },
      ipAddress: getIp(req),
    });

    return res.status(201).json({ user: safeUser(user), accessToken });
  } catch (err) {
    return next(err);
  }
}

// ── POST /api/auth/login ──────────────────────────────────────────────────

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // unscoped() bypasses the defaultScope that excludes passwordHash
    const user = await User.unscoped().findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'No account found with that email' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'This account has been disabled' });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      logAction({
        userId: user.id,
        action: 'LOGIN',
        metadata: { email, success: false, reason: 'wrong_password' },
        ipAddress: getIp(req),
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const [accessToken, refreshToken] = await Promise.all([
      generateAccessToken(user.id, user.role),
      generateRefreshToken(user.id),
      user.update({ lastLoginAt: new Date() }),
    ]);

    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);

    logAction({
      userId: user.id,
      action: 'LOGIN',
      metadata: { email, success: true },
      ipAddress: getIp(req),
    });

    return res.json({ user: safeUser(user), accessToken });
  } catch (err) {
    return next(err);
  }
}

// ── POST /api/auth/refresh ────────────────────────────────────────────────

async function refresh(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      return res.status(401).json({ error: 'Refresh token missing' });
    }

    let decoded;
    try {
      decoded = await verifyRefreshToken(token);
    } catch {
      return res.status(401).json({ error: 'Refresh token invalid or expired' });
    }

    const user = await User.findByPk(decoded.sub);
    if (!user?.isActive) {
      return res.status(401).json({ error: 'User not found or disabled' });
    }

    const accessToken = generateAccessToken(user.id, user.role);
    return res.json({ accessToken });
  } catch (err) {
    return next(err);
  }
}

// ── POST /api/auth/logout ─────────────────────────────────────────────────

async function logout(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];

    if (token) {
      // Decode without verifying so we can log the userId even if the token is expired
      const decoded = jwt.decode(token);

      await blacklistRefreshToken(token);

      if (decoded?.sub) {
        logAction({
          userId: decoded.sub,
          action: 'LOGOUT',
          metadata: {},
          ipAddress: getIp(req),
        });
      }
    }

    res.clearCookie(REFRESH_COOKIE, { path: COOKIE_OPTIONS.path });
    return res.json({ message: 'Logged out' });
  } catch (err) {
    return next(err);
  }
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────

async function getMe(req, res, next) {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user: safeUser(user) });
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login, refresh, logout, getMe };
