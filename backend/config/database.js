const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

// SQLite database configuration
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../data/college_bus_tracker.db'),
  logging: false, // Disable SQL logging for cleaner output
  define: {
    timestamps: true,
    underscored: true,
    paranoid: false
  }
});

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection has been established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    process.exit(1);
  }
};

module.exports = {
  sequelize,
  testConnection,
  Sequelize
};
