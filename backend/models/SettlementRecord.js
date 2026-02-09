const mongoose = require('mongoose');

/**
 * SettlementRecord Model (Bank Statement Upload)
 * Fields:
 * - bankReferenceId (string) - unique ID from bank
 * - amount (number)
 * - merchantAccountId (string) - merchant's account at the bank
 * - settlementDate (date)
 * - bankName (string)
 * - status (string: cleared / pending / failed)
 * - reconciliationStatus (string)
 * - matchedTransactionId (ObjectId)
 * - matchType (string)
 * - notes (string)
 */

const SettlementRecordSchema = new mongoose.Schema({
  bankReferenceId: { type: String, required: true, unique: true, index: true },
  amount: { type: Number, required: true },
  merchantAccountId: { type: String, required: true, index: true },
  settlementDate: { type: Date, required: true },
  bankName: { type: String, required: true, default: 'MockBank' },
  status: { type: String, enum: ['cleared', 'pending', 'failed'], default: 'cleared' },
  reconciliationStatus: { type: String, enum: ['unmatched', 'matched', 'partial', 'duplicate', 'review'], default: 'unmatched' },
  matchedTransactionId: { type: mongoose.Schema.Types.ObjectId, default: null, ref: 'Transaction' },
  matchType: { type: String, enum: ['reference', 'threeway', 'fuzzy', 'manual'], default: null },
  notes: { type: String, default: null },
}, { timestamps: true });

SettlementRecordSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('SettlementRecord', SettlementRecordSchema);
