const { body, param, query, validationResult } = require('express-validator');
const { LiveBusLocation, Bus, User, BusStop, Route, TripLog, LocationHistory } = require('../models');
const ETACalculator = require('../utils/etaCalculator');

// Validation rules
const locationUpdateValidation = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  body('speedKmh')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Speed must be non-negative'),
  body('heading')
    .optional()
    .isFloat({ min: 0, max: 360 })
    .withMessage('Heading must be between 0 and 360'),
  body('accuracyMeters')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Accuracy must be non-negative')
];

const startLocationSharingValidation = [
  body('busId')
    .isUUID()
    .withMessage('Invalid bus ID'),
  body('routeId')
    .optional()
    .isUUID()
    .withMessage('Invalid route ID')
];

// @desc    Get all active bus locations
// @route   GET /api/locations
// @access  Admin, Passenger (public view)
const getActiveLocations = async (req, res) => {
  try {
    const locations = await LiveBusLocation.findActive();

    // Add ETA calculations for each location
    const locationsWithETA = await Promise.all(
      locations.map(async (location) => {
        const locationData = location.toJSON();

        if (location.nextStopId) {
          // Get recent speed history for better ETA calculation
          const recentHistory = await LocationHistory.findAll({
            where: { busId: location.busId },
            order: [['recordedAt', 'DESC']],
            limit: 10
          });

          const recentSpeeds = recentHistory
            .map(h => h.speedKmh)
            .filter(speed => speed && speed > 0);

          const etaData = ETACalculator.estimateTimeToStop(
            { lat: location.latitude, lng: location.longitude },
            { lat: location.nextStop.latitude, lng: location.nextStop.longitude },
            location.speedKmh,
            recentSpeeds
          );

          locationData.etaToNextStop = etaData;
          locationData.formattedETA = ETACalculator.formatETA(etaData.eta);
        }

        return locationData;
      })
    );

    res.json({
      locations: locationsWithETA,
      count: locationsWithETA.length
    });

  } catch (error) {
    console.error('Get active locations error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch active locations'
    });
  }
};

// @desc    Get location for specific bus
// @route   GET /api/locations/bus/:busId
// @access  Admin, Passenger (public view), Driver (own bus)
const getBusLocation = async (req, res) => {
  try {
    const { busId } = req.params;

    // Validate busId format
    if (!busId || typeof busId !== 'string') {
      return res.status(400).json({
        error: 'Invalid bus ID',
        message: 'Bus ID must be a valid UUID'
      });
    }

    // Check if bus exists
    const bus = await Bus.findByPk(busId);
    if (!bus) {
      return res.status(404).json({
        error: 'Bus not found',
        message: 'The specified bus does not exist'
      });
    }

    const location = await LiveBusLocation.findByBusId(busId);

    if (!location) {
      return res.status(404).json({
        error: 'Location not found',
        message: 'No active location found for this bus'
      });
    }

    // Check permissions for drivers
    if (req.user.role === 'driver' && location.driverId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view your own bus location'
      });
    }

    const locationData = location.toJSON();

    // Add ETA calculation
    if (location.nextStopId) {
      const recentHistory = await LocationHistory.findAll({
        where: { busId },
        order: [['recordedAt', 'DESC']],
        limit: 10
      });

      const recentSpeeds = recentHistory
        .map(h => h.speedKmh)
        .filter(speed => speed && speed > 0);

      const etaData = ETACalculator.estimateTimeToStop(
        { lat: location.latitude, lng: location.longitude },
        { lat: location.nextStop.latitude, lng: location.nextStop.longitude },
        location.speedKmh,
        recentSpeeds
      );

      locationData.etaToNextStop = etaData;
      locationData.formattedETA = ETACalculator.formatETA(etaData.eta);
    }

    res.json({ location: locationData });

  } catch (error) {
    console.error('Get bus location error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch bus location'
    });
  }
};

// @desc    Start location sharing for driver
// @route   POST /api/locations/start
// @access  Driver only
const startLocationSharing = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { busId, routeId } = req.body;

    // Validate busId format
    if (!busId || typeof busId !== 'string') {
      return res.status(400).json({
        error: 'Invalid bus ID',
        message: 'Bus ID is required and must be a valid UUID'
      });
    }

    // Check if driver is assigned to this bus
    const bus = await Bus.findByPk(busId);
    if (!bus) {
      return res.status(404).json({
        error: 'Bus not found',
        message: 'The specified bus does not exist'
      });
    }

    if (bus.driverId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You are not assigned to this bus'
      });
    }

    if (!bus.isActive) {
      return res.status(400).json({
        error: 'Bus inactive',
        message: 'Cannot start location sharing for inactive bus'
      });
    }

    // Check if already sharing location
    const existingLocation = await LiveBusLocation.findByBusId(busId);
    if (existingLocation && existingLocation.isLocationSharing) {
      return res.status(400).json({
        error: 'Already sharing',
        message: 'Location sharing is already active for this bus'
      });
    }

    // Validate route if provided
    let finalRouteId = routeId || bus.currentRouteId;
    if (finalRouteId) {
      const route = await Route.findByPk(finalRouteId);
      if (!route) {
        return res.status(404).json({
          error: 'Route not found',
          message: 'The specified route does not exist'
        });
      }
    }

    // Start a new trip log
    const tripLog = await TripLog.create({
      busId,
      driverId: req.user.id,
      routeId: finalRouteId,
      startedAt: new Date(),
      status: 'active'
    });

    // Create initial location entry
    const location = await LiveBusLocation.create({
      busId,
      driverId: req.user.id,
      latitude: 0, // Will be updated with first location update
      longitude: 0,
      isLocationSharing: true,
      currentRouteId: finalRouteId,
      tripStartedAt: new Date()
    });

    // Update bus current route if specified
    if (routeId && routeId !== bus.currentRouteId) {
      bus.currentRouteId = routeId;
      await bus.save();
    }

    // Emit socket event
    const socketService = require('../services/socketService');
    socketService.emitToAll('locationSharingStarted', {
      busId,
      driverId: req.user.id,
      tripId: tripLog.id
    });

    res.json({
      message: 'Location sharing started successfully',
      tripId: tripLog.id,
      location: {
        id: location.id,
        busId: location.busId,
        isLocationSharing: location.isLocationSharing
      }
    });

  } catch (error) {
    console.error('Start location sharing error:', error);

    // Handle specific database errors
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        error: 'Invalid reference',
        message: 'Invalid bus or route reference'
      });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        error: 'Duplicate entry',
        message: 'Location sharing is already active'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to start location sharing'
    });
  }
};

