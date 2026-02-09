const Transaction = require('../models/Transaction');
const BankStatement = require('../models/BankStatement');
const SettlementRecord = require('../models/SettlementRecord');
const ReconciliationResult = require('../models/ReconciliationResult');
const { log } = require('../utils/logger');

/**
 * Three-Level Matching Algorithm
 * Level 1: Reference ID Match (highest priority, 100% certain)
 * Level 2: Three-Way Match (merchantId + amount + date within 2 days)
 * Level 3: Fuzzy Match (amount + merchant, needs manual review)
 */

/**
 * Helper: determine if two amounts are equal (within 1 cent tolerance)
 */
function amountsMatch(a1, a2, tolerance = 0.01) {
  return Math.abs(a1 - a2) <= tolerance;
}

/**
 * Helper: determine if two dates are within N days
 */
function withinDays(d1, d2, days = 2) {
  if (!d1 || !d2) return false;
  try {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return false;
    const diff = Math.abs(date1.getTime() - date2.getTime());
    return diff <= days * 24 * 60 * 60 * 1000;
  } catch (e) {
    return false;
  }
}

/**
 * Level 1: Match by bankReferenceId (reference ID from bank)
 */
function matchByReference(transaction, bankStatements, usedStatements) {
  if (!transaction.bankReferenceId) return null;
  
  for (const stmt of bankStatements) {
    if (usedStatements.has(stmt._id.toString())) continue;
    if (stmt.bankReferenceId === transaction.bankReferenceId) {
      // Verify amount matches too (safety check)
      if (amountsMatch(transaction.amount, stmt.amount)) {
        return { statement: stmt, matchType: 'reference', confidence: 1.0 };
      }
    }
  }
  return null;
}

/**
 * Level 2: Match by three-way (merchantId + amount + date within 2 days)
 */
function matchByThreeWay(transaction, bankStatements, usedStatements) {
  const candidates = [];
  
  for (const stmt of bankStatements) {
    if (usedStatements.has(stmt._id.toString())) continue;
    
    const merchantMatches = stmt.merchantAccountId === transaction.merchantId;
    const amountMatches = amountsMatch(transaction.amount, stmt.amount);
    const dateMatches = withinDays(transaction.timestamp, stmt.settlementDate, 2);
    
    if (merchantMatches && amountMatches && dateMatches) {
      candidates.push({ statement: stmt, matchType: 'threeway', confidence: 0.95 });
    }
  }
  
  // Return best match (by closest date)
  if (candidates.length === 1) {
    return candidates[0];
  } else if (candidates.length > 1) {
    // Multiple matches - return as partial for manual review
    return { statement: candidates[0].statement, matchType: 'partial', confidence: 0.8, count: candidates.length };
  }
  
  return null;
}

/**
 * Level 3: Fuzzy match (amount + merchant, needs review)
 */
function matchByFuzzy(transaction, bankStatements, usedStatements) {
  const candidates = [];
  
  for (const stmt of bankStatements) {
    if (usedStatements.has(stmt._id.toString())) continue;
    
    const merchantMatches = stmt.merchantAccountId === transaction.merchantId;
    const amountMatches = amountsMatch(transaction.amount, stmt.amount);
    
    if (merchantMatches && amountMatches) {
      candidates.push({ statement: stmt, matchType: 'fuzzy', confidence: 0.6 });
    }
  }
  
  if (candidates.length === 1) {
    return candidates[0];
  } else if (candidates.length > 1) {
    return { statement: candidates[0].statement, matchType: 'fuzzy', confidence: 0.6, count: candidates.length };
  }
  
  return null;
}

/**
 * Handle special cases
 */
function handleSpecialCases(transaction, bankStatements, usedStatements) {
  // Handle FAILED transactions (should not be reconciled to cleared settlements)
  if (transaction.status === 'failed') {
    return { matchType: 'failed_transaction', status: 'review', reason: 'Failed transaction - should not match cleared settlement' };
  }
  
  // Handle PENDING transactions (can match pending settlements)
  if (transaction.status === 'pending') {
    const pendingStatements = bankStatements.filter(s => s.status === 'pending');
    if (pendingStatements.length > 0) {
      return { matchType: 'pending_match', statement: pendingStatements[0], status: 'partial' };
    }
  }
  
  return null;
}

/**
 * Detect duplicate bank statements
 */
