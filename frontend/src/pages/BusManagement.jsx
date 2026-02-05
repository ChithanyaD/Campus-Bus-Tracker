import { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaUser, FaMapMarkerAlt, FaTimes } from 'react-icons/fa';
import api from '../services/authService';
import toast from 'react-hot-toast';
import MapComponent from '../components/MapComponent';

const BusManagement = () => {
  const [buses, setBuses] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBus, setEditingBus] = useState(null);
  const [formData, setFormData] = useState({
    busNumber: '',
    busName: '',
    capacity: 50
  });

  // Bus stops management state
  const [selectedBus, setSelectedBus] = useState(null);
  const [busStops, setBusStops] = useState([]);
  const [showBusStopsModal, setShowBusStopsModal] = useState(false);
  const [showAddStopModal, setShowAddStopModal] = useState(false);
  const [stopFormData, setStopFormData] = useState({
    name: '',
    latitude: '',
    longitude: ''
  });
  const [mapMarkers, setMapMarkers] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [busesResponse, usersResponse] = await Promise.all([
        api.get('/buses'),
        api.get('/users?role=driver')
      ]);

      setBuses(busesResponse.data.buses);
      setDrivers(usersResponse.data.users);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingBus) {
        await api.put(`/buses/${editingBus.id}`, formData);
        toast.success('Bus updated successfully');
      } else {
        await api.post('/buses', formData);
        toast.success('Bus created successfully');
      }

      setShowModal(false);
      setEditingBus(null);
      setFormData({ busNumber: '', busName: '', capacity: 50 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
    }
  };

  const handleEdit = (bus) => {
    setEditingBus(bus);
    setFormData({
      busNumber: bus.busNumber,
      busName: bus.busName || '',
      capacity: bus.capacity
    });
    setShowModal(true);
  };

  const handleDelete = async (busId) => {
    if (!window.confirm('Are you sure you want to delete this bus?')) return;

    try {
      await api.delete(`/buses/${busId}`);
      toast.success('Bus deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete bus');
    }
  };

  const handleAssignDriver = async (busId, driverId) => {
    try {
      if (driverId) {
        await api.put(`/buses/${busId}/assign-driver`, { driverId });
        toast.success('Driver assigned successfully');
      } else {
        await api.put(`/buses/${busId}/unassign-driver`);
        toast.success('Driver unassigned successfully');
      }
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update driver assignment');
    }
  };

  // Bus stops management functions
  const handleManageBusStops = async (bus) => {
    setSelectedBus(bus);
    await fetchBusStops(bus.id);
    setShowBusStopsModal(true);
  };

  const fetchBusStops = async (busId) => {
    try {
      const response = await api.get(`/buses/${busId}/stops`);
      setBusStops(response.data.busStops);

      // Create map markers for bus stops
      const markers = response.data.busStops.map(stop => ({
        position: [parseFloat(stop.latitude), parseFloat(stop.longitude)],
        title: stop.name,
        popup: `
          <div class="p-2">
            <strong>${stop.name}</strong><br>
            Lat: ${stop.latitude}<br>
            Lng: ${stop.longitude}<br>
            Stop Order: ${stop.stopOrder}
          </div>
        `
      }));
      setMapMarkers(markers);
    } catch (error) {
      console.error('Failed to fetch bus stops:', error);
      toast.error('Failed to load bus stops');
    }
  };

  const handleAddBusStop = () => {
    if (!selectedBus.currentRouteId) {
      toast.error('Bus must be assigned to a route before adding stops');
      return;
    }
    setStopFormData({ name: '', latitude: '', longitude: '' });
    setShowAddStopModal(true);
  };

  const handleStopFormSubmit = async (e) => {
    e.preventDefault();

    if (!selectedBus) return;

    try {
      const stopData = {
        name: stopFormData.name,
        latitude: parseFloat(stopFormData.latitude),
        longitude: parseFloat(stopFormData.longitude)
      };

      await api.post(`/buses/${selectedBus.id}/stops`, stopData);
      toast.success('Bus stop added successfully');
      setShowAddStopModal(false);
      await fetchBusStops(selectedBus.id);
    } catch (error) {
      console.error('Failed to add bus stop:', error);
      toast.error(error.response?.data?.message || 'Failed to add bus stop');
    }
  };

  const handleRemoveBusStop = async (stopId) => {
    if (!selectedBus) return;

    if (!confirm('Are you sure you want to remove this bus stop?')) {
      return;
    }

    try {
      await api.delete(`/buses/${selectedBus.id}/stops/${stopId}`);
      toast.success('Bus stop removed successfully');
      await fetchBusStops(selectedBus.id);
    } catch (error) {
      console.error('Failed to remove bus stop:', error);
      toast.error('Failed to remove bus stop');
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
          <h1 className="text-3xl font-bold text-gray-900">Bus Management</h1>
          <p className="text-gray-600 mt-2">
            Manage buses, assign drivers, and monitor bus status
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <FaPlus />
          <span>Add Bus</span>
        </button>
      </div>

      {/* Buses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {buses.map((bus) => (
          <div key={bus.id} className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{bus.busNumber}</h3>
                {bus.busName && (
                  <p className="text-sm text-gray-600">{bus.busName}</p>
                )}
              </div>
              <span className={bus.isActive ? 'status-active' : 'status-inactive'}>
                {bus.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Capacity:</span>
                <span>{bus.capacity} passengers</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Driver:</span>
                <span>{bus.driver?.name || 'Not assigned'}</span>
              </div>
            </div>

            {/* Driver Assignment */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign Driver
              </label>
              <select
                value={bus.driverId || ''}
                onChange={(e) => handleAssignDriver(bus.id, e.target.value || null)}
                className="input text-sm"
              >
                <option value="">Select driver...</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex space-x-2 mb-2">
              <button
                onClick={() => handleEdit(bus)}
                className="flex-1 btn-secondary text-sm py-2"
              >
                <FaEdit className="inline mr-1" />
                Edit
              </button>
              <button
                onClick={() => handleDelete(bus.id)}
                className="flex-1 btn-danger text-sm py-2"
              >
                <FaTrash className="inline mr-1" />
                Delete
              </button>
            </div>

            {/* Bus Stops Management */}
            <button
              onClick={() => handleManageBusStops(bus)}
              className="w-full btn-primary text-sm py-2"
            >
              <FaMapMarkerAlt className="inline mr-1" />
              Manage Bus Stops
            </button>
          </div>
        ))}
      </div>

      {buses.length === 0 && (
        <div className="text-center py-12">
          <FaPlus className="text-6xl text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Buses Yet</h3>
          <p className="text-gray-600 mb-4">
            Get started by adding your first bus to the system.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary"
          >
            Add Your First Bus
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              {editingBus ? 'Edit Bus' : 'Add New Bus'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bus Number *
                </label>
                <input
                  type="text"
                  value={formData.busNumber}
                  onChange={(e) => setFormData({...formData, busNumber: e.target.value})}
                  className="input"
                  required
                  placeholder="e.g., BUS001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bus Name
                </label>
                <input
                  type="text"
                  value={formData.busName}
                  onChange={(e) => setFormData({...formData, busName: e.target.value})}
                  className="input"
                  placeholder="Optional display name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacity
                </label>
                <input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value)})}
                  className="input"
                  min="1"
                  max="200"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingBus(null);
                    setFormData({ busNumber: '', busName: '', capacity: 50 });
                  }}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary"
                >
                  {editingBus ? 'Update' : 'Add'} Bus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bus Stops Management Modal */}
      {showBusStopsModal && selectedBus && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">
                Manage Bus Stops - {selectedBus.busNumber}
              </h2>
              <button
                onClick={() => setShowBusStopsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="text-xl" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Current Bus Stops</h3>
                  <p className="text-gray-600">
                    {selectedBus.currentRouteId
                      ? 'Manage the stops this bus serves'
                      : 'Assign a route to this bus first to manage stops'
                    }
                  </p>
                  {!selectedBus.currentRouteId && (
                    <p className="text-sm text-orange-600 mt-1">
                      ⚠️ Bus must be assigned to a route before adding stops
                    </p>
                  )}
                </div>
                <button
                  onClick={handleAddBusStop}
                  disabled={!selectedBus.currentRouteId}
                  className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaPlus />
                  <span>Add Bus Stop</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bus Stops List */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-4">Bus Stops List</h4>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {busStops.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <FaMapMarkerAlt className="text-4xl mx-auto mb-2" />
                        <p>No bus stops assigned yet</p>
                      </div>
                    ) : (
                      busStops.map((stop) => (
                        <div key={stop.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">{stop.name}</p>
                            <p className="text-sm text-gray-600">
                              Lat: {stop.latitude}, Lng: {stop.longitude}
                            </p>
                            <p className="text-xs text-gray-500">Order: {stop.stopOrder}</p>
                          </div>
                          <button
                            onClick={() => handleRemoveBusStop(stop.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Remove bus stop"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Map View */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-4">Map View</h4>
                  <div className="h-96 bg-gray-100 rounded-lg overflow-hidden">
                    <MapComponent
                      center={busStops.length > 0 ? [parseFloat(busStops[0].latitude), parseFloat(busStops[0].longitude)] : [12.9716, 77.5946]}
                      zoom={busStops.length > 0 ? 14 : 10}
                      markers={mapMarkers}
                      className="h-full w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Bus Stop Modal */}
      {showAddStopModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Add Bus Stop</h2>
              <button
                onClick={() => setShowAddStopModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="text-xl" />
              </button>
            </div>

            <form onSubmit={handleStopFormSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stop Name
                </label>
                <input
                  type="text"
                  value={stopFormData.name}
                  onChange={(e) => setStopFormData({...stopFormData, name: e.target.value})}
                  className="input"
                  placeholder="Enter stop name"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={stopFormData.latitude}
                    onChange={(e) => setStopFormData({...stopFormData, latitude: e.target.value})}
                    className="input"
                    placeholder="12.9716"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={stopFormData.longitude}
                    onChange={(e) => setStopFormData({...stopFormData, longitude: e.target.value})}
                    className="input"
                    placeholder="77.5946"
                    required
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddStopModal(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary"
                >
                  Add Stop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusManagement;
