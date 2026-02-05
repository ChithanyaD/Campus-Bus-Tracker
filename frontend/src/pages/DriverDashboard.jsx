import { useState, useEffect } from 'react';
import { FaPlay, FaStop, FaMapMarkedAlt, FaRoute, FaClock, FaLocationArrow } from 'react-icons/fa';
import api from '../services/authService';
import locationService from '../services/locationService';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import MapComponent from '../components/MapComponent';

const DriverDashboard = () => {
  const { user } = useAuth();
  const [bus, setBus] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [mapMarkers, setMapMarkers] = useState([]);

  useEffect(() => {
    fetchDriverData();
    fetchRoutes();

    // Cleanup location tracking on unmount
    return () => {
      if (locationService.isCurrentlyTracking()) {
        locationService.stopTracking();
      }
    };
  }, []);

  const fetchDriverData = async () => {
    try {
      // Get assigned bus for this driver
      const busesResponse = await api.get('/buses');
      const driverBus = busesResponse.data.buses.find(b => b.driverId === user.id);

      if (driverBus) {
        setBus(driverBus);

        // Check if location sharing is active
        const locationResponse = await api.get(`/locations/bus/${driverBus.id}`);
        if (locationResponse.data.location) {
          setIsSharingLocation(locationResponse.data.location.isLocationSharing);
          setCurrentLocation({
            lat: locationResponse.data.location.latitude,
            lng: locationResponse.data.location.longitude
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch driver data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoutes = async () => {
    try {
      const response = await api.get('/routes');
      setRoutes(response.data.routes);
    } catch (error) {
      console.error('Failed to fetch routes:', error);
    }
  };

  const startLocationSharing = async () => {
    if (!bus) {
      toast.error('No bus assigned to you');
      return;
    }

    if (!selectedRoute) {
      toast.error('Please select a route first');
      return;
    }

    try {
      setLocationLoading(true);

      // Check if geolocation is supported
      if (!locationService.isSupported()) {
        toast.error('Geolocation is not supported by this browser');
        return;
      }

      // Request location permissions
      const hasPermission = await locationService.requestPermissions();
      if (!hasPermission) {
        toast.error('Location permission denied. Please enable location access.');
        return;
      }

      // Start location sharing
      const response = await api.post('/locations/start', {
        busId: bus.id,
        routeId: selectedRoute
      });

      setTripId(response.data.tripId);
      setIsSharingLocation(true);

      // Start location tracking using our service
      locationService.startTracking(
        async (locationData) => {
          const { latitude, longitude, speedKmh, heading, accuracy } = locationData;

          setCurrentLocation({ lat: latitude, lng: longitude });

          // Update map marker
          setMapMarkers([{
            position: [latitude, longitude],
            title: 'Your Location',
            popup: `Speed: ${speedKmh ? speedKmh.toFixed(1) + ' km/h' : 'N/A'}<br>Accuracy: ${accuracy ? accuracy.toFixed(0) + 'm' : 'N/A'}`
          }]);

          try {
            // Send location update to server
            await api.put('/locations/update', {
              busId: bus.id,
              latitude,
              longitude,
              speedKmh: speedKmh || 0,
              heading: heading || 0,
              accuracyMeters: accuracy || 0
            });
          } catch (error) {
            console.error('Failed to update location:', error);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        }
      );
      toast.success('Location sharing started successfully');

    } catch (error) {
      console.error('Failed to start location sharing:', error);
      toast.error(error.response?.data?.message || 'Failed to start location sharing');
    } finally {
      setLocationLoading(false);
    }
  };

  const stopLocationSharing = async () => {
    if (!bus) return;

    try {
      setLocationLoading(true);

      await api.post('/locations/stop', { busId: bus.id });

      setIsSharingLocation(false);
      setTripId(null);

      // Stop location tracking
      if (locationService.isCurrentlyTracking()) {
        locationService.stopTracking();
      }

      toast.success('Location sharing stopped');

    } catch (error) {
      console.error('Failed to stop location sharing:', error);
      toast.error('Failed to stop location sharing');
    } finally {
      setLocationLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!bus) {
    return (
      <div className="text-center py-12">
        <FaBus className="text-6xl text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No Bus Assigned</h2>
        <p className="text-gray-600">
          You don't have a bus assigned to you yet. Please contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Driver Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Manage your bus and share your location with passengers
          </p>
        </div>
      </div>

      {/* Bus Information */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Bus</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm font-medium text-gray-600">Bus Number</p>
            <p className="text-lg font-bold text-gray-900">{bus.busNumber}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Bus Name</p>
            <p className="text-lg font-bold text-gray-900">{bus.busName || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Capacity</p>
            <p className="text-lg font-bold text-gray-900">{bus.capacity} passengers</p>
          </div>
        </div>
      </div>

      {/* Route Selection */}
      {!isSharingLocation && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Route</h2>
          <div className="max-w-md">
            <label htmlFor="route" className="block text-sm font-medium text-gray-700 mb-2">
              Choose the route for this trip
            </label>
            <select
              id="route"
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="input"
            >
              <option value="">Select a route...</option>
              {routes.map(route => (
                <option key={route.id} value={route.id}>
                  {route.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Location Sharing Controls */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Location Sharing</h2>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`w-4 h-4 rounded-full ${isSharingLocation ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <div>
              <p className="font-medium text-gray-900">
                {isSharingLocation ? 'Sharing Location' : 'Location Sharing Stopped'}
              </p>
              {isSharingLocation && currentLocation && (
                <p className="text-sm text-gray-600">
                  Lat: {currentLocation.lat.toFixed(6)}, Lng: {currentLocation.lng.toFixed(6)}
                </p>
              )}
            </div>
          </div>

          <div className="flex space-x-3">
            {!isSharingLocation ? (
              <button
                onClick={startLocationSharing}
                disabled={locationLoading || !selectedRoute}
                className="btn-success flex items-center space-x-2 disabled:opacity-50"
              >
                {locationLoading ? (
                  <div className="spinner"></div>
                ) : (
                  <FaPlay />
                )}
                <span>Start Sharing</span>
              </button>
            ) : (
              <button
                onClick={stopLocationSharing}
                disabled={locationLoading}
                className="btn-danger flex items-center space-x-2 disabled:opacity-50"
              >
                {locationLoading ? (
                  <div className="spinner"></div>
                ) : (
                  <FaStop />
                )}
                <span>Stop Sharing</span>
              </button>
            )}
          </div>
        </div>

        {isSharingLocation && (
          <div className="mt-6 p-4 bg-green-50 rounded-lg">
            <div className="flex items-center space-x-2 text-green-800">
              <FaLocationArrow />
              <span className="font-medium">Live tracking is active</span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              Passengers can now see your bus location in real-time. Your location updates every 5-10 seconds.
            </p>
          </div>
        )}
      </div>

      {/* Map View */}
      {isSharingLocation && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Live Location Map</h2>
          <MapComponent
            center={currentLocation ? [currentLocation.lat, currentLocation.lng] : [12.9716, 77.5946]}
            zoom={15}
            markers={mapMarkers}
            className="h-96 rounded-lg"
          />
        </div>
      )}

      {/* Trip Information */}
      {isSharingLocation && tripId && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Trip</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Trip ID</p>
              <p className="text-lg font-mono text-gray-900">{tripId}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Started At</p>
              <p className="text-lg text-gray-900">{new Date().toLocaleTimeString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="card bg-blue-50">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Driver Instructions</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Select your route before starting location sharing</li>
          <li>• Ensure GPS permissions are enabled in your browser</li>
          <li>• Keep the app running to maintain location sharing</li>
          <li>• Location updates are sent every 5-10 seconds</li>
          <li>• Stop sharing when your trip is complete</li>
        </ul>
      </div>
    </div>
  );
};

export default DriverDashboard;