function detectDuplicates(bankStatements) {
  const amountMap = {};
  const duplicates = [];
  
  for (const stmt of bankStatements) {
    try {
      // Safely handle missing or invalid dates
      let dateStr = 'NODATE';
      if (stmt.settlementDate) {
        const d = new Date(stmt.settlementDate);
        if (!isNaN(d.getTime())) {
          dateStr = d.toDateString();
        }
      }
      const merchantId = stmt.merchantAccountId || 'UNKNOWN';
      const amount = stmt.amount || 0;
      const key = `${merchantId}||${amount}||${dateStr}`;
      
      if (amountMap[key]) {
        duplicates.push({
          statement1: amountMap[key],
          statement2: stmt,
          reason: 'Same merchant + amount + date'
        });
      } else {
        amountMap[key] = stmt;
      }
    } catch (e) {
      // Skip statements that cause errors
      console.error('Error processing statement in detectDuplicates:', e.message);
    }
  }
  
  return duplicates;
}

/**
 * Run advanced reconciliation
 * POST /api/reconcile
 */
exports.run = async (req, res) => {
  try {
    // Clear old results
    await ReconciliationResult.deleteMany({});

    // Load transactions and bank statements
    let transactions = await Transaction.find().lean();
    let bankStatements = await BankStatement.find().lean();

    // Ensure arrays (in case of null)
    transactions = transactions || [];
    bankStatements = bankStatements || [];

    // Filter out invalid documents
    transactions = transactions.filter(t => t && t.transactionId);
    bankStatements = bankStatements.filter(b => b && b.bankReferenceId);

    if (transactions.length === 0) {
      return res.status(400).json({ message: 'No transactions to reconcile. Please generate mock transactions first.' });
    }

    if (bankStatements.length === 0) {
      return res.status(400).json({ message: 'No bank statements to reconcile. Please generate or upload bank statements first.' });
    }

    // Track used statements
    const usedStatements = new Set();
    const results = [];
    const summary = {
      total_transactions: transactions.length,
      matched: 0,
      partial: 0,
      unmatched: 0,
      duplicate: 0,
      failed: 0,
      review: 0,
      matches_by_type: {
        reference: 0,
        threeway: 0,
        fuzzy: 0,
        manual: 0,
        failed_transaction: 0,
        pending_match: 0
      }
    };

    // helper to safely increment match type counters
    const incMatchType = (t) => {
      if (!t) return;
      if (!summary.matches_by_type[t]) summary.matches_by_type[t] = 0;
      summary.matches_by_type[t]++;
    };

    // Detect duplicates first
    let duplicates = [];
    let duplicateStatementIds = new Set();
    try {
      duplicates = detectDuplicates(bankStatements);
      // store duplicate IDs as strings to avoid object-identity comparison issues
      duplicateStatementIds = new Set(duplicates.flatMap(d => [String(d.statement1._id), String(d.statement2._id)]));
    } catch (dupErr) {
      console.error('Error detecting duplicates:', dupErr);
      // Continue without duplicate detection
    }

    // Process each transaction with safety wrapper
    for (const txn of transactions) {
      try {
        let result = {
          transactionId: txn.transactionId,
          transactionAmount: txn.amount || 0,
          transactionStatus: txn.status || 'unknown',
          reconciliationStatus: 'unmatched',
          matchType: null,
          matchedStatementId: null,
          matchedAmount: null,
          confidence: 0,
          reason: '',
          requiresReview: false
        };

      // Handle special cases first
      const special = handleSpecialCases(txn, bankStatements, usedStatements);
      if (special) {
        result.reconciliationStatus = special.status || 'review';
        result.matchType = special.matchType;
        result.reason = special.reason || '';
        result.requiresReview = true;
        // ensure summary bucket exists
        const statusKey = special.status || 'review';
        if (typeof summary[statusKey] === 'undefined') summary[statusKey] = 0;
        summary[statusKey]++;
        incMatchType(special.matchType);
        results.push(result);
        continue;
      }

      // Try Level 1: Reference Match
      let match = matchByReference(txn, bankStatements, usedStatements);
      if (match) {
        result.reconciliationStatus = 'matched';
        result.matchType = 'reference';
        result.matchedStatementId = match.statement._id;
        result.matchedAmount = match.statement.amount;
        result.confidence = match.confidence;
        result.reason = 'Perfect match by bank reference ID';
        usedStatements.add(String(match.statement._id));
        summary.matched++;
        incMatchType('reference');
        
        // Update transaction and statement
        await Transaction.updateOne({ _id: txn._id }, { 
          reconciliationStatus: 'matched', 
          matchedSettlementId: match.statement._id,
          matchType: 'reference'
        });
        await BankStatement.updateOne({ _id: match.statement._id }, { 
          reconciliationStatus: 'matched',
          matchedTransactionId: txn._id,
          matchType: 'reference'
        });
        
        results.push(result);
        continue;
      }

      // Try Level 2: Three-Way Match
      match = matchByThreeWay(txn, bankStatements, usedStatements);
      if (match) {
        if (match.matchType === 'partial' || match.count > 1) {
          result.reconciliationStatus = 'partial';
          result.reason = `Multiple potential matches (${match.count}). Needs manual review.`;
          result.requiresReview = true;
          summary.partial++;
        } else {
          result.reconciliationStatus = 'matched';
          result.reason = 'Three-way match: merchant + amount + date within 2 days';
          summary.matched++;
        }
        
        result.matchType = match.matchType;
        result.matchedStatementId = match.statement._id;
        result.matchedAmount = match.statement.amount;
        result.confidence = match.confidence;
        usedStatements.add(match.statement._id.toString());
        incMatchType('threeway');
        
        // Update records
        await Transaction.updateOne({ _id: txn._id }, { 
          reconciliationStatus: result.reconciliationStatus, 
          matchedSettlementId: match.statement._id,
          matchType: match.matchType
        });
        await BankStatement.updateOne({ _id: match.statement._id }, { 
          reconciliationStatus: result.reconciliationStatus,
          matchedTransactionId: txn._id,
          matchType: match.matchType
        });
        
        results.push(result);
        continue;
      }

      // Try Level 3: Fuzzy Match
      match = matchByFuzzy(txn, bankStatements, usedStatements);
      if (match) {
        if (match.count > 1) {
          result.reconciliationStatus = 'review';
          result.reason = `Multiple fuzzy matches (${match.count}). Requires manual review.`;
          result.requiresReview = true;
          summary.review++;
        } else {
          result.reconciliationStatus = 'partial';
          result.reason = 'Fuzzy match: merchant + amount, but date mismatch. Requires review.';
          result.requiresReview = true;
          summary.partial++;
        }
        
        result.matchType = match.matchType;
        result.matchedStatementId = match.statement._id;
        result.matchedAmount = match.statement.amount;
        result.confidence = match.confidence;
        usedStatements.add(String(match.statement._id));
        incMatchType('fuzzy');
        
        // Update records
        await Transaction.updateOne({ _id: txn._id }, { 
          reconciliationStatus: result.reconciliationStatus, 
          matchedSettlementId: match.statement._id,
          matchType: match.matchType
        });
        await BankStatement.updateOne({ _id: match.statement._id }, { 
          reconciliationStatus: result.reconciliationStatus,
          matchedTransactionId: txn._id,
          matchType: match.matchType
        });
        
        results.push(result);
        continue;
      }

      // No match found
      result.reconciliationStatus = 'unmatched';
      result.reason = 'No matching bank statement found';
      summary.unmatched++;
      
      await Transaction.updateOne({ _id: txn._id }, { reconciliationStatus: 'unmatched' });
      results.push(result);
      } catch (txnErr) {
        console.error(`Error processing transaction ${txn.transactionId}:`, txnErr);
        // Still push a result for this transaction
        results.push({
          transactionId: txn.transactionId || 'UNKNOWN',
          transactionAmount: txn.amount || 0,
          transactionStatus: txn.status || 'unknown',
          reconciliationStatus: 'review',
          matchType: null,
          confidence: 0,
          reason: `Processing error: ${txnErr.message}`,
          requiresReview: true
        });
        summary.review++;
      }
    }

    // Mark unmatched bank statements
    for (const stmt of bankStatements) {
      if (!usedStatements.has(String(stmt._id))) {
        if (duplicateStatementIds.has(String(stmt._id))) {
          await BankStatement.updateOne({ _id: stmt._id }, { reconciliationStatus: 'duplicate' });
          summary.duplicate++;
        } else {
          await BankStatement.updateOne({ _id: stmt._id }, { reconciliationStatus: 'unmatched' });
          summary.unmatched++;
        }
      }
    }

    // Save reconciliation result
    const reconcResult = new ReconciliationResult({
      runDate: new Date(),
      summary,
      details: results
    });
    await reconcResult.save();

    await log({ action: 'reconcile.run', userId: req.user ? req.user.id : null, details: summary, ip: req.ip });

    return res.json({
      message: 'Reconciliation completed',
      summary,
      matched_count: summary.matched,
      partial_count: summary.partial,
      unmatched_count: summary.unmatched,
      requires_review: summary.partial + summary.review,
      total: results.length
    });
  } catch (err) {
    console.error('Reconciliation error', err);
    return res.status(500).json({ message: 'Failed to run reconciliation', error: err.message });
  }
};

