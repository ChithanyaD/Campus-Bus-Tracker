const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LiveBusLocation = sequelize.define('LiveBusLocation', {
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
  },
  isLocationSharing: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_location_sharing'
  },
  currentRouteId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'current_route_id',
    references: {
      model: 'routes',
      key: 'id'
    }
  },
  nextStopId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'next_stop_id',
    references: {
      model: 'bus_stops',
      key: 'id'
    }
  },
  distanceToNextStop: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'distance_to_next_stop',
    validate: {
      min: 0
    }
  },
  etaToNextStop: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'eta_to_next_stop'
  },
  tripStartedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'trip_started_at'
  }
}, {
  tableName: 'live_bus_locations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'last_updated',
  indexes: [
    { fields: ['bus_id'], unique: true },
    { fields: ['driver_id'] },
    { fields: ['last_updated'] },
    { fields: ['is_location_sharing'] },
    { fields: ['current_route_id'] },
    { fields: ['latitude', 'longitude'] }
  ]
});

// Associations
LiveBusLocation.associate = (models) => {
  LiveBusLocation.belongsTo(models.Bus, {
    foreignKey: 'busId',
    as: 'bus',
    onDelete: 'CASCADE'
  });

  LiveBusLocation.belongsTo(models.User, {
    foreignKey: 'driverId',
    as: 'driver'
  });

  LiveBusLocation.belongsTo(models.Route, {
    foreignKey: 'currentRouteId',
    as: 'currentRoute'
  });

  LiveBusLocation.belongsTo(models.BusStop, {
    foreignKey: 'nextStopId',
    as: 'nextStop'
  });
};

// Instance methods
LiveBusLocation.prototype.getCoordinates = function() {
  return {
    lat: parseFloat(this.latitude),
    lng: parseFloat(this.longitude)
  };
};

LiveBusLocation.prototype.calculateDistanceTo = function(lat, lng) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = this.toRadians(lat - parseFloat(this.latitude));
  const dLng = this.toRadians(lng - parseFloat(this.longitude));

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(this.toRadians(this.latitude)) * Math.cos(this.toRadians(lat)) *
    Math.sin(dLng/2) * Math.sin(dLng/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 1000; // Return distance in meters
};

LiveBusLocation.prototype.toRadians = function(degrees) {
  return degrees * (Math.PI / 180);
};

LiveBusLocation.prototype.updateETA = async function() {
  if (!this.nextStopId || !this.speedKmh || parseFloat(this.speedKmh) <= 0) {
    this.etaToNextStop = null;
    return;
  }

  try {
    const BusStop = require('./BusStop');
    const nextStop = await BusStop.findByPk(this.nextStopId);

    if (!nextStop) {
      this.etaToNextStop = null;
      return;
    }

    // Calculate distance to next stop
    this.distanceToNextStop = this.calculateDistanceTo(
      parseFloat(nextStop.latitude),
      parseFloat(nextStop.longitude)
    );

    // Calculate ETA (distance / speed)
    // Speed is in km/h, distance in meters, so convert distance to km
    const distanceKm = this.distanceToNextStop / 1000;
    const speedKmh = parseFloat(this.speedKmh);

    if (speedKmh > 0) {
      const etaMinutes = (distanceKm / speedKmh) * 60;
      this.etaToNextStop = new Date(Date.now() + etaMinutes * 60 * 1000);
    } else {
      this.etaToNextStop = null;
    }
  } catch (error) {
    console.error('Error updating ETA:', error);
    this.etaToNextStop = null;
  }
};

LiveBusLocation.prototype.updateNextStop = async function() {
  if (!this.currentRouteId) return;

  try {
    const BusStop = require('./BusStop');
    const nextStop = await BusStop.findNextStop(
      this.currentRouteId,
      parseFloat(this.latitude),
      parseFloat(this.longitude)
    );

    if (nextStop) {
      this.nextStopId = nextStop.id;
      await this.updateETA();
    }
  } catch (error) {
    console.error('Error updating next stop:', error);
  }
};

// Static methods
LiveBusLocation.findActive = function() {
  return this.findAll({
    where: { isLocationSharing: true },
    include: [
      {
        model: require('./Bus'),
        as: 'bus',
        attributes: ['id', 'busNumber', 'busName']
      },
      {
        model: require('./User'),
        as: 'driver',
        attributes: ['id', 'name']
      },
      {
        model: require('./BusStop'),
        as: 'nextStop',
        attributes: ['id', 'name', 'latitude', 'longitude']
      }
    ],
    order: [['lastUpdated', 'DESC']]
  });
};

LiveBusLocation.findByBusId = function(busId) {
  return this.findOne({
    where: { busId, isLocationSharing: true },
    include: [
      {
        model: require('./Bus'),
        as: 'bus'
      },
      {
        model: require('./User'),
        as: 'driver'
      },
      {
        model: require('./BusStop'),
        as: 'nextStop'
      }
    ]
  });
};

LiveBusLocation.updateLocation = async function(busId, locationData) {
  const [location, created] = await this.upsert({
    busId,
    ...locationData
  }, {
    returning: true
  });

  // Update ETA and next stop after location update
  if (!created) {
    await location.updateNextStop();
    await location.save();
  }

  return location;
};

module.exports = LiveBusLocation;
