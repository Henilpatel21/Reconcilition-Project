const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { run, getMismatches, summary, download, deleteAll, history, deleteOne } = require('../controllers/reconcileController');

// Protected: run reconciliation
router.post('/', verifyToken, run);

// Protected: summary
router.get('/summary', verifyToken, summary);

// Protected: fetch mismatches (or all if showAll=true)
router.get('/mismatches', verifyToken, getMismatches);

// Protected: download reconciliation CSV
router.get('/download', verifyToken, download);

// Protected: delete all reconciliation results
router.delete('/all', verifyToken, deleteAll);

// Protected: list history of reconciliation runs
router.get('/history', verifyToken, history);

// Protected: delete a single reconciliation run
router.delete('/:id', verifyToken, deleteOne);

module.exports = router;
