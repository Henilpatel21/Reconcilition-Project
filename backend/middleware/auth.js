const jwt = require('jsonwebtoken');

/**
 * Verify JWT middleware
 * Attaches `req.user` with { id, role, email }
 */
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'secret_dev';

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

/**
 * Role-based authorization middleware factory
 * usage: authorize('admin','finance')
 */
exports.authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  return next();
};
