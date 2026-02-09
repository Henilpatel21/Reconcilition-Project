const mongoose = require('mongoose');

/**
 * Transaction Model
 * Fields:
 * - transactionId (string)
 * - merchantId (string)
 * - amount (number)
 * - currency (string)
 * - paymentMethod (string)
 * - timestamp (date)
 * - status (string: success / failed / pending)
 * - createdAt, updatedAt (timestamps)
 */

const TransactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, index: true },
  merchantId: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true, default: 'USD' },
  paymentMethod: { type: String, required: true },
  timestamp: { type: Date, required: true, default: Date.now },
  status: { type: String, enum: ['success', 'failed', 'pending'], default: 'success' },
  bankReferenceId: { type: String, default: null, index: true },
  reconciliationStatus: { type: String, enum: ['unmatched', 'matched', 'partial', 'duplicate', 'review'], default: 'unmatched' },
  matchedSettlementId: { type: mongoose.Schema.Types.ObjectId, default: null },
  matchType: { type: String, enum: ['reference', 'threeway', 'fuzzy', 'manual'], default: 'reference' },
}, { timestamps: true });

/**
 * toJSON transform to remove __v
 */
TransactionSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Transaction', TransactionSchema);
