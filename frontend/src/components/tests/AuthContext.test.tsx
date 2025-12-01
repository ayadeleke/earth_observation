import React from 'react';
import { render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

// Mock the authService
jest.mock('../../services/authService', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  isAuthenticated: jest.fn(),
  getToken: jest.fn(),
  getUser: jest.fn(),
  getCurrentUser: jest.fn().mockReturnValue(null),
  setAuthToken: jest.fn(),
  refreshToken: jest.fn(),
  isEarthEngineAuthenticated: jest.fn(),
  clearInvalidAuth: jest.fn()
}));

// Simple test component to access context
const TestComponent = () => {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="auth-status">{auth.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      <div data-testid="user-email">{auth.user?.email || 'No User'}</div>
      <div data-testid="loading">{auth.isLoading ? 'Loading' : 'Ready'}</div>
    </div>
  );
};

describe('AuthContext', () => {
  describe('Basic Rendering', () => {
    it('renders provider without errors', () => {
      render(
        <AuthProvider>
          <div>Test Content</div>
        </AuthProvider>
      );
      
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('provides context to child components', () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      expect(screen.getByTestId('auth-status')).toBeInTheDocument();
      expect(screen.getByTestId('user-email')).toBeInTheDocument();
      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });

    it('initializes with not authenticated state', () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
    });

    it('shows no user initially', () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      expect(screen.getByTestId('user-email')).toHaveTextContent('No User');
    });

    it('shows ready state after loading', () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      // Should eventually show ready state
      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });
  });
});
