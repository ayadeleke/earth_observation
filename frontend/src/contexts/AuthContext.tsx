/**
 * Authentication context for the Earth Observati    initializeAuth();
  }, []);

  // Debug effect to monitor user state changes
  useEffect(() => {
    console.log('AuthContext user state changed:', user);
    console.log('AuthService isAuthenticated:', authService.isAuthenticated());
    console.log('AuthService getCurrentUser:', authService.getCurrentUser());
  }, [user]);

  const login = async (email: string, password: string): Promise<void> => {pplication
 * Provides authentication state and methods throughout the app
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import authService, { User, RegisterData } from '../services/authService';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isEarthEngineAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (accessToken: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  authenticateEarthEngine: (projectId: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const currentUser = authService.getCurrentUser();
        if (currentUser && authService.isAuthenticated()) {
          // Verify token is still valid
          const isValid = await authService.verifyToken();
          if (isValid) {
            setUser(currentUser);
          } else {
            // Token is invalid, clear auth
            await authService.logout();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);
      const loggedInUser = await authService.login({ email, password });
      setUser(loggedInUser);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData): Promise<void> => {
    try {
      setIsLoading(true);
      const newUser = await authService.register(data);
      setUser(newUser);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (accessToken: string): Promise<void> => {
    try {
      setIsLoading(true);
      const user = await authService.loginWithGoogle(accessToken);
      setUser(user);
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: Partial<User>): Promise<void> => {
    try {
      const updatedUser = await authService.updateProfile(data);
      setUser(updatedUser);
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  };

  const authenticateEarthEngine = async (projectId: string): Promise<void> => {
    try {
      await authService.authenticateEarthEngine(projectId);
      // Update user state to reflect EE authentication
      if (user) {
        setUser({
          ...user,
          is_earth_engine_authenticated: true,
          earth_engine_project_id: projectId,
        });
      }
    } catch (error) {
      console.error('Earth Engine authentication error:', error);
      throw error;
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
    try {
      await authService.changePassword(oldPassword, newPassword);
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  };

  const deleteAccount = async (): Promise<void> => {
    try {
      await authService.deleteAccount();
      setUser(null);
    } catch (error) {
      console.error('Delete account error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isEarthEngineAuthenticated: authService.isEarthEngineAuthenticated(),
    isLoading,
    login,
    loginWithGoogle,
    register,
    logout,
    updateProfile,
    authenticateEarthEngine,
    changePassword,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;