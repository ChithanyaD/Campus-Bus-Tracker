const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getUserStats,
  createUserValidation,
  updateUserValidation
} = require('../controllers/userController');

const {
  authenticateToken,
  requireAdmin,
  requireActiveUser
} = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);
router.use(requireActiveUser);

// Admin only routes
router.get('/stats', requireAdmin, getUserStats);
router.get('/', requireAdmin, getUsers);
router.post('/', requireAdmin, createUserValidation, createUser);

// Admin or own profile routes
router.get('/:id', getUser);
router.put('/:id', updateUserValidation, updateUser);
router.delete('/:id', requireAdmin, deleteUser);

module.exports = router;