/**
 * Get reconciliation summary
 * GET /api/reconcile/summary
 */
exports.summary = async (req, res) => {
  try {
    const latest = await ReconciliationResult.findOne().sort({ runDate: -1 });
    if (!latest) {
      return res.status(404).json({ message: 'No reconciliation results found' });
    }
    return res.json(latest.summary);
  } catch (err) {
    console.error('summary error', err);
    return res.status(500).json({ message: 'Failed to fetch summary' });
  }
};

/**
 * Get unmatched and partial matches (items requiring review)
 * GET /api/reconcile/mismatches
 */
exports.getMismatches = async (req, res) => {
  try {
    const latest = await ReconciliationResult.findOne().sort({ runDate: -1 });
    if (!latest) {
      return res.status(404).json({ message: 'No reconciliation results found' });
    }

    // Normalize showAll param to boolean (accepts 'true'/'false' or boolean)
    const rawShow = req.query.showAll;
    const showAll = rawShow === true || String(rawShow).toLowerCase() === 'true';

    // If requesting all, return full details (including matched)
    let items;
    if (showAll) {
      items = latest.details;
    } else {
      // Start with non-matched items and then filter to those that require review or are unmatched
      items = latest.details.filter(d => d.reconciliationStatus !== 'matched');
      items = items.filter(d => d.requiresReview || d.reconciliationStatus === 'unmatched');
    }

    return res.json({ count: items.length, items });
  } catch (err) {
    console.error('getMismatches error', err);
    return res.status(500).json({ message: 'Failed to fetch mismatches' });
  }
};

