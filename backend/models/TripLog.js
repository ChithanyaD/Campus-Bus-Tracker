const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TripLog = sequelize.define('TripLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  busId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'bus_id',
    references: {
      model: 'buses',
      key: 'id'
    }
  },
  driverId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'driver_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  routeId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'route_id',
    references: {
      model: 'routes',
      key: 'id'
    }
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'started_at'
  },
  endedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'ended_at'
  },
  totalDistanceKm: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'total_distance_km',
    validate: {
      min: 0
    }
  },
  totalDurationMinutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'total_duration_minutes',
    validate: {
      min: 0
    }
  },
  averageSpeedKmh: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    field: 'average_speed_kmh',
    validate: {
      min: 0
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'cancelled'),
    defaultValue: 'active'
  }
}, {
  tableName: 'trip_logs',
  timestamps: true,
  createdAt: 'created_at',
  indexes: [
    { fields: ['bus_id'] },
    { fields: ['driver_id'] },
    { fields: ['route_id'] },
    { fields: ['status'] },
    { fields: ['started_at', 'ended_at'] }
  ]
});

// Associations
TripLog.associate = (models) => {
  TripLog.belongsTo(models.Bus, {
    foreignKey: 'busId',
    as: 'bus',
    onDelete: 'CASCADE'
  });

  TripLog.belongsTo(models.User, {
    foreignKey: 'driverId',
    as: 'driver'
  });

  TripLog.belongsTo(models.Route, {
    foreignKey: 'routeId',
    as: 'route'
  });

  TripLog.hasMany(models.LocationHistory, {
    foreignKey: 'tripLogId',
    as: 'locationHistory'
  });
};

// Instance methods
TripLog.prototype.endTrip = async function(endData = {}) {
  if (this.status !== 'active') {
    throw new Error('Trip is not active');
  }

  this.endedAt = new Date();
  this.status = 'completed';

  if (endData.totalDistanceKm) {
    this.totalDistanceKm = endData.totalDistanceKm;
  }

  if (this.startedAt && this.endedAt) {
    this.totalDurationMinutes = Math.round(
      (this.endedAt - this.startedAt) / (1000 * 60)
    );
  }

  if (endData.averageSpeedKmh) {
    this.averageSpeedKmh = endData.averageSpeedKmh;
  } else if (this.totalDistanceKm && this.totalDurationMinutes) {
    this.averageSpeedKmh = parseFloat(
      (this.totalDistanceKm / (this.totalDurationMinutes / 60)).toFixed(2)
    );
  }

  return await this.save();
};

TripLog.prototype.cancelTrip = async function() {
  if (this.status !== 'active') {
    throw new Error('Trip is not active');
  }

  this.endedAt = new Date();
  this.status = 'cancelled';

  return await this.save();
};

TripLog.prototype.getDuration = function() {
  if (!this.startedAt) return 0;

  const endTime = this.endedAt || new Date();
  return Math.round((endTime - this.startedAt) / (1000 * 60)); // minutes
};

// Static methods
TripLog.findActiveTrips = function() {
  return this.findAll({
    where: { status: 'active' },
    include: [
      {
        model: require('./Bus'),
        as: 'bus',
        attributes: ['busNumber', 'busName']
      },
      {
        model: require('./User'),
        as: 'driver',
        attributes: ['name']
      },
      {
        model: require('./Route'),
        as: 'route',
        attributes: ['name']
      }
    ],
    order: [['startedAt', 'DESC']]
  });
};

TripLog.findByBusId = function(busId, limit = 10) {
  return this.findAll({
    where: { busId },
    include: [
      {
        model: require('./Route'),
        as: 'route',
        attributes: ['name']
      }
    ],
    order: [['startedAt', 'DESC']],
    limit
  });
};

TripLog.findByDriverId = function(driverId, limit = 10) {
  return this.findAll({
    where: { driverId },
    include: [
      {
        model: require('./Bus'),
        as: 'bus',
        attributes: ['busNumber', 'busName']
      },
      {
        model: require('./Route'),
        as: 'route',
        attributes: ['name']
      }
    ],
    order: [['startedAt', 'DESC']],
    limit
  });
};

TripLog.getTripStats = async function(busId = null, driverId = null, startDate = null, endDate = null) {
  const whereClause = { status: 'completed' };

  if (busId) whereClause.busId = busId;
  if (driverId) whereClause.driverId = driverId;
  if (startDate || endDate) {
    whereClause.startedAt = {};
    if (startDate) whereClause.startedAt[require('sequelize').Op.gte] = startDate;
    if (endDate) whereClause.startedAt[require('sequelize').Op.lte] = endDate;
  }

  const trips = await this.findAll({ where: whereClause });

  const stats = {
    totalTrips: trips.length,
    totalDistance: 0,
    totalDuration: 0,
    averageSpeed: 0
  };

  trips.forEach(trip => {
    if (trip.totalDistanceKm) stats.totalDistance += parseFloat(trip.totalDistanceKm);
    if (trip.totalDurationMinutes) stats.totalDuration += trip.totalDurationMinutes;
  });

  if (stats.totalTrips > 0) {
    stats.averageSpeed = stats.totalDistance / (stats.totalDuration / 60);
  }

  return stats;
};

module.exports = TripLog;
