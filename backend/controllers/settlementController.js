const { parseSettlementFile } = require('../utils/parser');
const SettlementRecord = require('../models/SettlementRecord');
const Papa = require('papaparse');
const { log } = require('../utils/logger');

/**
 * Map flexible row keys to SettlementRecord fields
 */
function mapRowToSettlement(row) {
  // normalize keys
  const lower = {};
  Object.keys(row || {}).forEach((k) => {
    lower[k.trim().toLowerCase()] = row[k];
  });

  const referenceId = lower.referenceid || lower.reference || lower.ref || lower.id || lower.transactionreference || '';
  const amount = parseFloat(lower.amountsettled || lower.amount || lower.settlementamount || lower.value || 0) || 0;
  const settlementDate = lower.settlementdate || lower.date || lower['settlement date'] || lower.timestamp || null;
  const bankName = lower.bankname || lower.bank || lower['bank name'] || '';
  const merchantId = lower.merchantid || lower.merchant || '';

  return {
    referenceId: String(referenceId || '').trim(),
    amountSettled: amount,
    settlementDate: settlementDate ? new Date(settlementDate) : new Date(),
    bankName: String(bankName || '').trim() || 'MockBank',
    merchantId: String(merchantId || '').trim(),
  };
}

/**
 * Upload settlement file, parse and store records
 * POST /api/settlements/upload
 */
exports.upload = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'No file uploaded' });

    const rows = parseSettlementFile(file);
    if (!rows || !rows.length) return res.status(400).json({ message: 'No rows parsed from file' });

    const toInsert = [];
    const errors = [];

    rows.forEach((r, idx) => {
      try {
        const mapped = mapRowToSettlement(r);
        if (!mapped.referenceId) throw new Error('Missing referenceId');
        toInsert.push(mapped);
      } catch (err) {
        errors.push({ row: idx + 1, error: err.message });
      }
    });

    let created = [];
    let duplicates = 0;
    if (toInsert.length) {
      // Deduplicate by referenceId: skip records already in DB
      const refIds = toInsert.map((t) => String(t.referenceId));
      const existing = await SettlementRecord.find({ referenceId: { $in: refIds } }).select('referenceId').lean();
      const existingSet = new Set(existing.map((e) => String(e.referenceId)));
      const filtered = toInsert.filter((t) => !existingSet.has(String(t.referenceId)));
      duplicates = toInsert.length - filtered.length;

      if (filtered.length) {
        try {
          created = await SettlementRecord.insertMany(filtered);
        } catch (insErr) {
          console.warn('Settlement upload error', insErr);
          if (insErr && insErr.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error inserting settlement records', details: insErr.errors });
          }
          throw insErr;
        }
      }
    }

    // TODO: Add audit log for settlement upload

    await log({ action: 'settlement.upload', userId: req.user ? req.user.id : null, details: { parsed: rows.length, created: created.length, duplicates }, ip: req.ip });
    return res.status(201).json({ message: 'File parsed', parsed: rows.length, created: created.length, duplicates, sample: created.slice(0, 10), errors });
  } catch (err) {
    console.error('Settlement upload error', err);
    return res.status(500).json({ message: 'Failed to process settlement file' });
  }
};

/**
 * List settlement records
 * GET /api/settlements
 */
exports.list = async (req, res) => {
  try {
    const docs = await SettlementRecord.find().lean().sort({ settlementDate: -1 });
    return res.json({ total: docs.length, data: docs });
  } catch (err) {
    console.error('Settlement list error', err);
    return res.status(500).json({ message: 'Failed to fetch settlement records' });
  }
};

/**
 * Download all settlement records as CSV
 * GET /api/settlements/download
 */
exports.download = async (req, res) => {
  try {
    const docs = await SettlementRecord.find().lean().sort({ settlementDate: -1 });
    const rows = docs.map((d) => ({
      referenceId: d.referenceId,
      amountSettled: d.amountSettled,
      settlementDate: d.settlementDate,
      bankName: d.bankName,
      merchantId: d.merchantId,
      createdAt: d.createdAt,
    }));

    const csv = Papa.unparse(rows);

    res.setHeader('Content-Disposition', 'attachment; filename="settlements.csv"');
    res.setHeader('Content-Type', 'text/csv');
    return res.send(csv);
  } catch (err) {
    console.error('Settlement download error', err);
    return res.status(500).json({ message: 'Failed to generate CSV' });
  }
};

/**
 * Delete all settlement records
 * DELETE /api/settlements
 */
exports.deleteAll = async (req, res) => {
  try {
    const result = await SettlementRecord.deleteMany({});
    await log({ action: 'settlements.deleteAll', userId: req.user ? req.user.id : null, details: { deleted: result.deletedCount }, ip: req.ip });
    return res.json({ message: 'All settlement records deleted', deleted: result.deletedCount });
  } catch (err) {
    console.error('Settlement deleteAll error', err);
    return res.status(500).json({ message: 'Failed to delete settlement records' });
  }
};
