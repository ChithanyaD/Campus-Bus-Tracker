const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
      notEmpty: true
    }
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash'
  },
  role: {
    type: DataTypes.ENUM('admin', 'driver', 'passenger'),
    allowNull: false,
    validate: {
      isIn: [['admin', 'driver', 'passenger']]
    }
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 255]
    }
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      is: /^[\+]?[1-9][\d]{0,15}$/
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['email'] },
    { fields: ['role'] },
    { fields: ['is_active'] }
  ]
});

// Instance methods
User.prototype.toJSON = function() {
  const values = { ...this.get() };
  delete values.passwordHash;
  return values;
};

User.prototype.checkPassword = async function(password) {
  const bcrypt = require('bcryptjs');
  return await bcrypt.compare(password, this.passwordHash);
};

User.prototype.generateAuthToken = function() {
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'college_bus_tracker_jwt_secret_key_2024_change_in_production';
  return jwt.sign(
    {
      id: this.id,
      email: this.email,
      role: this.role,
      name: this.name
    },
    secret,
    { expiresIn: process.env.JWT_EXPIRE || '24h' }
  );
};

// Static methods
User.findByEmail = function(email) {
  return this.findOne({ where: { email } });
};

User.findActiveById = function(id) {
  return this.findOne({ where: { id, isActive: true } });
};

User.hashPassword = async function(password) {
  const bcrypt = require('bcryptjs');
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

module.exports = User;
