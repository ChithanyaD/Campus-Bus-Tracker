const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Middleware to authenticate JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Authentication token required'
      });
    }

    const secret = process.env.JWT_SECRET || 'college_bus_tracker_jwt_secret_key_2024_change_in_production';
    const decoded = jwt.verify(token, secret);
    const user = await User.findActiveById(decoded.id);

    if (!user) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'User not found or inactive'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication token is invalid'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Authentication token has expired'
      });
    }

    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed'
    });
  }
};

// Middleware to check if user has required role(s)
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in to access this resource'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access denied',
        message: `This resource requires one of the following roles: ${roles.join(', ')}`
      });
    }

    next();
  };
};

// Middleware to check if user owns the resource or is admin
const requireOwnershipOrAdmin = (userIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in to access this resource'
      });
    }

    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.params[userIdField] || req.body[userIdField];

    if (!resourceUserId || resourceUserId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own resources'
      });
    }

    next();
  };
};

// Middleware for optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const secret = process.env.JWT_SECRET || 'college_bus_tracker_jwt_secret_key_2024_change_in_production';
      const decoded = jwt.verify(token, secret);
      const user = await User.findActiveById(decoded.id);

      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Ignore auth errors for optional auth
    next();
  }
};

// Middleware to check if user is active
const requireActiveUser = (req, res, next) => {
  if (!req.user || !req.user.isActive) {
    return res.status(403).json({
      error: 'Account inactive',
      message: 'Your account has been deactivated'
    });
  }

  next();
};

// Role-specific middleware shortcuts
const requireAdmin = requireRole('admin');
const requireDriver = requireRole('driver');
const requirePassenger = requireRole('passenger');
const requireDriverOrAdmin = requireRole('driver', 'admin');
const requirePassengerOrAdmin = requireRole('passenger', 'admin');

module.exports = {
  authenticateToken,
  requireRole,
  requireOwnershipOrAdmin,
  optionalAuth,
  requireActiveUser,
  requireAdmin,
  requireDriver,
  requirePassenger,
  requireDriverOrAdmin,
  requirePassengerOrAdmin
};
