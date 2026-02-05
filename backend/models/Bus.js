const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Bus = sequelize.define('Bus', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  busNumber: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    field: 'bus_number',
    validate: {
      notEmpty: true,
      len: [1, 20]
    }
  },
  busName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'bus_name'
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 50,
    validate: {
      min: 1,
      max: 200
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  driverId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'driver_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  currentRouteId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'current_route_id',
    references: {
      model: 'routes',
      key: 'id'
    }
  }
}, {
  tableName: 'buses',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['bus_number'] },
    { fields: ['driver_id'] },
    { fields: ['is_active'] },
    { fields: ['current_route_id'] }
  ]
});

// Associations
Bus.associate = (models) => {
  Bus.belongsTo(models.User, {
    foreignKey: 'driverId',
    as: 'driver',
    constraints: false
  });

  Bus.belongsTo(models.Route, {
    foreignKey: 'currentRouteId',
    as: 'currentRoute',
    constraints: false
  });

  Bus.hasMany(models.LiveBusLocation, {
    foreignKey: 'busId',
    as: 'liveLocation'
  });

  Bus.hasMany(models.TripLog, {
    foreignKey: 'busId',
    as: 'tripLogs'
  });
};

// Instance methods
Bus.prototype.getStatus = function() {
  if (!this.isActive) return 'inactive';
  if (this.driverId) return 'assigned';
  return 'available';
};

Bus.prototype.assignDriver = async function(driverId) {
  // Check if driver exists and is active
  const User = require('./User');
  const driver = await User.findOne({
    where: { id: driverId, role: 'driver', isActive: true }
  });

  if (!driver) {
    throw new Error('Invalid driver or driver not active');
  }

  // Check if driver is already assigned to another bus
  const existingBus = await Bus.findOne({
    where: { driverId: driverId, isActive: true }
  });

  if (existingBus && existingBus.id !== this.id) {
    throw new Error('Driver is already assigned to another bus');
  }

  this.driverId = driverId;
  return await this.save();
};

Bus.prototype.unassignDriver = async function() {
  this.driverId = null;
  return await this.save();
};

// Static methods
Bus.findByBusNumber = function(busNumber) {
  return this.findOne({ where: { busNumber } });
};

Bus.findActive = function() {
  return this.findAll({
    where: { isActive: true },
    include: [{
      model: require('./User'),
      as: 'driver',
      attributes: ['id', 'name', 'email']
    }]
  });
};

Bus.findAvailable = function() {
  return this.findAll({
    where: {
      isActive: true,
      driverId: null
    }
  });
};

module.exports = Bus;
