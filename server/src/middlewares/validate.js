const Joi = require('joi');

// ── Schemas ───────────────────────────────────────────────────────────────

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required().messages({
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name cannot exceed 50 characters',
    'any.required': 'Name is required',
  }),
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().trim().required().messages({
    'string.email': 'Must be a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string()
    .min(8)
    .max(72)
    .pattern(/[A-Z]/, 'uppercase')
    .pattern(/[0-9]/, 'number')
    .pattern(/[^A-Za-z0-9]/, 'symbol')
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.max': 'Password cannot exceed 72 characters',
      'string.pattern.name': 'Password must contain at least one {#name}',
      'any.required': 'Password is required',
    }),
});

const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().trim().required().messages({
    'string.email': 'Must be a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});

// ── Middleware factory ────────────────────────────────────────────────────

/**
 * Returns an Express middleware that validates req.body against the given
 * Joi schema. On failure, responds 422 with an array of { field, message }.
 *
 * @param {Joi.Schema} schema
 */
function validate(schema) {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((d) => ({
        field: d.path.join('.') || 'body',
        message: d.message.replace(/['"]/g, ''),
      }));
      return _res.status(422).json({ errors });
    }

    // Replace body with the sanitised + coerced value (e.g. lowercased email)
    req.body = value;
    return next();
  };
}

module.exports = { registerSchema, loginSchema, validate };
