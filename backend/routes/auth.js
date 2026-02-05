const express = require('express');
const router = express.Router();
const {
  login,
  register,
  getProfile,
  updateProfile,
  changePassword,
  verifyToken,
  loginValidation,
  registerValidation
} = require('../controllers/authController');

const {
  authenticateToken,
  requireActiveUser
} = require('../middleware/auth');

// Public routes
router.post('/login', loginValidation, login);
router.post('/register', registerValidation, register);

// Protected routes
router.get('/profile', authenticateToken, requireActiveUser, getProfile);
router.put('/profile', authenticateToken, requireActiveUser, updateProfile);
router.put('/change-password', authenticateToken, requireActiveUser, changePassword);
router.get('/verify', authenticateToken, verifyToken);

module.exports = router;
