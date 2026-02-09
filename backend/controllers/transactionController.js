const Transaction = require('../models/Transaction');
const { log } = require('../utils/logger');

/**
 * Generate mock transactions
 * POST /api/transactions/generate-mock
 * Clears old data and generates fresh 15-20 transactions
 */
exports.generateMock = async (req, res) => {
  try {
    // STEP 1: Delete all existing transactions (AUTO-CLEAR strategy)
    await Transaction.deleteMany({});

    // STEP 2: Generate 15-20 transactions
    const count = Math.floor(Math.random() * 6) + 15; // 15-20
    const timestamp = Date.now(); // Unique timestamp for this generation batch
    
    const paymentMethods = ['card', 'bank_transfer', 'wallet'];
    const statuses = ['success', 'failed', 'pending'];
    const merchantIds = ['MERC1001', 'MERC1002', 'MERC1003', 'MERC1004', 'MERC1005'];

    const docs = [];
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 5); // Start from 5 days ago

    for (let i = 0; i < count; i++) {
      const txnId = `TXN-${timestamp}-${i}`;
      // Create unique bankReferenceId with timestamp (ensures no duplicates across generations)
      const bankRefId = `BNK-${String(i).padStart(5, '0')}-${timestamp}`;
      const merchantId = merchantIds[Math.floor(Math.random() * merchantIds.length)];
      const amount = Math.round((Math.random() * 1000 + 10) * 100) / 100; // 10.00 - 1010.00
      
      // Create timestamps spread across last 5 days
      const txnTimestamp = new Date(baseDate);
      txnTimestamp.setDate(txnTimestamp.getDate() + Math.floor(i / 4));
      txnTimestamp.setHours(Math.floor(Math.random() * 24));
      txnTimestamp.setMinutes(Math.floor(Math.random() * 60));
      
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      docs.push({
        transactionId: txnId,
        bankReferenceId: bankRefId,
        merchantId,
        amount,
        currency: 'USD',
        paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
        timestamp: txnTimestamp,
        status,
        reconciliationStatus: 'unmatched',
      });
    }

    // STEP 3: Insert fresh transactions
    const created = await Transaction.insertMany(docs);

    await log({ action: 'transactions.generate_mock', userId: req.user ? req.user.id : null, details: { count: created.length }, ip: req.ip });
    return res.status(201).json({ message: 'Fresh mock transactions generated', count: created.length, created: created.length });
  } catch (err) {
    console.error('generateMock error', err);
    return res.status(500).json({ message: 'Failed to generate mock transactions' });
  }
};

/**
 * Upload transactions from CSV
 * POST /api/transactions/upload
 * Validates: transactionId (mandatory), amount, timestamp
 */
exports.upload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const Papa = require('papaparse');
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
        // Mandatory field: transactionId
        const transactionId = (row.transactionId || row.reference || '').trim();
        if (!transactionId) {
          throw new Error('Missing mandatory field: transactionId');
        }

        const amount = parseFloat(row.amount || 0);
        const timestamp = row.timestamp ? new Date(row.timestamp) : new Date();
        
        // Validate amount is a number
        if (isNaN(amount) || amount <= 0) {
          throw new Error(`Invalid amount "${row.amount}" (must be > 0)`);
        }
        
        // Validate timestamp if provided
        if (row.timestamp && isNaN(timestamp.getTime())) {
          throw new Error(`Invalid timestamp "${row.timestamp}"`);
        }
        
        return {
          transactionId,
          bankReferenceId: row.bankReferenceId || row.bankRef || null,
          merchantId: row.merchantId || row.merchant || 'UNKNOWN',
          amount: amount,
          currency: row.currency || 'USD',
          paymentMethod: row.paymentMethod || 'card',
          timestamp: timestamp,
          status: (row.status || 'success').toLowerCase(),
          reconciliationStatus: 'unmatched',
        };
      } catch (e) {
        rejectedRows.push({ rowNumber: rowNum, reason: e.message });
        return null;
      }
    }).filter(doc => doc !== null);

    if (docs.length === 0) {
      return res.status(400).json({ 
        message: 'No valid transactions found in CSV',
        rejectedRows 
      });
    }

    // Check for duplicates
    let duplicates = 0;
    const duplicateRows = [];
    const created = [];
    for (const doc of docs) {
      const exists = await Transaction.findOne({ transactionId: doc.transactionId });
      if (!exists) {
        const result = await Transaction.create(doc);
        created.push(result);
      } else {
        duplicates++;
        duplicateRows.push({ value: doc.transactionId, reason: 'Duplicate transactionId' });
      }
    }

    await log({ action: 'transactions.upload', userId: req.user ? req.user.id : null, details: { parsed: data.length, created: created.length, duplicates, rejected: rejectedRows.length }, ip: req.ip });
    
    return res.json({ 
      message: 'Transactions uploaded', 
      parsed: data.length, 
      created: created.length, 
      duplicates,
      rejectedRows,
      duplicateRows 
    });
  } catch (err) {
    console.error('upload transactions error', err);
    return res.status(500).json({ message: 'Failed to upload transactions', error: err.message });
  }
};

/**
 * Download transactions as CSV
 * GET /api/transactions/download
 */
exports.download = async (req, res) => {
  try {
    const docs = await Transaction.find().limit(2000);
    if (!docs || docs.length === 0) return res.status(400).json({ message: 'No transactions to download' });

    const headers = ['transactionId', 'bankReferenceId', 'merchantId', 'amount', 'currency', 'paymentMethod', 'timestamp', 'status'];
    const rows = docs.map(d => headers.map(h => {
      let v = d[h];
      if (h === 'timestamp' && v) v = new Date(v).toISOString();
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    }));

    const csv = [headers.join(',')].concat(rows.map(r => r.join(','))).join('\n');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
    res.setHeader('Content-Type', 'text/csv');
    return res.send(csv);
  } catch (err) {
    console.error('transactions download error', err);
    return res.status(500).json({ message: 'Failed to generate CSV' });
  }
};

/**
 * Get all transactions
 * GET /api/transactions
 */
exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    
    const docs = await Transaction.find()
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10));

    const total = await Transaction.countDocuments();
    return res.json({ total, page: parseInt(page, 10), limit: parseInt(limit, 10), data: docs });
  } catch (err) {
    console.error('getAll transactions error', err);
    return res.status(500).json({ message: 'Failed to fetch transactions' });
  }
};

/**
 * Delete all transactions
 * DELETE /api/transactions
 */
exports.deleteAll = async (req, res) => {
  try {
    const result = await Transaction.deleteMany({});
    await log({ action: 'transactions.deleteAll', userId: req.user ? req.user.id : null, details: { deleted: result.deletedCount }, ip: req.ip });
    return res.json({ message: 'All transactions deleted', deleted: result.deletedCount });
  } catch (err) {
    console.error('deleteAll transactions error', err);
    return res.status(500).json({ message: 'Failed to delete transactions' });
  }
};
