const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { getLogs, deleteAll, deleteOne } = require('../controllers/auditController');

// Protected: get audit logs (supports ?action=...&limit=&offset=)
router.get('/logs', verifyToken, getLogs);

// Protected: delete all audit logs
router.delete('/all', verifyToken, deleteAll);

// Protected: delete single audit log by id
router.delete('/:id', verifyToken, deleteOne);

module.exports = router;
