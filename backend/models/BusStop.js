const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BusStop = sequelize.define('BusStop', {
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
  stopOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'stop_order',
    validate: {
      min: 1
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
  estimatedArrivalTime: {
    type: DataTypes.TIME,
    allowNull: true,
    field: 'estimated_arrival_time'
  }
}, {
  tableName: 'bus_stops',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['route_id'] },
    { fields: ['route_id', 'stop_order'], unique: true },
    { fields: ['latitude', 'longitude'] }
  ]
});

// Associations
BusStop.associate = (models) => {
  BusStop.belongsTo(models.Route, {
    foreignKey: 'routeId',
    as: 'route',
    onDelete: 'CASCADE'
  });
};

// Instance methods
BusStop.prototype.getCoordinates = function() {
  return {
    lat: parseFloat(this.latitude),
    lng: parseFloat(this.longitude)
  };
};

BusStop.prototype.calculateDistanceTo = function(lat, lng) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = this.toRadians(lat - parseFloat(this.latitude));
  const dLng = this.toRadians(lng - parseFloat(this.longitude));

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(this.toRadians(this.latitude)) * Math.cos(this.toRadians(lat)) *
    Math.sin(dLng/2) * Math.sin(dLng/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 1000; // Return distance in meters
};

BusStop.prototype.toRadians = function(degrees) {
  return degrees * (Math.PI / 180);
};

// Static methods
BusStop.findByRouteId = function(routeId) {
  return this.findAll({
    where: { routeId },
    order: [['stopOrder', 'ASC']]
  });
};

BusStop.findNextStop = function(routeId, currentLat, currentLng) {
  return this.findAll({
    where: { routeId },
    order: [['stopOrder', 'ASC']]
  }).then(stops => {
    if (!stops || stops.length === 0) return null;

    let nextStop = null;
    let minDistance = Infinity;

    stops.forEach(stop => {
      const distance = stop.calculateDistanceTo(currentLat, currentLng);
      if (distance < minDistance && distance > 100) { // At least 100m away
        minDistance = distance;
        nextStop = stop;
      }
    });

    return nextStop;
  });
};

BusStop.validateStopOrder = async function(routeId, stopOrder, excludeId = null) {
  const whereClause = { routeId, stopOrder };
  if (excludeId) {
    whereClause.id = { [require('sequelize').Op.ne]: excludeId };
  }

  const existingStop = await this.findOne({ where: whereClause });
  if (existingStop) {
    throw new Error(`Stop order ${stopOrder} already exists for this route`);
  }
};

module.exports = BusStop;