/**
 * Download reconciliation report as CSV
 * GET /api/reconcile/download
 */
exports.download = async (req, res) => {
  try {
    const latest = await ReconciliationResult.findOne().sort({ runDate: -1 });
    if (!latest) {
      return res.status(404).json({ message: 'No reconciliation results found' });
    }

    const headers = ['transactionId', 'transactionAmount', 'transactionStatus', 'reconciliationStatus', 'matchType', 'matchedAmount', 'confidence', 'reason'];
    const rows = latest.details.map(d => headers.map(h => {
      let v = d[h];
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    }));

    const csv = [headers.join(',')].concat(rows.map(r => r.join(','))).join('\n');
    
    res.setHeader('Content-Disposition', 'attachment; filename="reconciliation_report.csv"');
    res.setHeader('Content-Type', 'text/csv');
    return res.send(csv);
  } catch (err) {
    console.error('download error', err);
    return res.status(500).json({ message: 'Failed to download report' });
  }
};

/**
 * DELETE /api/reconcile/all
 * Delete all reconciliation results
 */
exports.deleteAll = async (req, res) => {
  try {
    await ReconciliationResult.deleteMany({});
    await log({ action: 'reconcile.deleteAll', userId: req.user ? req.user.id : null, details: { message: 'Deleted all reconciliation results' }, ip: req.ip });
    return res.json({ message: 'All reconciliation results deleted', deleted: true });
  } catch (err) {
    console.error('deleteAll error', err);
    return res.status(500).json({ message: 'Failed to delete reconciliation results' });
  }
};

/**
 * GET /api/reconcile/history
 * List past reconciliation runs (summary per run)
 * Query: limit (default 5, max 100), offset (default 0)
 */
exports.history = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || 5), 100); // default 5, max 100
    const offset = parseInt(req.query.offset || 0);
    
    const total = await ReconciliationResult.countDocuments();
    const results = await ReconciliationResult.find().sort({ runDate: -1 }).skip(offset).limit(limit).lean();
    const items = results.map(r => ({ id: r._id, runDate: r.runDate, summary: r.summary }));
    
    return res.json({ total, limit, offset, items });
  } catch (err) {
    console.error('history error', err);
    return res.status(500).json({ message: 'Failed to fetch reconciliation history' });
  }
};

/**
 * DELETE /api/reconcile/:id
 * Delete a single reconciliation run by id
 */
exports.deleteOne = async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await ReconciliationResult.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Reconciliation result not found' });
    await log({ action: 'reconcile.deleteOne', userId: req.user ? req.user.id : null, details: { id }, ip: req.ip });
    return res.json({ message: 'Deleted reconciliation result', id });
  } catch (err) {
    console.error('deleteOne error', err);
    return res.status(500).json({ message: 'Failed to delete reconciliation result' });
  }
};
