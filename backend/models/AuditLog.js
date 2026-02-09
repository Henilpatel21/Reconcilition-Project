const mongoose = require('mongoose');

/**
 * AuditLog Model
 * Fields:
 * - action (string)
 * - userId (ObjectId or string)
 * - details (object)
 * - ip (string)
 */
const AuditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  userId: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
