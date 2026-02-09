const AuditLog = require('../models/AuditLog');
const { log } = require('../utils/logger');

/**
 * Get audit logs
 * GET /api/audit/logs
 */
exports.getLogs = async (req, res) => {
  try {
    // Support optional filtering and pagination
    const action = req.query.action;
    const limit = Math.min(parseInt(req.query.limit || 50), 500);
    const offset = parseInt(req.query.offset || 0);

    const filter = {};
    if (action) filter.action = action;

    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean();
    return res.json({ total, limit, offset, items: logs });
  } catch (err) {
    console.error('Get audit logs error', err);
    return res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
};

/**
 * DELETE /api/audit/all
 * Delete all audit logs (protected)
 */
exports.deleteAll = async (req, res) => {
  try {
    const result = await AuditLog.deleteMany({});
    // Intentionally do NOT write an audit entry for deleting all logs, to allow a true clear
    return res.json({ message: 'All audit logs deleted', deleted: result.deletedCount });
  } catch (err) {
    console.error('Delete audit logs error', err);
    return res.status(500).json({ message: 'Failed to delete audit logs' });
  }
};

/**
 * DELETE /api/audit/:id
 * Delete a single audit log entry
 */
exports.deleteOne = async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await AuditLog.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Audit log not found' });
    // Do not log this deletion as an audit entry
    return res.json({ message: 'Audit log deleted', id });
  } catch (err) {
    console.error('Delete audit log error', err);
    return res.status(500).json({ message: 'Failed to delete audit log' });
  }
};
