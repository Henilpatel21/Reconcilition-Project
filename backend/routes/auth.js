const express = require('express');
const router = express.Router();
const { register, login, me } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

/**
 * Register a new user
 * POST /api/auth/register
 */
router.post('/register', register);

/**
 * Login
 * POST /api/auth/login
 */
router.post('/login', login);

/**
 * Get current user (protected)
 */
router.get('/me', verifyToken, me);

module.exports = router;
