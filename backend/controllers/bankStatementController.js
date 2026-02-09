const BankStatement = require('../models/BankStatement');
const Transaction = require('../models/Transaction');
const { log } = require('../utils/logger');
const Papa = require('papaparse');

/**
 * Generate mock bank statements
 * POST /api/bank-statements/generate-mock
 * Clears old data and generates fresh 15-20 statements matching current transactions
 */
exports.generateMock = async (req, res) => {
  try {
    // STEP 1: Delete all existing bank statements (AUTO-CLEAR strategy)
    await BankStatement.deleteMany({});

    // STEP 2: Get current transactions
    const transactions = await Transaction.find().sort({ timestamp: -1 });
    
    if (!transactions || transactions.length === 0) {
      return res.status(400).json({ message: 'No transactions found. Generate transactions first.' });
    }

    // STEP 3: Create fresh bank statements matching ALL transactions (1:1 mapping)
    const docs = [];

    for (let idx = 0; idx < transactions.length; idx++) {
      const txn = transactions[idx];
      
      // Settlement delay: 1-2 days after transaction
      const settlementDate = new Date(txn.timestamp);
      settlementDate.setDate(settlementDate.getDate() + Math.floor(Math.random() * 2) + 1);
      
      // Map transaction status to bank statement status
      let status = 'cleared';
      if (txn.status === 'failed') status = 'failed';
      if (txn.status === 'pending') status = 'pending';
      
      // Create matching bank statement (1:1 with transaction)
      docs.push({
        bankReferenceId: txn.bankReferenceId,      // EXACT match for Level 1 reconciliation
        amount: txn.amount,                         // EXACT match for Level 2 reconciliation
        merchantAccountId: txn.merchantId,         // EXACT match for Level 2 reconciliation
        settlementDate,
        bankName: 'Chase Bank',
        status,
        reconciliationStatus: 'unmatched',
      });
    }

    // STEP 4: Insert fresh bank statements
    const created = await BankStatement.insertMany(docs);

    await log({ action: 'bank_statements.generate_mock', userId: req.user ? req.user.id : null, details: { count: created.length }, ip: req.ip });
    return res.status(201).json({ message: 'Fresh mock bank statements generated', count: created.length, created: created.length });
  } catch (err) {
    console.error('generateMock bank statements error', err);
    return res.status(500).json({ message: 'Failed to generate mock bank statements', error: err.message });
  }
};

/**
 * Get all bank statements
 * GET /api/bank-statements
 */
exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    
    const docs = await BankStatement.find()
      .sort({ settlementDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10));

    const total = await BankStatement.countDocuments();
    return res.json({ total, page: parseInt(page, 10), limit: parseInt(limit, 10), data: docs });
  } catch (err) {
    console.error('getAll bank statements error', err);
    return res.status(500).json({ message: 'Failed to fetch bank statements' });
  }
};

/**
 * Upload bank statements from CSV
 * POST /api/bank-statements/upload
 * Validates: bankReferenceId (mandatory), amount, settlementDate
 */
exports.upload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    let data = [];
    const fileBuffer = req.file.buffer.toString('utf-8');

    // Parse CSV
    const parsed = Papa.parse(fileBuffer, { header: true });
    data = parsed.data.filter(row => Object.values(row).some(v => v));

    if (data.length === 0) {
      return res.status(400).json({ message: 'CSV file is empty' });
    }

    // Map CSV columns to model fields with validation
    const rejectedRows = [];
    const docs = data.map((row, idx) => {
      const rowNum = idx + 1;
      try {
        // Mandatory field: bankReferenceId
        const bankReferenceId = (row.bankReferenceId || row.reference || '').trim();
        if (!bankReferenceId) {
          throw new Error('Missing mandatory field: bankReferenceId');
        }

        const amount = parseFloat(row.amount || row.amountSettled || 0);
        const settlementDate = row.settlementDate ? new Date(row.settlementDate) : new Date();
        
        // Validate amount is a number
        if (isNaN(amount) || amount <= 0) {
          throw new Error(`Invalid amount "${row.amount}" (must be > 0)`);
        }
        
        // Validate settlement date if provided
        if (row.settlementDate && isNaN(settlementDate.getTime())) {
          throw new Error(`Invalid settlementDate "${row.settlementDate}"`);
        }
        
        return {
          bankReferenceId,
          amount: amount,
          merchantAccountId: row.merchantAccountId || row.merchantId || row.merchant || 'UNKNOWN',
          settlementDate: settlementDate,
          bankName: row.bankName || row.bank || 'MockBank',
          status: (row.status || 'cleared').toLowerCase(),
          reconciliationStatus: 'unmatched',
        };
      } catch (e) {
        rejectedRows.push({ rowNumber: rowNum, reason: e.message });
        return null;
      }
    }).filter(doc => doc !== null);

    if (docs.length === 0) {
      return res.status(400).json({ 
        message: 'No valid bank statements found in CSV',
        rejectedRows 
      });
    }

    // Check for duplicates
    let duplicates = 0;
    const duplicateRows = [];
    const created = [];
    for (const doc of docs) {
      const exists = await BankStatement.findOne({ bankReferenceId: doc.bankReferenceId });
      if (!exists) {
        const result = await BankStatement.create(doc);
        created.push(result);
      } else {
        duplicates++;
        duplicateRows.push({ value: doc.bankReferenceId, reason: 'Duplicate bankReferenceId' });
      }
    }

    await log({ action: 'bank_statements.upload', userId: req.user ? req.user.id : null, details: { parsed: data.length, created: created.length, duplicates, rejected: rejectedRows.length }, ip: req.ip });
    
    return res.json({ 
      message: 'Bank statements uploaded', 
      parsed: data.length, 
      created: created.length, 
      duplicates,
      rejectedRows,
      duplicateRows 
    });
  } catch (err) {
    console.error('upload bank statements error', err);
    return res.status(500).json({ message: 'Failed to upload bank statements', error: err.message });
  }
};

/**
 * Download bank statements as CSV
 * GET /api/bank-statements/download
 */
exports.download = async (req, res) => {
  try {
    const docs = await BankStatement.find().limit(1000);
    
    if (docs.length === 0) {
      return res.status(400).json({ message: 'No bank statements to download' });
    }

    const headers = ['bankReferenceId', 'amount', 'merchantAccountId', 'settlementDate', 'bankName', 'status'];
    const rows = docs.map(d => headers.map(h => {
      let v = d[h];
      if (h === 'settlementDate' && v) v = new Date(v).toISOString();
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    }));

    const csv = [headers.join(',')].concat(rows.map(r => r.join(','))).join('\n');
    
    res.setHeader('Content-Disposition', 'attachment; filename="bank_statements.csv"');
    res.setHeader('Content-Type', 'text/csv');
    return res.send(csv);
  } catch (err) {
    console.error('Bank statement download error', err);
    return res.status(500).json({ message: 'Failed to generate CSV' });
  }
};

/**
 * Delete all bank statements
 * DELETE /api/bank-statements
 */
exports.deleteAll = async (req, res) => {
  try {
    const result = await BankStatement.deleteMany({});
    await log({ action: 'bank_statements.deleteAll', userId: req.user ? req.user.id : null, details: { deleted: result.deletedCount }, ip: req.ip });
    return res.json({ message: 'All bank statements deleted', deleted: result.deletedCount });
  } catch (err) {
    console.error('deleteAll bank statements error', err);
    return res.status(500).json({ message: 'Failed to delete bank statements' });
  }
};
