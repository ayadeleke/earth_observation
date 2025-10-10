/**
 * ProtectedRoute component to handle authentication and Earth Engine requirements
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireEarthEngine?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireEarthEngine = false 
}) => {
  const { isAuthenticated, isEarthEngineAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Redirect to Earth Engine setup if EE authentication is required but not present
  if (requireEarthEngine && !isEarthEngineAuthenticated) {
    return <Navigate to="/setup-earth-engine" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
export { ProtectedRoute };
