/**
 * ETA Calculator Utility
 * Uses Haversine formula for distance calculation and speed-based ETA estimation
 */

class ETACalculator {
  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param {Object} coord1 - {lat, lng}
   * @param {Object} coord2 - {lat, lng}
   * @returns {number} Distance in kilometers
   */
  static calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in kilometers

    const lat1Rad = this.toRadians(coord1.lat);
    const lat2Rad = this.toRadians(coord2.lat);
    const deltaLatRad = this.toRadians(coord2.lat - coord1.lat);
    const deltaLngRad = this.toRadians(coord2.lng - coord1.lng);

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) *
      Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Convert degrees to radians
   * @param {number} degrees
   * @returns {number} Radians
   */
  static toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate ETA based on distance and speed
   * @param {number} distanceKm - Distance in kilometers
   * @param {number} speedKmh - Speed in km/h
   * @param {number} bufferMinutes - Additional buffer time in minutes (default: 2)
   * @returns {Object} ETA information
   */
  static calculateETA(distanceKm, speedKmh, bufferMinutes = 2) {
    if (!distanceKm || distanceKm <= 0) {
      return {
        eta: null,
        durationMinutes: 0,
        isRealtime: false,
        confidence: 'low'
      };
    }

    if (!speedKmh || speedKmh <= 0) {
      // Use average speed assumption if no speed data
      speedKmh = 25; // Assume 25 km/h average speed
    }

    const durationMinutes = (distanceKm / speedKmh) * 60;
    const totalMinutes = durationMinutes + bufferMinutes;

    const eta = new Date(Date.now() + totalMinutes * 60 * 1000);

    return {
      eta,
      durationMinutes: Math.round(totalMinutes),
      distanceKm: Math.round(distanceKm * 100) / 100,
      speedKmh: Math.round(speedKmh * 100) / 100,
      isRealtime: speedKmh > 0,
      confidence: speedKmh > 5 ? 'high' : 'medium'
    };
  }

  /**
   * Calculate average speed from recent location history
   * @param {Array} locations - Array of location objects with speedKmh and recordedAt
   * @param {number} timeWindowMinutes - Time window to consider (default: 10 minutes)
   * @returns {number} Average speed in km/h
   */
  static calculateAverageSpeed(locations, timeWindowMinutes = 10) {
    if (!locations || locations.length === 0) {
      return 0;
    }

    const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

    const recentLocations = locations.filter(loc =>
      new Date(loc.recordedAt) > cutoffTime &&
      loc.speedKmh &&
      loc.speedKmh > 0
    );

    if (recentLocations.length === 0) {
      return 0;
    }

    const totalSpeed = recentLocations.reduce((sum, loc) => sum + parseFloat(loc.speedKmh), 0);
    return totalSpeed / recentLocations.length;
  }

  /**
   * Smooth ETA calculation using multiple speed samples
   * @param {Array} speedSamples - Array of speed values in km/h
   * @param {number} distanceKm - Distance to destination in km
   * @returns {Object} Smoothed ETA calculation
   */
  static calculateSmoothedETA(speedSamples, distanceKm) {
    if (!speedSamples || speedSamples.length === 0 || !distanceKm) {
      return this.calculateETA(distanceKm, 0);
    }

    // Remove outliers (speeds that are too high or too low)
    const validSpeeds = speedSamples.filter(speed =>
      speed > 0 && speed < 120 // Reasonable speed limits
    );

    if (validSpeeds.length === 0) {
      return this.calculateETA(distanceKm, 0);
    }

    // Use weighted average (more recent samples have higher weight)
    let weightedSum = 0;
    let totalWeight = 0;

    validSpeeds.forEach((speed, index) => {
      const weight = index + 1; // Linear weighting
      weightedSum += speed * weight;
      totalWeight += weight;
    });

    const averageSpeed = weightedSum / totalWeight;

    return this.calculateETA(distanceKm, averageSpeed);
  }

  /**
   * Estimate time to next bus stop
   * @param {Object} busLocation - Current bus location {lat, lng}
   * @param {Object} stopLocation - Stop location {lat, lng}
   * @param {number} currentSpeed - Current speed in km/h
   * @param {Array} recentSpeeds - Array of recent speed readings
   * @returns {Object} ETA to stop
   */
  static estimateTimeToStop(busLocation, stopLocation, currentSpeed, recentSpeeds = []) {
    const distanceKm = this.calculateDistance(busLocation, stopLocation);

    if (distanceKm < 0.1) { // Less than 100 meters
      return {
        eta: new Date(Date.now() + 60 * 1000), // 1 minute
        durationMinutes: 1,
        distanceKm,
        isRealtime: true,
        confidence: 'high',
        status: 'arriving'
      };
    }

    // Use smoothed ETA calculation
    const speedSamples = recentSpeeds.length > 0 ? recentSpeeds : [currentSpeed];
    return this.calculateSmoothedETA(speedSamples, distanceKm);
  }

  /**
   * Format ETA for display
   * @param {Date} eta - ETA date object
   * @returns {string} Formatted ETA string
   */
  static formatETA(eta) {
    if (!eta) return 'N/A';

    const now = new Date();
    const diffMinutes = Math.round((eta - now) / (1000 * 60));

    if (diffMinutes < 1) {
      return 'Arriving now';
    } else if (diffMinutes === 1) {
      return '1 minute';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minutes`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;

      if (hours === 1 && minutes === 0) {
        return '1 hour';
      } else if (hours === 1) {
        return `1 hour ${minutes} min`;
      } else if (minutes === 0) {
        return `${hours} hours`;
      } else {
        return `${hours} hours ${minutes} min`;
      }
    }
  }

  /**
   * Get ETA confidence level based on data quality
   * @param {Object} etaData - ETA calculation result
   * @returns {string} Confidence level: 'high', 'medium', 'low'
   */
  static getETAConfidence(etaData) {
    if (!etaData.isRealtime) return 'low';
    if (etaData.confidence) return etaData.confidence;

    // Fallback logic
    if (etaData.distanceKm < 1) return 'high';
    if (etaData.distanceKm < 5) return 'medium';
    return 'low';
  }
}

module.exports = ETACalculator;
