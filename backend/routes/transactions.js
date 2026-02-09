const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { generateMock, getAll, deleteAll, upload: uploadController, download } = require('../controllers/transactionController');
const { verifyToken } = require('../middleware/auth');

/**
 * Generate mock transactions
 */
router.post('/generate-mock', verifyToken, generateMock);

/**
 * Upload transactions from CSV
 */
router.post('/upload', verifyToken, upload.single('file'), uploadController);

/**
 * Download transactions as CSV
 */
router.get('/download', verifyToken, download);

/**
 * Get all transactions
 */
router.get('/', verifyToken, getAll);

/**
 * Delete all transactions
 */
router.delete('/', verifyToken, deleteAll);

module.exports = router;
