const { body, param, validationResult } = require('express-validator');
const { Route, BusStop } = require('../models');

// Validation rules
const createRouteValidation = [
  body('name')
    .notEmpty()
    .withMessage('Route name is required')
    .isLength({ max: 255 })
    .withMessage('Route name cannot exceed 255 characters'),
  body('coordinates')
    .optional()
    .isArray()
    .withMessage('Coordinates must be an array'),
  body('distanceKm')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Distance must be non-negative'),
  body('estimatedDurationMinutes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Duration must be non-negative')
];

const updateRouteValidation = [
  param('id').isUUID().withMessage('Invalid route ID'),
  body('name')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Route name cannot exceed 255 characters'),
  body('coordinates')
    .optional()
    .isArray()
    .withMessage('Coordinates must be an array'),
  body('distanceKm')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Distance must be non-negative'),
  body('estimatedDurationMinutes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Duration must be non-negative'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

const createBusStopValidation = [
  param('routeId').isUUID().withMessage('Invalid route ID'),
  body('name')
    .notEmpty()
    .withMessage('Stop name is required'),
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  body('stopOrder')
    .isInt({ min: 1 })
    .withMessage('Stop order must be positive integer')
];

// @desc    Get all routes
// @route   GET /api/routes
// @access  Admin, Driver, Passenger
const getRoutes = async (req, res) => {
  try {
    const routes = await Route.findActive();

    res.json({
      routes,
      count: routes.length
    });

  } catch (error) {
    console.error('Get routes error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch routes'
    });
  }
};

// @desc    Get single route with stops
// @route   GET /api/routes/:id
// @access  Admin, Driver, Passenger
const getRoute = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;

    const route = await Route.findByPk(id, {
      include: [{
        model: BusStop,
        as: 'busStops',
        order: [['stopOrder', 'ASC']]
      }]
    });

    if (!route) {
      return res.status(404).json({
        error: 'Route not found',
        message: 'No route found with the specified ID'
      });
    }

    res.json({ route });

  } catch (error) {
    console.error('Get route error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch route'
    });
  }
};

// @desc    Create new route
// @route   POST /api/routes
// @access  Admin only
const createRoute = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { name, description, coordinates, distanceKm, estimatedDurationMinutes } = req.body;

    // Check if route name already exists
    const existingRoute = await Route.findByName(name);
    if (existingRoute) {
      return res.status(409).json({
        error: 'Route already exists',
        message: 'A route with this name already exists'
      });
    }

    const route = await Route.create({
      name,
      description,
      coordinates,
      distanceKm,
      estimatedDurationMinutes
    });

    res.status(201).json({
      message: 'Route created successfully',
      route
    });

  } catch (error) {
    console.error('Create route error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create route'
    });
  }
};

// @desc    Update route
// @route   PUT /api/routes/:id
// @access  Admin only
const updateRoute = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { name, description, coordinates, distanceKm, estimatedDurationMinutes, isActive } = req.body;

    const route = await Route.findByPk(id);
    if (!route) {
      return res.status(404).json({
        error: 'Route not found',
        message: 'No route found with the specified ID'
      });
    }

    // Check name uniqueness if changing
    if (name && name !== route.name) {
      const existingRoute = await Route.findByName(name);
      if (existingRoute) {
        return res.status(409).json({
          error: 'Route already exists',
          message: 'A route with this name already exists'
        });
      }
      route.name = name;
    }

    if (description !== undefined) route.description = description;
    if (coordinates !== undefined) route.coordinates = coordinates;
    if (distanceKm !== undefined) route.distanceKm = distanceKm;
    if (estimatedDurationMinutes !== undefined) route.estimatedDurationMinutes = estimatedDurationMinutes;
    if (isActive !== undefined) route.isActive = isActive;

    await route.save();

    res.json({
      message: 'Route updated successfully',
      route
    });

  } catch (error) {
    console.error('Update route error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update route'
    });
  }
};

