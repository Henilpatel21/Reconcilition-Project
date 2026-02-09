const AuditLog = require('../models/AuditLog');

/**
 * Log an audit entry
 * @param {Object} params { action, userId, details, ip }
 */
async function log({ action, userId, details, ip }) {
  try {
    const entry = new AuditLog({ action, userId: userId ? String(userId) : undefined, details, ip });
    await entry.save();
  } catch (err) {
    console.error('Audit log error', err);
  }
}

module.exports = { log };
