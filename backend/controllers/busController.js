const { body, param, validationResult } = require('express-validator');
const { Bus, User, Route, LiveBusLocation, BusStop } = require('../models');

// Validation rules
const createBusValidation = [
  body('busNumber')
    .notEmpty()
    .withMessage('Bus number is required')
    .matches(/^[A-Z0-9\-]+$/)
    .withMessage('Bus number can only contain letters, numbers, and hyphens'),
  body('busName')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Bus name cannot exceed 255 characters'),
  body('capacity')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('Capacity must be between 1 and 200')
];

const updateBusValidation = [
  param('id').isUUID().withMessage('Invalid bus ID'),
  body('busNumber')
    .optional()
    .matches(/^[A-Z0-9\-]+$/)
    .withMessage('Bus number can only contain letters, numbers, and hyphens'),
  body('busName')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Bus name cannot exceed 255 characters'),
  body('capacity')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('Capacity must be between 1 and 200'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

// @desc    Get all buses
// @route   GET /api/buses
// @access  Admin, Driver (filtered)
const getBuses = async (req, res) => {
  try {
    let whereClause = {};
    let include = [];

    if (req.user.role === 'driver') {
      // Drivers can only see their own buses or unassigned buses
      whereClause = {
        [require('sequelize').Op.or]: [
          { driverId: req.user.id },
          { driverId: null }
        ]
      };
    }

    if (req.user.role === 'admin') {
      include.push({
        model: User,
        as: 'driver',
        attributes: ['id', 'name', 'email', 'phone']
      });
    }

    const buses = await Bus.findAll({
      where: whereClause,
      include,
      order: [['busNumber', 'ASC']]
    });

    res.json({
      buses,
      count: buses.length
    });

  } catch (error) {
    console.error('Get buses error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch buses'
    });
  }
};

// @desc    Get single bus
// @route   GET /api/buses/:id
// @access  Admin, Driver (own bus)
const getBus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;

    const bus = await Bus.findByPk(id, {
      include: [
        {
          model: User,
          as: 'driver',
          attributes: ['id', 'name', 'email', 'phone']
        },
        {
          model: Route,
          as: 'currentRoute',
          attributes: ['id', 'name', 'coordinates']
        }
      ]
    });

    if (!bus) {
      return res.status(404).json({
        error: 'Bus not found',
        message: 'No bus found with the specified ID'
      });
    }

    // Check permissions
    if (req.user.role === 'driver' && bus.driverId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view your assigned bus'
      });
    }

    res.json({ bus });

  } catch (error) {
    console.error('Get bus error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch bus'
    });
  }
};

// @desc    Create new bus
// @route   POST /api/buses
// @access  Admin only
const createBus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { busNumber, busName, capacity } = req.body;

    // Check if bus number already exists
    const existingBus = await Bus.findByBusNumber(busNumber);
    if (existingBus) {
      return res.status(409).json({
        error: 'Bus already exists',
        message: 'A bus with this number already exists'
      });
    }

    const bus = await Bus.create({
      busNumber,
      busName,
      capacity: capacity || 50
    });

    res.status(201).json({
      message: 'Bus created successfully',
      bus
    });

  } catch (error) {
    console.error('Create bus error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create bus'
    });
  }
};

// @desc    Update bus
// @route   PUT /api/buses/:id
// @access  Admin only
const updateBus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { busNumber, busName, capacity, isActive } = req.body;

    const bus = await Bus.findByPk(id);
    if (!bus) {
      return res.status(404).json({
        error: 'Bus not found',
        message: 'No bus found with the specified ID'
      });
    }

    // Check bus number uniqueness if changing
    if (busNumber && busNumber !== bus.busNumber) {
      const existingBus = await Bus.findByBusNumber(busNumber);
      if (existingBus) {
        return res.status(409).json({
          error: 'Bus already exists',
          message: 'A bus with this number already exists'
        });
      }
      bus.busNumber = busNumber;
    }

    if (busName !== undefined) bus.busName = busName;
    if (capacity !== undefined) bus.capacity = capacity;
    if (isActive !== undefined) bus.isActive = isActive;

    await bus.save();

    res.json({
      message: 'Bus updated successfully',
      bus
    });

  } catch (error) {
    console.error('Update bus error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update bus'
    });
  }
};

