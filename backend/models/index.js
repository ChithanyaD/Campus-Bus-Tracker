// Model index file - initializes all models and associations

const User = require('./User');
const Bus = require('./Bus');
const Route = require('./Route');
const BusStop = require('./BusStop');
const LiveBusLocation = require('./LiveBusLocation');
const TripLog = require('./TripLog');
const LocationHistory = require('./LocationHistory');

// Define associations
const models = {
  User,
  Bus,
  Route,
  BusStop,
  LiveBusLocation,
  TripLog,
  LocationHistory
};

// Set up associations for each model
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

module.exports = models;