// @desc    Stop location sharing for driver
// @route   POST /api/locations/stop
// @access  Driver only
const stopLocationSharing = async (req, res) => {
  try {
    const { busId } = req.body;

    if (!busId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Bus ID is required'
      });
    }

    // Check if driver is assigned to this bus
    const bus = await Bus.findByPk(busId);
    if (!bus || bus.driverId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You are not assigned to this bus'
      });
    }

    // Find active location and trip
    const location = await LiveBusLocation.findByBusId(busId);
    const activeTrip = await TripLog.findOne({
      where: { busId, driverId: req.user.id, status: 'active' }
    });

    if (!location || !location.isLocationSharing) {
      return res.status(400).json({
        error: 'Not sharing location',
        message: 'Location sharing is not active for this bus'
      });
    }

    // Stop location sharing
    location.isLocationSharing = false;
    await location.save();

    // End the trip
    if (activeTrip) {
      await activeTrip.endTrip();
    }

    // Emit socket event
    const socketService = require('../services/socketService');
    socketService.emitToAll('locationSharingStopped', {
      busId,
      driverId: req.user.id
    });

    res.json({
      message: 'Location sharing stopped successfully'
    });

  } catch (error) {
    console.error('Stop location sharing error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to stop location sharing'
    });
  }
};

// @desc    Update bus location (called by driver app)
// @route   PUT /api/locations/update
// @access  Driver only
const updateLocation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { busId, latitude, longitude, speedKmh, heading, accuracyMeters } = req.body;

    // Find active location sharing session
    const location = await LiveBusLocation.findByBusId(busId);

    if (!location || !location.isLocationSharing) {
      return res.status(400).json({
        error: 'Location sharing not active',
        message: 'Please start location sharing first'
      });
    }

    // Check if driver owns this bus
    if (location.driverId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only update your own bus location'
      });
    }

    // Update location
    const updatedLocation = await LiveBusLocation.updateLocation(busId, {
      latitude,
      longitude,
      speedKmh: speedKmh || 0,
      heading,
      accuracyMeters,
      driverId: req.user.id,
      currentRouteId: location.currentRouteId,
      isLocationSharing: true
    });

    // Record in location history
    await LocationHistory.create({
      tripLogId: null, // Will be set when trip ends
      busId,
      latitude,
      longitude,
      speedKmh: speedKmh || 0,
      heading,
      accuracyMeters
    });

    // Update ETA and next stop
    await updatedLocation.updateNextStop();

    // Emit real-time update via socket
    const socketService = require('../services/socketService');
    socketService.emitToAll('locationUpdate', {
      busId,
      location: {
        latitude: updatedLocation.latitude,
        longitude: updatedLocation.longitude,
        speedKmh: updatedLocation.speedKmh,
        heading: updatedLocation.heading,
        lastUpdated: updatedLocation.lastUpdated,
        nextStop: updatedLocation.nextStop,
        etaToNextStop: updatedLocation.etaToNextStop
      }
    });

    res.json({
      message: 'Location updated successfully',
      location: {
        latitude: updatedLocation.latitude,
        longitude: updatedLocation.longitude,
        speedKmh: updatedLocation.speedKmh,
        lastUpdated: updatedLocation.lastUpdated
      }
    });

  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update location'
    });
  }
};

// @desc    Get location history for a bus
// @route   GET /api/locations/history/:busId
// @access  Admin, Driver (own bus)
const getLocationHistory = async (req, res) => {
  try {
    const { busId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;

    // Check permissions
    if (req.user.role === 'driver') {
      const bus = await Bus.findByPk(busId);
      if (!bus || bus.driverId !== req.user.id) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only view your own bus history'
        });
      }
    }

    let whereClause = { busId };

    if (startDate || endDate) {
      whereClause.recordedAt = {};
      if (startDate) whereClause.recordedAt[require('sequelize').Op.gte] = new Date(startDate);
      if (endDate) whereClause.recordedAt[require('sequelize').Op.lte] = new Date(endDate);
    }

    const history = await LocationHistory.findAll({
      where: whereClause,
      order: [['recordedAt', 'DESC']],
      limit: parseInt(limit)
    });

    res.json({
      history,
      count: history.length
    });

  } catch (error) {
    console.error('Get location history error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch location history'
    });
  }
};

module.exports = {
  getActiveLocations,
  getBusLocation,
  startLocationSharing,
  stopLocationSharing,
  updateLocation,
  getLocationHistory,
  locationUpdateValidation,
  startLocationSharingValidation
};
