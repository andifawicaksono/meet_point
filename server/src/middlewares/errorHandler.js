/**
 * Centralised Express error handler.
 *
 * Usage — replace the inline handler in app.js:
 *   const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
 *   app.use(notFoundHandler);
 *   app.use(errorHandler);
 */

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // CSRF token mismatch
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  // Sequelize model validation failures (bad field values)
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.errors.map((e) => e.message),
    });
  }

  // Sequelize unique constraint violation
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Resource already exists' });
  }

  // Sequelize FK / association errors
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({ error: 'Referenced resource does not exist' });
  }

  // JWT verification failure (in case it propagates to middleware)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Express body-parser size limit exceeded
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload too large' });
  }

  const status = err.status || err.statusCode || 500;
  const message = status < 500 ? err.message : 'Internal Server Error';

  if (status >= 500) {
    console.error('[Error]', err);
  }

  return res.status(status).json({ error: message });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
}

module.exports = { errorHandler, notFoundHandler };
