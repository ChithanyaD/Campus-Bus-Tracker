const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Route = sequelize.define('Route', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  coordinates: {
    type: DataTypes.JSONB,
    allowNull: true,
    validate: {
      isValidCoordinates(value) {
        if (!value) return;
        if (!Array.isArray(value)) {
          throw new Error('Coordinates must be an array');
        }
        value.forEach(coord => {
          if (typeof coord !== 'object' || !coord.lat || !coord.lng) {
            throw new Error('Each coordinate must have lat and lng properties');
          }
          if (coord.lat < -90 || coord.lat > 90 || coord.lng < -180 || coord.lng > 180) {
            throw new Error('Invalid latitude or longitude values');
          }
        });
      }
    }
  },
  distanceKm: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'distance_km',
    validate: {
      min: 0
    }
  },
  estimatedDurationMinutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'estimated_duration_minutes',
    validate: {
      min: 0
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'routes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['is_active'] },
    { fields: ['name'] }
  ]
});

// Associations
Route.associate = (models) => {
  Route.hasMany(models.BusStop, {
    foreignKey: 'routeId',
    as: 'busStops',
    onDelete: 'CASCADE'
  });

  Route.hasMany(models.Bus, {
    foreignKey: 'currentRouteId',
    as: 'buses'
  });

  Route.hasMany(models.TripLog, {
    foreignKey: 'routeId',
    as: 'tripLogs'
  });
};

// Instance methods
Route.prototype.getBusStopsOrdered = function() {
  return this.getBusStops({
    order: [['stopOrder', 'ASC']]
  });
};

Route.prototype.calculateDistance = function() {
  if (!this.coordinates || this.coordinates.length < 2) {
    return 0;
  }

  let totalDistance = 0;
  for (let i = 0; i < this.coordinates.length - 1; i++) {
    const coord1 = this.coordinates[i];
    const coord2 = this.coordinates[i + 1];
    totalDistance += this.calculateHaversineDistance(coord1, coord2);
  }

  return totalDistance;
};

Route.prototype.calculateHaversineDistance = function(coord1, coord2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = this.toRadians(coord2.lat - coord1.lat);
  const dLon = this.toRadians(coord2.lng - coord1.lng);

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(this.toRadians(coord1.lat)) * Math.cos(this.toRadians(coord2.lat)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

Route.prototype.toRadians = function(degrees) {
  return degrees * (Math.PI / 180);
};

Route.prototype.getNextStop = function(currentLat, currentLng) {
  return this.getBusStops({
    order: [['stopOrder', 'ASC']]
  }).then(stops => {
    if (!stops || stops.length === 0) return null;

    let nearestStop = null;
    let minDistance = Infinity;

    stops.forEach(stop => {
      const distance = this.calculateHaversineDistance(
        { lat: currentLat, lng: currentLng },
        { lat: parseFloat(stop.latitude), lng: parseFloat(stop.longitude) }
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestStop = stop;
      }
    });

    return nearestStop;
  });
};

// Static methods
Route.findActive = function() {
  return this.findAll({
    where: { isActive: true },
    include: [{
      model: require('./BusStop'),
      as: 'busStops',
      order: [['stopOrder', 'ASC']]
    }]
  });
};

Route.findByName = function(name) {
  return this.findOne({ where: { name, isActive: true } });
};

module.exports = Route;
