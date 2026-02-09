const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { verifyToken } = require('../middleware/auth');
const { upload: uploadController, download, list: listController, deleteAll } = require('../controllers/settlementController');

/**
 * Protected: upload settlement CSV/XLS
 */
router.post('/upload', verifyToken, upload.single('file'), uploadController);

/**
 * Protected: download settlements as CSV
 */
router.get('/download', verifyToken, download);

/**
 * Get settlement records
 */
router.get('/', verifyToken, listController);

/**
 * Protected: delete all settlement records
 */
router.delete('/', verifyToken, deleteAll);

module.exports = router;
