const { AuditLog } = require('../models');

/**
 * Fire-and-forget audit log insertion.
 * Never await this in a request handler — errors are caught internally.
 *
 * @param {object} params
 * @param {string|null} params.userId
 * @param {string|null} [params.roomId]
 * @param {string}       params.action   - one of AuditLog.ACTIONS
 * @param {object}      [params.metadata]
 * @param {string|null} [params.ipAddress]
 */
function logAction({ userId, roomId = null, action, metadata = {}, ipAddress = null }) {
  AuditLog.create({
    userId: userId || null,
    roomId,
    action,
    metadata,
    ipAddress,
  }).catch((err) => {
    // Non-fatal — audit failure must never break the request
    console.error('[AuditLog] Write failed:', err.message);
  });
}

module.exports = { logAction };
