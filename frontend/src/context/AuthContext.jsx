import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [skipAuthCheck, setSkipAuthCheck] = useState(false);

  // Check if user is logged in on app start
  useEffect(() => {
    const checkAuthStatus = async () => {
      // Skip auth check if we just logged in or already have user data
      if (skipAuthCheck || user) {
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        if (token) {
          // Verify token with server
          const response = await authService.verifyToken();
          if (response.valid) {
            setUser(response.user);
            setIsAuthenticated(true);
          } else {
            // Token is invalid, remove it
            localStorage.removeItem('token');
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      } catch (error) {
        // If backend is not available, don't clear token - allow manual login
        console.warn('Backend not available for auth check:', error.message);
        // Don't remove token or set user to null - let user try to login manually
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, [user, skipAuthCheck]);

  const login = async (email, password) => {
    try {
      setLoading(true);
      const response = await authService.login(email, password);

      // Store token
      localStorage.setItem('token', response.token);

      // Set user state
      setUser(response.user);
      setIsAuthenticated(true);
      setSkipAuthCheck(true); // Skip token verification after login

      toast.success(`Welcome back, ${response.user.name}!`);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          (error.code === 'ECONNREFUSED' ? 'Cannot connect to server. Please check if the backend is running.' : 'Login failed');
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Clear token
    localStorage.removeItem('token');

    // Clear user state
    setUser(null);
    setIsAuthenticated(false);
    setSkipAuthCheck(false);

    toast.success('Logged out successfully');
  };

  const updateProfile = async (userData) => {
    try {
      const response = await authService.updateProfile(userData);
      setUser(response.user);
      toast.success('Profile updated successfully');
      return response;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
      throw error;
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await authService.changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password');
      throw error;
    }
  };

  // Check if user has specific role
  const hasRole = (role) => {
    return user?.role === role;
  };

  // Check if user has any of the specified roles
  const hasAnyRole = (...roles) => {
    return roles.includes(user?.role);
  };

  // Check if user is admin
  const isAdmin = () => hasRole('admin');

  // Check if user is driver
  const isDriver = () => hasRole('driver');

  // Check if user is passenger
  const isPassenger = () => hasRole('passenger');

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    updateProfile,
    changePassword,
    hasRole,
    hasAnyRole,
    isAdmin,
    isDriver,
    isPassenger,
    skipAuthCheck
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
