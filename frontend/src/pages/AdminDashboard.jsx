import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FaBus,
  FaRoute,
  FaUsers,
  FaMapMarkedAlt,
  FaPlus,
  FaEye,
  FaCog
} from 'react-icons/fa';
import api from '../services/authService';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalBuses: 0,
    activeBuses: 0,
    totalUsers: 0,
    activeUsers: 0,
    totalRoutes: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [busStats, userStats, routesResponse] = await Promise.all([
          api.get('/buses/stats'),
          api.get('/users/stats'),
          api.get('/routes')
        ]);

        setStats({
          totalBuses: busStats.data.stats.totalBuses,
          activeBuses: busStats.data.stats.activeBuses,
          assignedBuses: busStats.data.stats.assignedBuses,
          totalUsers: userStats.data.stats.totalUsers,
          activeUsers: userStats.data.stats.activeUsers,
          totalRoutes: routesResponse.data.count
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Total Buses',
      value: stats.totalBuses,
      icon: FaBus,
      color: 'bg-blue-500',
      link: '/admin/buses'
    },
    {
      title: 'Active Buses',
      value: stats.activeBuses,
      icon: FaMapMarkedAlt,
      color: 'bg-green-500',
      link: '/admin/buses'
    },
    {
      title: 'Total Routes',
      value: stats.totalRoutes,
      icon: FaRoute,
      color: 'bg-purple-500',
      link: '/admin/routes'
    },
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: FaUsers,
      color: 'bg-orange-500',
      link: '/admin/users'
    }
  ];

  const quickActions = [
    {
      title: 'Add New Bus',
      description: 'Register a new bus in the system',
      icon: FaPlus,
      link: '/admin/buses',
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      title: 'Create Route',
      description: 'Define new bus routes and stops',
      icon: FaRoute,
      link: '/admin/routes',
      color: 'bg-green-600 hover:bg-green-700'
    },
    {
      title: 'Manage Users',
      description: 'Add drivers and passengers',
      icon: FaUsers,
      link: '/admin/users',
      color: 'bg-purple-600 hover:bg-purple-700'
    },
    {
      title: 'View Live Tracking',
      description: 'Monitor all active buses',
      icon: FaMapMarkedAlt,
      link: '/tracking',
      color: 'bg-orange-600 hover:bg-orange-700'
    }
  ];

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
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Manage buses, routes, and users in your college bus tracking system
          </p>
        </div>
        <Link
          to="/tracking"
          className="btn-primary flex items-center space-x-2"
        >
          <FaMapMarkedAlt />
          <span>Live Tracking</span>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <Link
            key={index}
            to={stat.link}
            className="card hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="flex items-center">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="text-white text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {quickActions.map((action, index) => (
            <Link
              key={index}
              to={action.link}
              className={`${action.color} text-white p-6 rounded-lg hover:shadow-lg transition-all duration-200`}
            >
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <action.icon className="text-2xl" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">{action.title}</h3>
                  <p className="text-sm opacity-90">{action.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">System Overview</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Bus Utilization</span>
              <span className="text-sm font-bold text-gray-900">
                {stats.totalBuses > 0
                  ? Math.round((stats.assignedBuses / stats.totalBuses) * 100)
                  : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Active Users</span>
              <span className="text-sm font-bold text-gray-900">
                {stats.activeUsers} / {stats.totalUsers}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Active Buses</span>
              <span className="text-sm font-bold text-gray-900">
                {stats.activeBuses} / {stats.totalBuses}
              </span>
            </div>
          </div>
        </div>

        {/* System Health */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">System Health</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Database Status</span>
              <span className="status-active">Online</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Real-time Updates</span>
              <span className="status-active">Active</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">API Status</span>
              <span className="status-active">Healthy</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">GPS Tracking</span>
              <span className="status-active">Operational</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
