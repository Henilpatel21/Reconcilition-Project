const mongoose = require('mongoose');

/**
 * ReconciliationResult Model
 * Fields:
 * - transactionId
 * - bankReferenceId
 * - status: matched / missing / duplicate / over_settle / under_settle
 * - differenceAmount
 * - notes (string)
 * - createdAt
 */

const ReconciliationResultSchema = new mongoose.Schema({
  // Run-level fields (store a reconciliation run)
  runDate: { type: Date, default: Date.now },
  summary: { type: mongoose.Schema.Types.Mixed, default: {} },
  details: { type: [mongoose.Schema.Types.Mixed], default: [] },

  // Legacy / per-item fields (kept optional for backward compatibility)
  transactionId: { type: String, index: true },
  bankReferenceId: { type: String },
  status: { type: String, enum: ['matched', 'missing', 'duplicate', 'over_settle', 'under_settle'] },
  differenceAmount: { type: Number, default: 0 },
  notes: { type: String, default: '' },
}, { timestamps: { createdAt: true, updatedAt: false } });

ReconciliationResultSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('ReconciliationResult', ReconciliationResultSchema);
