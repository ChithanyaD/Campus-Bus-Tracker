const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LocationHistory = sequelize.define('LocationHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tripLogId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'trip_log_id',
    references: {
      model: 'trip_logs',
      key: 'id'
    }
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
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false,
    validate: {
      min: -90,
      max: 90
    }
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false,
    validate: {
      min: -180,
      max: 180
    }
  },
  speedKmh: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    field: 'speed_kmh',
    validate: {
      min: 0
    }
  },
  heading: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    field: 'heading',
    validate: {
      min: 0,
      max: 360
    }
  },
  accuracyMeters: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
    field: 'accuracy_meters',
    validate: {
      min: 0
    }
  }
}, {
  tableName: 'location_history',
  timestamps: true,
  createdAt: 'recorded_at',
  updatedAt: false,
  indexes: [
    { fields: ['trip_log_id'] },
    { fields: ['bus_id'] },
    { fields: ['recorded_at'] },
    { fields: ['latitude', 'longitude'] }
  ]
});

// Associations
LocationHistory.associate = (models) => {
  LocationHistory.belongsTo(models.TripLog, {
    foreignKey: 'tripLogId',
    as: 'tripLog',
    onDelete: 'CASCADE'
  });

  LocationHistory.belongsTo(models.Bus, {
    foreignKey: 'busId',
    as: 'bus'
  });
};

// Instance methods
LocationHistory.prototype.getCoordinates = function() {
  return {
    lat: parseFloat(this.latitude),
    lng: parseFloat(this.longitude)
  };
};

// Static methods
LocationHistory.findByTripLogId = function(tripLogId) {
  return this.findAll({
    where: { tripLogId },
    order: [['recordedAt', 'ASC']]
  });
};

LocationHistory.findByBusId = function(busId, limit = 100, startDate = null, endDate = null) {
  const whereClause = { busId };

  if (startDate || endDate) {
    whereClause.recordedAt = {};
    if (startDate) whereClause.recordedAt[require('sequelize').Op.gte] = startDate;
    if (endDate) whereClause.recordedAt[require('sequelize').Op.lte] = endDate;
  }

  return this.findAll({
    where: whereClause,
    order: [['recordedAt', 'DESC']],
    limit
  });
};

LocationHistory.getSpeedAnalytics = async function(busId, startDate, endDate) {
  const locations = await this.findAll({
    where: {
      busId,
      recordedAt: {
        [require('sequelize').Op.between]: [startDate, endDate]
      }
    },
    order: [['recordedAt', 'ASC']]
  });

  if (locations.length === 0) {
    return {
      averageSpeed: 0,
      maxSpeed: 0,
      minSpeed: 0,
      totalPoints: 0
    };
  }

  const speeds = locations
    .map(loc => loc.speedKmh ? parseFloat(loc.speedKmh) : 0)
    .filter(speed => speed > 0);

  return {
    averageSpeed: speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
    maxSpeed: speeds.length > 0 ? Math.max(...speeds) : 0,
    minSpeed: speeds.length > 0 ? Math.min(...speeds) : 0,
    totalPoints: locations.length
  };
};

module.exports = LocationHistory;
