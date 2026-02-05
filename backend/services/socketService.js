const jwt = require('jsonwebtoken');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // socketId -> userId
    this.busSubscribers = new Map(); // busId -> Set of socketIds
  }

  init(io) {
    this.io = io;
    this.setupSocketHandlers();
    console.log('✅ Socket.IO service initialized');
  }

  setupSocketHandlers() {
    this.io.use(async (socket, next) => {
      try {
        // Authenticate socket connection
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        socket.userRole = decoded.role;

        // Store connected user
        this.connectedUsers.set(socket.id, decoded.id);

        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`🔌 User ${socket.userId} connected (${socket.userRole})`);

      // Handle bus subscription
      socket.on('subscribeToBus', (busId) => {
        this.subscribeToBus(socket, busId);
      });

      // Handle bus unsubscription
      socket.on('unsubscribeFromBus', (busId) => {
        this.unsubscribeFromBus(socket, busId);
      });

      // Handle location sharing status requests
      socket.on('getLocationSharingStatus', (busId) => {
        this.sendLocationSharingStatus(socket, busId);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`🔌 User ${socket.userId} disconnected`);
        this.handleDisconnect(socket);
      });

      // Send welcome message
      socket.emit('connected', {
        message: 'Successfully connected to bus tracking system',
        userId: socket.userId,
        role: socket.userRole
      });
    });
  }

  subscribeToBus(socket, busId) {
    if (!busId) return;

    // Initialize subscribers set if not exists
    if (!this.busSubscribers.has(busId)) {
      this.busSubscribers.set(busId, new Set());
    }

    // Add socket to subscribers
    this.busSubscribers.get(busId).add(socket.id);

    console.log(`📡 User ${socket.userId} subscribed to bus ${busId}`);

    // Send current bus status
    this.sendBusStatus(socket, busId);

    // Confirm subscription
    socket.emit('subscribedToBus', {
      busId,
      message: `Subscribed to bus ${busId} updates`
    });
  }

  unsubscribeFromBus(socket, busId) {
    if (!busId || !this.busSubscribers.has(busId)) return;

    // Remove socket from subscribers
    this.busSubscribers.get(busId).delete(socket.id);

    // Clean up empty subscriber sets
    if (this.busSubscribers.get(busId).size === 0) {
      this.busSubscribers.delete(busId);
    }

    console.log(`📡 User ${socket.userId} unsubscribed from bus ${busId}`);

    socket.emit('unsubscribedFromBus', {
      busId,
      message: `Unsubscribed from bus ${busId} updates`
    });
  }

  async sendBusStatus(socket, busId) {
    try {
      const { LiveBusLocation } = require('../models');

      const location = await LiveBusLocation.findByBusId(busId);

      if (location) {
        socket.emit('busStatus', {
          busId,
          isActive: location.isLocationSharing,
          lastLocation: {
            latitude: location.latitude,
            longitude: location.longitude,
            speedKmh: location.speedKmh,
            lastUpdated: location.lastUpdated
          }
        });
      } else {
        socket.emit('busStatus', {
          busId,
          isActive: false,
          message: 'Bus location sharing is not active'
        });
      }
    } catch (error) {
      console.error('Error sending bus status:', error);
      socket.emit('busStatus', {
        busId,
        isActive: false,
        error: 'Failed to get bus status'
      });
    }
  }

  async sendLocationSharingStatus(socket, busId) {
    try {
      const { LiveBusLocation } = require('../models');

      const location = await LiveBusLocation.findByBusId(busId);

      socket.emit('locationSharingStatus', {
        busId,
        isSharing: location ? location.isLocationSharing : false,
        driverId: location ? location.driverId : null
      });
    } catch (error) {
      console.error('Error sending location sharing status:', error);
      socket.emit('locationSharingStatus', {
        busId,
        isSharing: false,
        error: 'Failed to get sharing status'
      });
    }
  }

  handleDisconnect(socket) {
    // Remove from connected users
    this.connectedUsers.delete(socket.id);

    // Remove from all bus subscriptions
    for (const [busId, subscribers] of this.busSubscribers.entries()) {
      if (subscribers.has(socket.id)) {
        subscribers.delete(socket.id);

        // Clean up empty subscriber sets
        if (subscribers.size === 0) {
          this.busSubscribers.delete(busId);
        }
      }
    }
  }

  // Emit to all connected clients
  emitToAll(event, data) {
    if (!this.io) return;

    this.io.emit(event, data);
  }

  // Emit to specific bus subscribers
  emitToBusSubscribers(busId, event, data) {
    if (!this.io || !this.busSubscribers.has(busId)) return;

    const subscribers = this.busSubscribers.get(busId);
    subscribers.forEach(socketId => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit(event, data);
      }
    });
  }

  // Emit to specific user
  emitToUser(userId, event, data) {
    if (!this.io) return;

    // Find socket for user
    for (const [socketId, socketUserId] of this.connectedUsers.entries()) {
      if (socketUserId === userId) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit(event, data);
        }
      }
    }
  }

  // Get connection stats
  getStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      activeSubscriptions: this.busSubscribers.size,
      totalSubscriptions: Array.from(this.busSubscribers.values())
        .reduce((total, subscribers) => total + subscribers.size, 0)
    };
  }

  // Broadcast system announcements
  broadcastAnnouncement(message, level = 'info') {
    this.emitToAll('announcement', {
      message,
      level, // 'info', 'warning', 'error'
      timestamp: new Date().toISOString()
    });
  }

  // Send emergency alerts to all users
  sendEmergencyAlert(message, busId = null) {
    const alertData = {
      message,
      type: 'emergency',
      busId,
      timestamp: new Date().toISOString()
    };

    if (busId) {
      this.emitToBusSubscribers(busId, 'emergencyAlert', alertData);
    } else {
      this.emitToAll('emergencyAlert', alertData);
    }
  }
}

module.exports = new SocketService();
