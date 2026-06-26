const { verifyAccessToken } = require('../utils/jwt');

/**
 * Require a valid Bearer access token.
 * Attaches req.user = { id, role } on success.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  try {
    const decoded = verifyAccessToken(token);
    req.user = { id: decoded.sub, role: decoded.role };
    return next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token';
    return res.status(401).json({ error: message });
  }
}

/**
 * Require the authenticated user's role to be in the allowed list.
 * Must be used after `authenticate`.
 *
 * @param {...string} roles - allowed roles
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
