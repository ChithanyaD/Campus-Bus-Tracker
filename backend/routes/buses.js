const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/busController');

const {
  authenticateToken,
  requireAdmin,
  requireDriverOrAdmin,
  requireActiveUser
} = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);
router.use(requireActiveUser);

// Admin only routes
router.get('/stats', requireAdmin, getBusStats);
router.post('/', requireAdmin, createBusValidation, createBus);
router.put('/:id', requireAdmin, updateBusValidation, updateBus);
router.delete('/:id', requireAdmin, deleteBus);
router.put('/:id/assign-driver', requireAdmin, assignDriver);
router.put('/:id/unassign-driver', requireAdmin, unassignDriver);

// Bus stops management (Admin only)
router.get('/:id/stops', requireAdmin, getBusStops);
router.post('/:id/stops', requireAdmin, busStopValidation, addBusStop);
router.delete('/:id/stops/:stopId', requireAdmin, removeBusStop);

// Admin and Driver routes
router.get('/', requireDriverOrAdmin, getBuses);
router.get('/:id', requireDriverOrAdmin, getBus);

module.exports = router;
