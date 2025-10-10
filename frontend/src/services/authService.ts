/**
 * Authentication service for the Earth Observation application
 * Handles JWT token management, user authentication, and API requests
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

// Create axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Token management
const TOKEN_STORAGE_KEY = 'auth_tokens';
const USER_STORAGE_KEY = 'user_data';

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface User {
  id: number;
  email: string;
  username: string;
  earth_engine_project_id?: string;
  is_earth_engine_authenticated: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username?: string; // Optional since backend auto-generates from email
  password: string;
  password_confirm: string;
  earth_engine_project_id?: string;
}

class AuthService {
  private tokens: AuthTokens | null = null;
  private user: User | null = null;

  constructor() {
    this.loadTokensFromStorage();
    this.setupRequestInterceptor();
    this.setupResponseInterceptor();
  }

  /**
   * Load tokens from localStorage
   */
  private loadTokensFromStorage(): void {
    try {
      const storedTokens = localStorage.getItem(TOKEN_STORAGE_KEY);
      const storedUser = localStorage.getItem(USER_STORAGE_KEY);
      
      if (storedTokens) {
        this.tokens = JSON.parse(storedTokens);
      }
      
      if (storedUser) {
        this.user = JSON.parse(storedUser);
      }
    } catch (error) {
      console.error('Error loading auth data from storage:', error);
      this.clearAuth();
    }
  }

  /**
   * Save tokens to localStorage
   */
  private saveTokensToStorage(tokens: AuthTokens): void {
    this.tokens = tokens;
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  }

  /**
   * Save user data to localStorage
   */
  private saveUserToStorage(user: User): void {
    this.user = user;
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }

  /**
   * Clear authentication data
   */
  private clearAuth(): void {
    this.tokens = null;
    this.user = null;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  }

  /**
   * Setup request interceptor to add auth header
   */
  private setupRequestInterceptor(): void {
    api.interceptors.request.use(
      (config) => {
        if (this.tokens?.access) {
          config.headers.Authorization = `Bearer ${this.tokens.access}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * Setup response interceptor to handle token refresh
   */
  private setupResponseInterceptor(): void {
    api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If error is 401 and we haven't tried to refresh yet
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            await this.refreshToken();
            // Retry the original request with new token
            if (this.tokens?.access) {
              originalRequest.headers.Authorization = `Bearer ${this.tokens.access}`;
              return api(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, clear auth and redirect to login
            this.clearAuth();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<User> {
    try {
      const response = await api.post('/login/', credentials);
      const { user, access, refresh } = response.data;

      this.saveTokensToStorage({ access, refresh });
      this.saveUserToStorage(user);

      return user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<User> {
    try {
      const response = await api.post('/register/', data);
      const { user, access, refresh } = response.data;

      this.saveTokensToStorage({ access, refresh });
      this.saveUserToStorage(user);

      return user;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      if (this.tokens?.refresh) {
        await api.post('/logout/', { refresh: this.tokens.refresh });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearAuth();
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<void> {
    if (!this.tokens?.refresh) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await api.post('/token/refresh/', {
        refresh: this.tokens.refresh,
      });

      const { access, refresh } = response.data;
      this.saveTokensToStorage({ access, refresh: refresh || this.tokens.refresh });
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    try {
      await api.post('/change-password/', {
        old_password: oldPassword,
        new_password: newPassword,
      });
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(data: Partial<User>): Promise<User> {
    try {
      const response = await api.patch('/profile/', data);
      const updatedUser = response.data;
      this.saveUserToStorage(updatedUser);
      return updatedUser;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }

  /**
   * Delete user account
   */
  async deleteAccount(): Promise<void> {
    try {
      await api.delete('/profile/');
      this.clearAuth();
    } catch (error) {
      console.error('Delete account error:', error);
      throw error;
    }
  }

  /**
   * Authenticate with Earth Engine
   */
  async authenticateEarthEngine(projectId: string): Promise<void> {
    try {
      await api.post('/auth/ee/authenticate/', {
        project_id: projectId,
      });

      // Update user data to reflect EE authentication
      if (this.user) {
        this.user.is_earth_engine_authenticated = true;
        this.user.earth_engine_project_id = projectId;
        this.saveUserToStorage(this.user);
      }
    } catch (error) {
      console.error('Earth Engine authentication error:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!(this.tokens?.access && this.user);
  }

  /**
   * Check if user has Earth Engine authentication
   */
  isEarthEngineAuthenticated(): boolean {
    return this.user?.is_earth_engine_authenticated || false;
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.user;
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    return this.tokens?.access || null;
  }

  /**
   * Verify token validity
   */
  async verifyToken(): Promise<boolean> {
    if (!this.tokens?.access) {
      return false;
    }

    try {
      await api.post('/token/verify/', { token: this.tokens.access });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get authenticated API instance
   */
  getAuthenticatedAPI() {
    return api;
  }
}

// Create singleton instance
const authService = new AuthService();

export default authService;
export { api };