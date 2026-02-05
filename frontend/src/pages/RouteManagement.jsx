import { useState, useEffect } from 'react';
import { FaPlus, FaRoute, FaMapMarkerAlt } from 'react-icons/fa';
import api from '../services/authService';
import toast from 'react-hot-toast';

const RouteManagement = () => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      const response = await api.get('/routes');
      setRoutes(response.data.routes);
    } catch (error) {
      console.error('Failed to fetch routes:', error);
      toast.error('Failed to load routes');
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-3xl font-bold text-gray-900">Route Management</h1>
          <p className="text-gray-600 mt-2">
            Create and manage bus routes with stops and coordinates
          </p>
        </div>
        <button className="btn-primary flex items-center space-x-2">
          <FaPlus />
          <span>Add Route</span>
        </button>
      </div>

      {/* Routes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {routes.map((route) => (
          <div key={route.id} className="card">
            <div className="flex items-center space-x-3 mb-4">
              <FaRoute className="text-primary-600 text-xl" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{route.name}</h3>
                <p className="text-sm text-gray-600">{route.busStops?.length || 0} stops</p>
              </div>
            </div>

            {route.description && (
              <p className="text-gray-700 mb-4">{route.description}</p>
            )}

            <div className="flex justify-between text-sm text-gray-600">
              <span>Distance: {route.distanceKm} km</span>
              <span>Duration: {route.estimatedDurationMinutes} min</span>
            </div>
          </div>
        ))}
      </div>

      {routes.length === 0 && (
        <div className="text-center py-12">
          <FaRoute className="text-6xl text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Routes Yet</h3>
          <p className="text-gray-600">
            Create your first bus route to get started.
          </p>
        </div>
      )}
    </div>
  );
};

export default RouteManagement;
