import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import authService from '../../services/authService';

jest.mock('../../services/authService', () => ({
  __esModule: true,
  default: {
    getCurrentUser: jest.fn(),
    isAuthenticated: jest.fn(),
    isEarthEngineAuthenticated: jest.fn(),
    verifyToken: jest.fn(),
    clearInvalidAuth: jest.fn(),
  },
}));

const mockedAuth = authService as jest.Mocked<typeof authService>;

const Session = () => {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="user">{auth.user?.email || 'No User'}</div>
      <div data-testid="loading">{auth.isLoading ? 'Loading' : 'Ready'}</div>
    </div>
  );
};

describe('Restoring a saved session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuth.getCurrentUser.mockReturnValue({ email: 'user@example.com' } as any);
    mockedAuth.isAuthenticated.mockReturnValue(true);
  });

  it('does not wait for a slow backend', async () => {
    mockedAuth.verifyToken.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      render(<AuthProvider><Session /></AuthProvider>);
    });

    expect(screen.getByTestId('loading')).toHaveTextContent('Ready');
    expect(screen.getByTestId('user')).toHaveTextContent('user@example.com');
  });

  it('ends the session when the backend rejects it', async () => {
    mockedAuth.verifyToken.mockResolvedValue(false);
    await act(async () => {
      render(<AuthProvider><Session /></AuthProvider>);
    });

    expect(mockedAuth.clearInvalidAuth).toHaveBeenCalled();
    expect(screen.getByTestId('user')).toHaveTextContent('No User');
  });
});
