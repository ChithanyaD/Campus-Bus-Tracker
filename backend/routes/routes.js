const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/routeController');

const {
  authenticateToken,
  requireAdmin,
  requireActiveUser
} = require('../middleware/auth');

// All routes require authentication and active user
router.use(authenticateToken);
router.use(requireActiveUser);

// Public routes (accessible by all authenticated users)
router.get('/', getRoutes);
router.get('/:id', getRoute);
router.get('/:routeId/stops', getBusStops);

// Admin only routes
router.post('/', requireAdmin, createRouteValidation, createRoute);
router.put('/:id', requireAdmin, updateRouteValidation, updateRoute);
router.delete('/:id', requireAdmin, deleteRoute);

router.post('/:routeId/stops', requireAdmin, createBusStopValidation, addBusStop);
router.put('/:routeId/stops/:stopId', requireAdmin, updateBusStop);
router.delete('/:routeId/stops/:stopId', requireAdmin, deleteBusStop);

module.exports = router;
