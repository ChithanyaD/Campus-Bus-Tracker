import { useState, useEffect } from 'react';
import { FaBus, FaMapMarkedAlt, FaSearch } from 'react-icons/fa';
import L from 'leaflet';
import { io } from 'socket.io-client';
import api from '../services/authService';
import toast from 'react-hot-toast';
import MapComponent from '../components/MapComponent';

const LiveTracking = () => {
  const [activeLocations, setActiveLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [mapMarkers, setMapMarkers] = useState([]);
  const [selectedBus, setSelectedBus] = useState(null);

  useEffect(() => {
    fetchActiveLocations();

    // Set up polling for real-time updates (fallback for when WebSocket isn't available)
    const interval = setInterval(fetchActiveLocations, 30000); // Update every 30 seconds

    // Setup Socket.IO for real-time updates.
    // Use the current origin so that, when running behind ngrok, the
    // WebSocket traffic goes through Vite's proxy at /socket.io.
    const socket = io('/', {
      auth: { token: localStorage.getItem('token') },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });

    // When a single bus location updates, patch it into state immediately
    // so cards and map update in real time.
    socket.on('locationUpdate', (data) => {
      setActiveLocations(prev => {
        if (!prev || prev.length === 0) return prev;
        const idx = prev.findIndex(loc => loc.busId === data.busId);
        if (idx === -1) return prev;

        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          latitude: data.location.latitude,
          longitude: data.location.longitude,
          speedKmh: data.location.speedKmh,
          lastUpdated: data.location.lastUpdated,
          nextStop: data.location.nextStop || updated[idx].nextStop,
          etaToNextStop: data.location.etaToNextStop || updated[idx].etaToNextStop
        };
        return updated;
      });

      // Also refresh markers so the bus icon moves without reload.
      setMapMarkers(prevMarkers => {
        if (!prevMarkers || prevMarkers.length === 0) return prevMarkers;
        return prevMarkers.map(marker => {
          // Match by bus number in title if possible
          if (!marker.title) return marker;
          const match = activeLocations.find(loc =>
            marker.title.includes(loc.bus.busNumber)
          );
          if (!match || match.busId !== data.busId) return marker;
          return {
            ...marker,
            position: [data.location.latitude, data.location.longitude]
          };
        });
      });
    });

    // When sharing starts/stops, refresh active list
    socket.on('locationSharingStarted', () => fetchActiveLocations());
    socket.on('locationSharingStopped', () => fetchActiveLocations());

    socket.on('connect_error', (err) => {
      console.warn('Socket connect error:', err.message || err);
    });

    return () => {
      clearInterval(interval);
      try { socket.disconnect(); } catch (e) {}
    };
  }, []);

  const fetchActiveLocations = async () => {
    try {
      const response = await api.get('/locations');
      const locations = response.data.locations;
      setActiveLocations(locations);

      // Create map markers for all active buses
      const markers = locations.map(location => ({
        position: [location.latitude, location.longitude],
        title: `${location.bus.busNumber} - ${location.bus.busName || 'Bus'}`,
        popup: `
          <div class="p-2">
            <strong>${location.bus.busNumber}</strong><br>
            ${location.bus.busName || 'Unnamed Bus'}<br>
            Driver: ${location.driver.name}<br>
            Speed: ${location.speedKmh ? location.speedKmh.toFixed(1) + ' km/h' : 'N/A'}<br>
            Next Stop: ${location.nextStop?.name || 'N/A'}<br>
            ETA: ${formatETA(location.etaToNextStop)}
          </div>
        `,
        options: {
          icon: L.divIcon({
            className: 'custom-bus-marker',
            html: '<div class="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">🚍</div>',
            iconSize: [32, 32],
            iconAnchor: [16, 32]
          })
        }
      }));

      setMapMarkers(markers);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLocations = activeLocations.filter(location =>
    location.bus.busNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (location.bus.busName && location.bus.busName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
          <h1 className="text-3xl font-bold text-gray-900">Live Bus Tracking</h1>
          <p className="text-gray-600 mt-2">
            Real-time location and ETA information for all active buses
          </p>
        </div>
        <button
          onClick={fetchActiveLocations}
          className="btn-primary flex items-center space-x-2"
        >
          <FaMapMarkedAlt />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <FaSearch className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search buses by number or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Active Buses */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLocations.map((location) => (
          <div key={location.busId} className="card hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
                  <FaBus className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {location.bus.busNumber}
                  </h3>
                  {location.bus.busName && (
                    <p className="text-sm text-gray-600">{location.bus.busName}</p>
                  )}
                </div>
              </div>
              <span className="status-active">Active</span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Driver:</span>
                <span>{location.driver?.name || 'Unknown'}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Speed:</span>
                <span>{location.speedKmh ? `${parseFloat(location.speedKmh).toFixed(1)} km/h` : 'N/A'}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Last Update:</span>
                <span className="text-xs">
                  {new Date(location.lastUpdated).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* ETA Information */}
            {location.etaToNextStop && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-green-800">Next Stop ETA</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    location.etaToNextStop.confidence === 'high' ? 'bg-green-200 text-green-800' :
                    location.etaToNextStop.confidence === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-red-200 text-red-800'
                  }`}>
                    {location.etaToNextStop.confidence}
                  </span>
                </div>

                <div className="text-lg font-bold text-green-600 mb-1">
                  {formatETA(new Date(location.etaToNextStop.eta))}
                </div>

                <div className="text-xs text-green-700">
                  to {location.nextStop?.name || 'next stop'} • {location.etaToNextStop.distanceKm?.toFixed(2)} km away
                </div>
              </div>
            )}

            {/* Live Map */}
            <div className="mt-4 h-64 bg-gray-100 rounded-lg overflow-hidden">
              <MapComponent
                center={selectedBus ? [selectedBus.latitude, selectedBus.longitude] : [12.9716, 77.5946]}
                zoom={selectedBus ? 16 : 12}
                markers={selectedBus ? [mapMarkers.find(m => m.title.includes(selectedBus.bus.busNumber))] : mapMarkers}
                className="h-full w-full"
              />
            </div>
          </div>
        ))}
      </div>

      {filteredLocations.length === 0 && (
        <div className="text-center py-12">
          <FaBus className="text-6xl text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {activeLocations.length === 0 ? 'No Active Buses' : 'No Buses Found'}
          </h3>
          <p className="text-gray-600">
            {activeLocations.length === 0
              ? 'There are no buses currently sharing their location.'
              : 'Try adjusting your search criteria.'
            }
          </p>
        </div>
      )}

      {/* System Info */}
      <div className="card bg-blue-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-blue-900">System Status</h3>
            <p className="text-sm text-blue-700 mt-1">
              Tracking {activeLocations.length} active bus{activeLocations.length !== 1 ? 'es' : ''}
              • Last updated: {new Date().toLocaleTimeString()}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">{activeLocations.length}</div>
            <div className="text-sm text-blue-700">Active Buses</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTracking;
