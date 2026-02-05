const { body, param, validationResult } = require('express-validator');
const { User } = require('../models');

// Validation rules
const createUserValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters'),
  body('role')
    .isIn(['admin', 'driver', 'passenger'])
    .withMessage('Role must be admin, driver, or passenger'),
  body('phone')
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please provide a valid phone number')
];

const updateUserValidation = [
  param('id').isUUID().withMessage('Invalid user ID'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters'),
  body('phone')
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please provide a valid phone number'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

// @desc    Get all users
// @route   GET /api/users
// @access  Admin only
const getUsers = async (req, res) => {
  try {
    const { role, isActive } = req.query;

    let whereClause = {};

    if (role) {
      whereClause.role = role;
    }

    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: { exclude: ['passwordHash'] },
      order: [['name', 'ASC']]
    });

    res.json({
      users,
      count: users.length
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch users'
    });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Admin, or own profile
const getUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;

    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view your own profile'
      });
    }

    const user = await User.findByPk(id, {
      attributes: { exclude: ['passwordHash'] }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No user found with the specified ID'
      });
    }

    res.json({ user });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch user'
    });
  }
};

// @desc    Create new user
// @route   POST /api/users
// @access  Admin only
const createUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password, name, role, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email already exists'
      });
    }

    // Hash password
    const passwordHash = await User.hashPassword(password);

    // Create user
    const user = await User.create({
      email,
      passwordHash,
      name,
      role,
      phone
    });

    // Return user data without password
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive
    };

    res.status(201).json({
      message: 'User created successfully',
      user: userData
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create user'
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Admin, or own profile (limited fields)
const updateUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { name, phone, isActive } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No user found with the specified ID'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only update your own profile'
      });
    }

    // Non-admin users can only update name and phone
    if (req.user.role !== 'admin' && req.user.id === id) {
      if (name) user.name = name;
      if (phone !== undefined) user.phone = phone;
    } else if (req.user.role === 'admin') {
      // Admins can update everything
      if (name) user.name = name;
      if (phone !== undefined) user.phone = phone;
      if (isActive !== undefined) user.isActive = isActive;
    }

    await user.save();

    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive
    };

    res.json({
      message: 'User updated successfully',
      user: userData
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update user'
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Admin only
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting own account
    if (req.user.id === id) {
      return res.status(400).json({
        error: 'Cannot delete own account',
        message: 'You cannot delete your own user account'
      });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No user found with the specified ID'
      });
    }

    // Check if user is assigned to a bus (drivers only)
    if (user.role === 'driver') {
      const { Bus } = require('../models');
      const assignedBus = await Bus.findOne({ where: { driverId: id } });
      if (assignedBus) {
        return res.status(400).json({
          error: 'Cannot delete assigned driver',
          message: 'Please unassign the driver from their bus first'
        });
      }
    }

    await user.destroy();

    res.json({
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete user'
    });
  }
};

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Admin only
const getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { isActive: true } });
    const adminCount = await User.count({ where: { role: 'admin', isActive: true } });
    const driverCount = await User.count({ where: { role: 'driver', isActive: true } });
    const passengerCount = await User.count({ where: { role: 'passenger', isActive: true } });

    res.json({
      stats: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        byRole: {
          admin: adminCount,
          driver: driverCount,
          passenger: passengerCount
        }
      }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch user statistics'
    });
  }
};

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getUserStats,
  createUserValidation,
  updateUserValidation
};
