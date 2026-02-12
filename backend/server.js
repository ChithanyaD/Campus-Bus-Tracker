const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import database configuration
const { sequelize, testConnection } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const busRoutes = require('./routes/buses');
const routeRoutes = require('./routes/routes');
const locationRoutes = require('./routes/locations');

// Import services
const socketService = require('./services/socketService');

// Create Express app
const app = express();
const server = http.createServer(app);

// Utility function to find available port (kept for future use)
const findAvailablePort = (startPort) => {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    server.listen(startPort, () => {
      server.close(() => resolve(startPort));
    });
    server.on('error', () => resolve(startPort + 1));
  });
};

// Configure Socket.IO
const io = socketIo(server, {
  cors: {
    // Allow configurable origin; default to any origin in development so
    // ngrok / mobile clients can connect without CORS issues.
    origin: process.env.SOCKET_CORS_ORIGIN || '*',
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Trust first proxy (required for correct client IP when behind ngrok /
// reverse proxies and to avoid express-rate-limit X-Forwarded-For warnings).
app.set('trust proxy', 1);

// Initialize socket service
socketService.init(io);

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  // Allow configurable origin; default to any origin in development so
  // ngrok / mobile clients can access the API without CORS issues.
  origin: process.env.FRONTEND_URL || true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/locations', locationRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(error => ({
      field: error.path,
      message: error.message,
      value: error.value
    }));

    return res.status(400).json({
      error: 'Validation Error',
      details: errors
    });
  }

  // Sequelize unique constraint errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: 'Duplicate Entry',
      message: 'This record already exists'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid Token',
      message: 'Authentication token is invalid'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token Expired',
      message: 'Authentication token has expired'
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});


// Seed demo data
const seedDemoData = async () => {
  try {
    const { User, Bus, Route, BusStop } = require('./models');

    // Check if demo data already exists
    const existingUser = await User.findOne({ where: { email: 'admin@college.edu' } });
    if (existingUser) {
      console.log('✅ Demo data already exists');
      return;
    }

    console.log('🌱 Seeding demo data...');

    // Create demo users
    const admin = await User.create({
      email: 'admin@college.edu',
      passwordHash: '$2a$12$0wmckCTgXDc6PQf0N3jmruM3nk20ns.qBXai1RzdHr8eBI5kmFsW2', // srec@123
      role: 'admin',
      name: 'System Administrator',
      phone: '+1234567890'
    });

    const driver = await User.create({
      email: 'driver1@college.edu',
      passwordHash: '$2a$12$0wmckCTgXDc6PQf0N3jmruM3nk20ns.qBXai1RzdHr8eBI5kmFsW2', // srec@123
      role: 'driver',
      name: 'John Driver',
      phone: '+1234567891'
    });

    const passenger = await User.create({
      email: 'passenger1@college.edu',
      passwordHash: '$2a$12$0wmckCTgXDc6PQf0N3jmruM3nk20ns.qBXai1RzdHr8eBI5kmFsW2', // srec@123
      role: 'passenger',
      name: 'Jane Student',
      phone: '+1234567892'
    });

    // Create demo route
    const route = await Route.create({
      name: 'Main Campus Route',
      description: 'Route connecting main campus to residential areas',
      coordinates: [
        { lat: 12.9716, lng: 77.5946 },
        { lat: 12.9720, lng: 77.5950 },
        { lat: 12.9730, lng: 77.5960 },
        { lat: 12.9740, lng: 77.5970 },
        { lat: 12.9750, lng: 77.5980 }
      ],
      distanceKm: 5.5,
      estimatedDurationMinutes: 25
    });

    // Create bus stops
    await BusStop.create({
      name: 'Main Gate',
      latitude: 12.9716,
      longitude: 77.5946,
      stopOrder: 1,
      routeId: route.id,
      estimatedArrivalTime: '08:00:00'
    });

    await BusStop.create({
      name: 'Library Stop',
      latitude: 12.9720,
      longitude: 77.5950,
      stopOrder: 2,
      routeId: route.id,
      estimatedArrivalTime: '08:05:00'
    });

    await BusStop.create({
      name: 'Cafeteria Stop',
      latitude: 12.9730,
      longitude: 77.5960,
      stopOrder: 3,
      routeId: route.id,
      estimatedArrivalTime: '08:10:00'
    });

    await BusStop.create({
      name: 'Hostel Stop',
      latitude: 12.9740,
      longitude: 77.5970,
      stopOrder: 4,
      routeId: route.id,
      estimatedArrivalTime: '08:15:00'
    });

    await BusStop.create({
      name: 'Residential Area',
      latitude: 12.9750,
      longitude: 77.5980,
      stopOrder: 5,
      routeId: route.id,
      estimatedArrivalTime: '08:20:00'
    });

    // Create demo buses
    const bus1 = await Bus.create({
      busNumber: 'BUS001',
      busName: 'College Express 1',
      capacity: 50,
      driverId: driver.id,
      currentRouteId: route.id
    });

    await Bus.create({
      busNumber: 'BUS002',
      busName: 'College Express 2',
      capacity: 45
    });

    await Bus.create({
      busNumber: 'BUS003',
      busName: 'College Express 3',
      capacity: 50
    });

    console.log('✅ Demo data seeded successfully');
    console.log(`   📧 Admin: admin@college.edu / srec@123`);
    console.log(`   🚗 Driver: driver1@college.edu / srec@123`);
    console.log(`   👤 Passenger: passenger1@college.edu / srec@123`);

  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
  }
};

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();

    // Sync database (create tables)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ force: false });
      console.log('✅ Database synchronized successfully.');

      // Seed demo data
      await seedDemoData();
    }

    // Find available port
    const PORT = process.env.PORT || 3004;
    console.log(`🔍 Using port: ${PORT}`);

    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Socket.IO server initialized`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💻 Frontend should connect to: http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Rejection:', err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    sequelize.close();
    process.exit(0);
  });
});

startServer();