// @desc    Delete bus
// @route   DELETE /api/buses/:id
// @access  Admin only
const deleteBus = async (req, res) => {
  try {
    const { id } = req.params;

    const bus = await Bus.findByPk(id, {
      include: [
        { model: LiveBusLocation, as: 'liveLocation' }
      ]
    });

    if (!bus) {
      return res.status(404).json({
        error: 'Bus not found',
        message: 'No bus found with the specified ID'
      });
    }

    // Check if bus has active location sharing
    if (bus.liveLocation && bus.liveLocation.isLocationSharing) {
      return res.status(400).json({
        error: 'Cannot delete active bus',
        message: 'Please stop location sharing before deleting the bus'
      });
    }

    await bus.destroy();

    res.json({
      message: 'Bus deleted successfully'
    });

  } catch (error) {
    console.error('Delete bus error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete bus'
    });
  }
};

// @desc    Assign driver to bus
// @route   PUT /api/buses/:id/assign-driver
// @access  Admin only
const assignDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Driver ID is required'
      });
    }

    const bus = await Bus.findByPk(id);
    if (!bus) {
      return res.status(404).json({
        error: 'Bus not found',
        message: 'No bus found with the specified ID'
      });
    }

    await bus.assignDriver(driverId);

    // Fetch updated bus with driver info
    const updatedBus = await Bus.findByPk(id, {
      include: [{
        model: User,
        as: 'driver',
        attributes: ['id', 'name', 'email', 'phone']
      }]
    });

    res.json({
      message: 'Driver assigned successfully',
      bus: updatedBus
    });

  } catch (error) {
    console.error('Assign driver error:', error);

    if (error.message.includes('Invalid driver') || error.message.includes('already assigned')) {
      return res.status(400).json({
        error: 'Assignment failed',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to assign driver'
    });
  }
};

// @desc    Unassign driver from bus
// @route   PUT /api/buses/:id/unassign-driver
// @access  Admin only
const unassignDriver = async (req, res) => {
  try {
    const { id } = req.params;

    const bus = await Bus.findByPk(id);
    if (!bus) {
      return res.status(404).json({
        error: 'Bus not found',
        message: 'No bus found with the specified ID'
      });
    }

    await bus.unassignDriver();

    res.json({
      message: 'Driver unassigned successfully',
      bus
    });

  } catch (error) {
    console.error('Unassign driver error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to unassign driver'
    });
  }
};

// @desc    Get bus statistics
// @route   GET /api/buses/stats
// @access  Admin only
const getBusStats = async (req, res) => {
  try {
    const totalBuses = await Bus.count();
    const activeBuses = await Bus.count({ where: { isActive: true } });
    const assignedBuses = await Bus.count({
      where: { isActive: true, driverId: { [require('sequelize').Op.ne]: null } }
    });
    const availableDrivers = await User.count({
      where: { role: 'driver', isActive: true }
    });

    // Get active location sharing buses
    const activeLocationSharing = await LiveBusLocation.count({
      where: { isLocationSharing: true }
    });

    res.json({
      stats: {
        totalBuses,
        activeBuses,
        inactiveBuses: totalBuses - activeBuses,
        assignedBuses,
        unassignedBuses: activeBuses - assignedBuses,
        availableDrivers,
        activeLocationSharing
      }
    });

  } catch (error) {
    console.error('Get bus stats error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch bus statistics'
    });
  }
};