// @desc    Delete route
// @route   DELETE /api/routes/:id
// @access  Admin only
const deleteRoute = async (req, res) => {
  try {
    const { id } = req.params;

    const route = await Route.findByPk(id, {
      include: [{
        model: BusStop,
        as: 'busStops'
      }]
    });

    if (!route) {
      return res.status(404).json({
        error: 'Route not found',
        message: 'No route found with the specified ID'
      });
    }

    // Check if route has bus stops
    if (route.busStops && route.busStops.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete route',
        message: 'Please delete all bus stops first'
      });
    }

    await route.destroy();

    res.json({
      message: 'Route deleted successfully'
    });

  } catch (error) {
    console.error('Delete route error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete route'
    });
  }
};

// @desc    Get bus stops for a route
// @route   GET /api/routes/:routeId/stops
// @access  Admin, Driver, Passenger
const getBusStops = async (req, res) => {
  try {
    const { routeId } = req.params;

    const stops = await BusStop.findByRouteId(routeId);

    res.json({
      stops,
      count: stops.length
    });

  } catch (error) {
    console.error('Get bus stops error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch bus stops'
    });
  }
};

// @desc    Add bus stop to route
// @route   POST /api/routes/:routeId/stops
// @access  Admin only
const addBusStop = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { routeId } = req.params;
    const { name, latitude, longitude, stopOrder, estimatedArrivalTime } = req.body;

    // Check if route exists
    const route = await Route.findByPk(routeId);
    if (!route) {
      return res.status(404).json({
        error: 'Route not found',
        message: 'No route found with the specified ID'
      });
    }

    // Validate stop order uniqueness
    await BusStop.validateStopOrder(routeId, stopOrder);

    const stop = await BusStop.create({
      name,
      latitude,
      longitude,
      stopOrder,
      routeId,
      estimatedArrivalTime
    });

    res.status(201).json({
      message: 'Bus stop added successfully',
      stop
    });

  } catch (error) {
    console.error('Add bus stop error:', error);

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: 'Stop order exists',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to add bus stop'
    });
  }
};

// @desc    Update bus stop
// @route   PUT /api/routes/:routeId/stops/:stopId
// @access  Admin only
const updateBusStop = async (req, res) => {
  try {
    const { routeId, stopId } = req.params;
    const { name, latitude, longitude, stopOrder, estimatedArrivalTime } = req.body;

    const stop = await BusStop.findOne({
      where: { id: stopId, routeId }
    });

    if (!stop) {
      return res.status(404).json({
        error: 'Bus stop not found',
        message: 'No bus stop found with the specified ID'
      });
    }

    // Validate stop order uniqueness if changing
    if (stopOrder && stopOrder !== stop.stopOrder) {
      await BusStop.validateStopOrder(routeId, stopOrder, stopId);
    }

    if (name) stop.name = name;
    if (latitude !== undefined) stop.latitude = latitude;
    if (longitude !== undefined) stop.longitude = longitude;
    if (stopOrder) stop.stopOrder = stopOrder;
    if (estimatedArrivalTime !== undefined) stop.estimatedArrivalTime = estimatedArrivalTime;

    await stop.save();

    res.json({
      message: 'Bus stop updated successfully',
      stop
    });

  } catch (error) {
    console.error('Update bus stop error:', error);

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: 'Stop order exists',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update bus stop'
    });
  }
};

// @desc    Delete bus stop
// @route   DELETE /api/routes/:routeId/stops/:stopId
// @access  Admin only
const deleteBusStop = async (req, res) => {
  try {
    const { routeId, stopId } = req.params;

    const stop = await BusStop.findOne({
      where: { id: stopId, routeId }
    });

    if (!stop) {
      return res.status(404).json({
        error: 'Bus stop not found',
        message: 'No bus stop found with the specified ID'
      });
    }

    await stop.destroy();

    res.json({
      message: 'Bus stop deleted successfully'
    });

  } catch (error) {
    console.error('Delete bus stop error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete bus stop'
    });
  }
};

module.exports = {
  getRoutes,
  getRoute,
  createRoute,
  updateRoute,
  deleteRoute,
  getBusStops,
  addBusStop,
  updateBusStop,
  deleteBusStop,
  createRouteValidation,
  updateRouteValidation,
  createBusStopValidation
};
