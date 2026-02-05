// GPS Location Service using browser's native Geolocation API
// No external dependencies required - uses HTML5 Geolocation API

class LocationService {
  constructor() {
    this.watchId = null;
    this.currentPosition = null;
    this.isTracking = false;
    this.callbacks = [];
  }

  // Check if geolocation is supported
  isSupported() {
    return 'geolocation' in navigator;
  }

  // Get current position once
  async getCurrentPosition(options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      const defaultOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
        ...options
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = this.formatPositionData(position);
          this.currentPosition = locationData;
          resolve(locationData);
        },
        (error) => {
          reject(this.formatError(error));
        },
        defaultOptions
      );
    });
  }

  // Start continuous location tracking
  startTracking(callback, options = {}) {
    if (!this.isSupported()) {
      throw new Error('Geolocation is not supported by this browser');
    }

    if (this.isTracking) {
      this.stopTracking();
    }

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000, // 30 seconds
      ...options
    };

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const locationData = this.formatPositionData(position);
        this.currentPosition = locationData;

        // Call the callback
        if (callback) {
          callback(locationData);
        }

        // Call all registered callbacks
        this.callbacks.forEach(cb => cb(locationData));
      },
      (error) => {
        console.error('Location tracking error:', this.formatError(error));
      },
      defaultOptions
    );

    this.isTracking = true;
    return this.watchId;
  }

  // Stop location tracking
  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
  }

  // Add callback for location updates
  onLocationUpdate(callback) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  // Remove callback
  offLocationUpdate(callback) {
    this.callbacks = this.callbacks.filter(cb => cb !== callback);
  }

  // Get last known position
  getLastPosition() {
    return this.currentPosition;
  }

  // Check if currently tracking
  isCurrentlyTracking() {
    return this.isTracking;
  }

  // Format position data consistently
  formatPositionData(position) {
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      altitudeAccuracy: position.coords.altitudeAccuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp,
      // Additional calculated fields
      speedKmh: position.coords.speed ? position.coords.speed * 3.6 : null,
      coordinates: [position.coords.latitude, position.coords.longitude]
    };
  }

  // Format geolocation errors
  formatError(error) {
    const errorMessages = {
      1: 'Location access denied by user',
      2: 'Location information unavailable',
      3: 'Location request timed out',
      0: 'Unknown location error'
    };

    return new Error(errorMessages[error.code] || errorMessages[0]);
  }

  // Calculate distance between two points (Haversine formula)
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng/2) * Math.sin(dLng/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000; // Return distance in meters
  }

  // Convert degrees to radians
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Request location permissions
  async requestPermissions() {
    if (!this.isSupported()) {
      throw new Error('Geolocation is not supported');
    }

    try {
      // Try to get current position to trigger permission request
      await this.getCurrentPosition();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Create singleton instance
const locationService = new LocationService();

export default locationService;