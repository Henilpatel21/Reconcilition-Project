const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { log } = require('../utils/logger');

/**
 * Helper: sign JWT for a user
 * @param {Object} user
 */
function signToken(user) {
  const payload = { id: user._id, role: user.role, email: user.email };
  const secret = process.env.JWT_SECRET || 'secret_dev';
  const opts = { expiresIn: '8h' };
  return jwt.sign(payload, secret, opts);
}

/**
 * Register controller
 * Validates input, prevents duplicate emails, creates user, returns token + user
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    const user = new User({ name, email: email.toLowerCase(), password, role });
    await user.save();

    const token = signToken(user);

    // TODO: Add audit log for user registration
    await log({ action: 'user.register', userId: user._id, details: { email: user.email }, ip: req.ip });
    // TODO: integrate GenAI to generate welcome / contextual messages

    return res.status(201).json({ token, user: user.toJSON() });
  } catch (err) {
    console.error('Register error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Login controller
 * Validates credentials and returns token
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken(user);

    await log({ action: 'user.login', userId: user._id, details: { email: user.email }, ip: req.ip });

    return res.json({ token, user: user.toJSON() });
  } catch (err) {
    console.error('Login error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get current user
 */
exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ user });
  } catch (err) {
    console.error('Me error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