// Bus stops validation
const busStopValidation = [
  body('name')
    .notEmpty()
    .withMessage('Stop name is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('Stop name must be between 1 and 255 characters'),
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('routeId')
    .optional()
    .isUUID()
    .withMessage('Invalid route ID')
];

// @desc    Get bus stops for a specific bus
// @route   GET /api/buses/:id/stops
// @access  Admin
const getBusStops = async (req, res) => {
  try {
    const { id: busId } = req.params;

    // Verify bus exists
    const bus = await Bus.findByPk(busId);
    if (!bus) {
      return res.status(404).json({
        error: 'Bus not found',
        message: 'The specified bus does not exist'
      });
    }

    // If bus has a current route, get stops from that route
    // Otherwise, return empty array
    let busStops = [];
    if (bus.currentRouteId) {
      busStops = await BusStop.findByRouteId(bus.currentRouteId);
    }

    res.json({
      success: true,
      bus: {
        id: bus.id,
        busNumber: bus.busNumber,
        busName: bus.busName,
        currentRouteId: bus.currentRouteId
      },
      busStops
    });

  } catch (error) {
    console.error('Error fetching bus stops:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch bus stops'
    });
  }
};

// @desc    Add bus stop to a specific bus
// @route   POST /api/buses/:id/stops
// @access  Admin
const addBusStop = async (req, res) => {
  try {
    const { id: busId } = req.params;
    const { name, latitude, longitude, routeId } = req.body;

    // Verify bus exists
    const bus = await Bus.findByPk(busId);
    if (!bus) {
      return res.status(404).json({
        error: 'Bus not found',
        message: 'The specified bus does not exist'
      });
    }

    // If bus has a current route, use that; otherwise require routeId
    const targetRouteId = bus.currentRouteId || routeId;
    if (!targetRouteId) {
      return res.status(400).json({
        error: 'Route required',
        message: 'Bus must have a current route or routeId must be provided'
      });
    }

    // Verify route exists
    const route = await Route.findByPk(targetRouteId);
    if (!route) {
      return res.status(404).json({
        error: 'Route not found',
        message: 'The specified route does not exist'
      });
    }

    // Get the next stop order for this route
    const existingStops = await BusStop.findByRouteId(targetRouteId);
    const nextStopOrder = existingStops.length + 1;

    // Create the bus stop
    const busStop = await BusStop.create({
      name,
      latitude,
      longitude,
      stopOrder: nextStopOrder,
      routeId: targetRouteId
    });

    res.status(201).json({
      success: true,
      message: 'Bus stop added successfully',
      busStop
    });

  } catch (error) {
    console.error('Error adding bus stop:', error);

    // Handle unique constraint violations
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        error: 'Duplicate stop order',
        message: 'A stop with this order already exists for the route'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to add bus stop'
    });
  }
};

// @desc    Remove bus stop from a specific bus
// @route   DELETE /api/buses/:id/stops/:stopId
// @access  Admin
const removeBusStop = async (req, res) => {
  try {
    const { id: busId, stopId } = req.params;

    // Verify bus exists
    const bus = await Bus.findByPk(busId);
    if (!bus) {
      return res.status(404).json({
        error: 'Bus not found',
        message: 'The specified bus does not exist'
      });
    }

    // Find and verify the bus stop exists
    const busStop = await BusStop.findByPk(stopId);
    if (!busStop) {
      return res.status(404).json({
        error: 'Bus stop not found',
        message: 'The specified bus stop does not exist'
      });
    }

    // Verify the bus stop belongs to the bus's current route
    if (bus.currentRouteId && busStop.routeId !== bus.currentRouteId) {
      return res.status(400).json({
        error: 'Invalid operation',
        message: 'Bus stop does not belong to this bus\'s current route'
      });
    }

    // Delete the bus stop
    await busStop.destroy();

    // Reorder remaining stops
    const remainingStops = await BusStop.findByRouteId(busStop.routeId);
    for (let i = 0; i < remainingStops.length; i++) {
      if (remainingStops[i].stopOrder > busStop.stopOrder) {
        remainingStops[i].stopOrder = remainingStops[i].stopOrder - 1;
        await remainingStops[i].save();
      }
    }

    res.json({
      success: true,
      message: 'Bus stop removed successfully'
    });

  } catch (error) {
    console.error('Error removing bus stop:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to remove bus stop'
    });
  }
};

module.exports = {
  getBuses,
  getBus,
  createBus,
  updateBus,
  deleteBus,
  assignDriver,
  unassignDriver,
  getBusStats,
  getBusStops,
  addBusStop,
  removeBusStop,
  createBusValidation,
  updateBusValidation,
  busStopValidation
};
