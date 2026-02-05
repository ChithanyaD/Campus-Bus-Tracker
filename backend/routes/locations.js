const express = require('express');
const router = express.Router();
const {
  getActiveLocations,
  getBusLocation,
  startLocationSharing,
  stopLocationSharing,
  updateLocation,
  getLocationHistory,
  locationUpdateValidation,
  startLocationSharingValidation
} = require('../controllers/locationController');

const {
  authenticateToken,
  requireAdmin,
  requireDriver,
  requireDriverOrAdmin,
  optionalAuth,
  requireActiveUser
} = require('../middleware/auth');

// Public routes (optional auth for passengers)
router.get('/', optionalAuth, getActiveLocations);
router.get('/bus/:busId', optionalAuth, getBusLocation);

// Protected routes
router.use(authenticateToken);
router.use(requireActiveUser);

// Driver only routes
router.post('/start', requireDriver, startLocationSharingValidation, startLocationSharing);
router.post('/stop', requireDriver, stopLocationSharing);
router.put('/update', requireDriver, locationUpdateValidation, updateLocation);

// Admin and Driver routes
router.get('/history/:busId', requireDriverOrAdmin, getLocationHistory);

module.exports = router;
