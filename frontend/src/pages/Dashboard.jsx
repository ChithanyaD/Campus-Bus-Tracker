import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to role-specific dashboard
    if (hasRole('admin')) {
      navigate('/admin', { replace: true });
    } else if (hasRole('driver')) {
      navigate('/driver', { replace: true });
    } else if (hasRole('passenger')) {
      navigate('/passenger', { replace: true });
    }
  }, [user, navigate, hasRole]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="spinner mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
};

export default Dashboard;
