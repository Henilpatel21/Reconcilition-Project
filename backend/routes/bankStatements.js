const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { verifyToken } = require('../middleware/auth');
const { generateMock, getAll, upload: uploadController, download, deleteAll } = require('../controllers/bankStatementController');

/**
 * Generate mock bank statements from transactions
 */
router.post('/generate-mock', verifyToken, generateMock);

/**
 * Get all bank statements
 */
router.get('/', verifyToken, getAll);

/**
 * Upload bank statements from CSV/Excel
 */
router.post('/upload', verifyToken, upload.single('file'), uploadController);

/**
 * Download bank statements as CSV
 */
router.get('/download', verifyToken, download);

/**
 * Delete all bank statements
 */
router.delete('/', verifyToken, deleteAll);

module.exports = router;
