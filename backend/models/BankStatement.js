const mongoose = require('mongoose');

/**
 * BankStatement Model
 * Represents settlement/statement records from the bank
 * Fields:
 * - bankReferenceId (string) - unique ID from bank
 * - amount (number)
 * - merchantAccountId (string) - merchant's account at the bank
 * - bankName (string)
 * - settlementDate (date)
 * - status (string: cleared / pending / failed)
 * - reconciliationStatus (string: unmatched / matched / partial / duplicate / review)
 * - matchedTransactionId (ObjectId) - reference to Transaction
 * - matchType (string: reference / threeway / fuzzy / manual)
 * - notes (string) - for tracking manual overrides
 */

const BankStatementSchema = new mongoose.Schema({
  bankReferenceId: { type: String, required: true, unique: true, index: true },
  amount: { type: Number, required: true },
  merchantAccountId: { type: String, required: true, index: true },
  bankName: { type: String, required: true, default: 'MockBank' },
  settlementDate: { type: Date, required: true, default: Date.now },
  status: { type: String, enum: ['cleared', 'pending', 'failed'], default: 'cleared' },
  reconciliationStatus: { type: String, enum: ['unmatched', 'matched', 'partial', 'duplicate', 'review'], default: 'unmatched' },
  matchedTransactionId: { type: mongoose.Schema.Types.ObjectId, default: null, ref: 'Transaction' },
  matchType: { type: String, enum: ['reference', 'threeway', 'fuzzy', 'manual'], default: 'reference' },
  notes: { type: String, default: null },
}, { timestamps: true });

/**
 * toJSON transform to remove __v
 */
BankStatementSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('BankStatement', BankStatementSchema);
