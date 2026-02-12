import { useState, useEffect } from 'react';
import {
  FaBus,
  FaMapMarkedAlt,
  FaRoute,
  FaClock,
  FaLocationArrow,
  FaSearch
} from 'react-icons/fa';
import { io } from 'socket.io-client';
import api from '../services/authService';
import toast from 'react-hot-toast';

const PassengerDashboard = () => {
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedBus, setSelectedBus] = useState('');
  const [busLocation, setBusLocation] = useState(null);
  const [route, setRoute] = useState(null);
  const [busStops, setBusStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Set up Socket.IO when tracking a specific bus
  useEffect(() => {
    if (!tracking || !selectedBus) return;

    const backendUrl = (import.meta.env.VITE_BACKEND_URL || window.location.origin).replace(/\/$/, '');
    const socket = io(backendUrl, {
      auth: { token: localStorage.getItem('token') },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      setSocketConnected(true);
      // Subscribe to this specific bus for richer future updates if needed
      socket.emit('subscribeToBus', selectedBus);
    });

    // Real-time location updates for the selected bus
    socket.on('locationUpdate', (data) => {
      if (data.busId !== selectedBus) return;
      setBusLocation(prev => ({
        ...(prev || {}),
        ...data.location
      }));
    });

    // If driver stops sharing, automatically stop tracking on passenger side
    socket.on('locationSharingStopped', (data) => {
      if (data.busId !== selectedBus) return;
      toast('Driver stopped location sharing for this bus');
      stopTracking();
    });

    socket.on('connect_error', (err) => {
      console.warn('Passenger socket connect error:', err.message || err);
      setSocketConnected(false);
    });

    return () => {
      try {
        socket.emit('unsubscribeFromBus', selectedBus);
      } catch (e) {
        // ignore
      }
      socket.disconnect();
      setSocketConnected(false);
    };
  }, [tracking, selectedBus]);

  const fetchInitialData = async () => {
    try {
      const [busesResponse, routesResponse] = await Promise.all([
        api.get('/buses'),
        api.get('/routes')
      ]);

      setBuses(busesResponse.data.buses);
      setRoutes(routesResponse.data.routes);
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const startTracking = async (busId) => {
    try {
      setTracking(true);
      setSelectedBus(busId);

      // Get bus location
      const locationResponse = await api.get(`/locations/bus/${busId}`);
      const location = locationResponse.data.location;

      if (location) {
        setBusLocation(location);

        // Get route information
        if (location.currentRouteId) {
          const routeResponse = await api.get(`/routes/${location.currentRouteId}`);
          setRoute(routeResponse.data.route);

          const stopsResponse = await api.get(`/routes/${location.currentRouteId}/stops`);
          setBusStops(stopsResponse.data.stops);
        }

        toast.success('Now tracking bus location');
      } else {
        toast.error('Bus location not available');
        setTracking(false);
        setSelectedBus('');
      }
    } catch (error) {
      console.error('Failed to start tracking:', error);
      toast.error('Failed to track bus');
      setTracking(false);
      setSelectedBus('');
    }
  };

  const stopTracking = () => {
    setSelectedBus('');
    setBusLocation(null);
    setRoute(null);
    setBusStops([]);
    setTracking(false);
    toast.success('Stopped tracking');
  };

  const getSelectedBus = () => {
    return buses.find(bus => bus.id === selectedBus);
  };

  const formatETA = (eta) => {
    if (!eta) return 'N/A';

    const now = new Date();
    const diffMinutes = Math.round((eta - now) / (1000 * 60));

    if (diffMinutes < 1) return 'Arriving now';
    if (diffMinutes === 1) return '1 minute';
    if (diffMinutes < 60) return `${diffMinutes} minutes`;

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    if (hours === 1 && minutes === 0) return '1 hour';
    if (hours === 1) return `1 hour ${minutes} min`;
    if (minutes === 0) return `${hours} hours`;
    return `${hours} hours ${minutes} min`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Passenger Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Track buses and get real-time ETAs for your journey
          </p>
        </div>
      </div>

      {/* Bus Selection */}
      {!tracking ? (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Select a Bus to Track</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {buses
              .filter(bus => bus.isActive)
              .map(bus => (
                <div
                  key={bus.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => startTracking(bus.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <FaBus className="text-primary-600 text-xl" />
                      <div>
                        <h3 className="font-semibold text-gray-900">{bus.busNumber}</h3>
                        {bus.busName && (
                          <p className="text-sm text-gray-600">{bus.busName}</p>
                        )}
                      </div>
                    </div>
                    <span className="status-active">Active</span>
                  </div>

                  <div className="text-sm text-gray-600">
                    <p>Capacity: {bus.capacity} passengers</p>
                    {bus.driver && (
                      <p>Driver: {bus.driver.name}</p>
                    )}
                  </div>

                  <button
                    className="w-full mt-4 btn-primary flex items-center justify-center space-x-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      startTracking(bus.id);
                    }}
                  >
                    <FaMapMarkedAlt />
                    <span>Track This Bus</span>
                  </button>
                </div>
              ))}
          </div>

          {buses.filter(bus => bus.isActive).length === 0 && (
            <div className="text-center py-12">
              <FaBus className="text-6xl text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Buses</h3>
              <p className="text-gray-600">
                There are no active buses available for tracking right now.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Live Tracking View */
        <div className="space-y-6">
          {/* Tracking Header */}
          <div className="card bg-primary-50 border-primary-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center">
                  <FaBus className="text-white text-xl" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Tracking {getSelectedBus()?.busNumber}
                  </h2>
                  <p className="text-gray-600">
                    {route ? `Route: ${route.name}` : 'Route information unavailable'}
                  </p>
                </div>
              </div>
              <button
                onClick={stopTracking}
                className="btn-secondary"
              >
                Stop Tracking
              </button>
            </div>
          </div>

          {/* Live Location & ETA */}
          {busLocation && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Current Location */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FaLocationArrow className="mr-2 text-primary-600" />
                  Current Location
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Latitude:</span>
                    <span className="font-mono">{parseFloat(busLocation.latitude).toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Longitude:</span>
                    <span className="font-mono">{parseFloat(busLocation.longitude).toFixed(6)}</span>
                  </div>
                  {busLocation.speedKmh && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Speed:</span>
                      <span>{parseFloat(busLocation.speedKmh).toFixed(1)} km/h</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Update:</span>
                    <span>{new Date(busLocation.lastUpdated).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>

              {/* ETA Information */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FaClock className="mr-2 text-green-600" />
                  Estimated Time of Arrival
                </h3>

                {busLocation.etaToNextStop ? (
                  <div className="space-y-3">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-3xl font-bold text-green-600 mb-2">
                        {formatETA(new Date(busLocation.etaToNextStop.eta))}
                      </div>
                      <p className="text-sm text-green-700">
                        to {busLocation.nextStop?.name || 'next stop'}
                      </p>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Distance:</span>
                        <span>{busLocation.etaToNextStop.distanceKm?.toFixed(2)} km</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Avg Speed:</span>
                        <span>{busLocation.etaToNextStop.speedKmh?.toFixed(1)} km/h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">ETA Confidence:</span>
                        <span className={`capitalize ${
                          busLocation.etaToNextStop.confidence === 'high' ? 'text-green-600' :
                          busLocation.etaToNextStop.confidence === 'medium' ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {busLocation.etaToNextStop.confidence}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 text-gray-500">
                    <FaClock className="text-4xl mx-auto mb-4 opacity-50" />
                    <p>ETA information not available</p>
                    <p className="text-sm mt-2">
                      The bus may not be on a defined route or GPS signal is weak.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Route Stops */}
          {route && busStops.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FaRoute className="mr-2 text-blue-600" />
                Route Stops
              </h3>

              <div className="space-y-3">
                {busStops.map((stop, index) => (
                  <div
                    key={stop.id}
                    className={`flex items-center space-x-4 p-3 rounded-lg ${
                      busLocation?.nextStop?.id === stop.id
                        ? 'bg-primary-50 border border-primary-200'
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      busLocation?.nextStop?.id === stop.id
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-300 text-gray-700'
                    }`}>
                      {stop.stopOrder}
                    </div>

                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{stop.name}</h4>
                      {stop.estimatedArrivalTime && (
                        <p className="text-sm text-gray-600">
                          Scheduled: {stop.estimatedArrivalTime}
                        </p>
                      )}
                    </div>

                    {busLocation?.nextStop?.id === stop.id && (
                      <div className="text-right">
                        <span className="text-sm font-medium text-primary-600">Next Stop</span>
                        {busLocation.etaToNextStop && (
                          <p className="text-xs text-gray-500">
                            ETA: {formatETA(new Date(busLocation.etaToNextStop.eta))}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Map Placeholder */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Live Map</h3>
            <div className="map-container bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-500">
                <FaMapMarkedAlt className="text-4xl mx-auto mb-4 opacity-50" />
                <p>Interactive map would be displayed here</p>
                <p className="text-sm mt-2">
                  Showing real-time bus location and route
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PassengerDashboard;
