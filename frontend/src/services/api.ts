import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  User, 
  AuthTokens, 
  LoginRequest, 
  RegisterRequest,
  AnalysisProject,
  AnalysisRequest,
  AnalysisResponse,
  GeometryInput,
  FileUpload,
  ImageMetadata,
  MapVisualization
} from '../types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || '/api/v1',
      timeout: 30000, // 30 seconds for analysis requests
    });

    // Add auth token to requests
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
              const response = await axios.post('/api/v1/auth/token/refresh/', {
                refresh: refreshToken
              });
              
              const { access } = response.data;
              localStorage.setItem('access_token', access);
              
              // Retry original request
              originalRequest.headers.Authorization = `Bearer ${access}`;
              return this.api(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login';
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  // Authentication endpoints
  async login(credentials: LoginRequest): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await this.api.post('/auth/login/', credentials);
    return response.data;
  }

  async register(userData: RegisterRequest): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await this.api.post('/auth/register/', userData);
    return response.data;
  }

  async getProfile(): Promise<User> {
    const response = await this.api.get('/auth/profile/');
    return response.data;
  }

  async updateProfile(userData: Partial<User>): Promise<User> {
    const response = await this.api.patch('/auth/profile/', userData);
    return response.data;
  }

  // Earth Engine authentication
  async checkEarthEngineAuth(): Promise<{ is_authenticated: boolean; project_id?: string }> {
    const response = await this.api.get('/auth/earth-engine/check/');
    return response.data;
  }

  async updateEarthEngineAuth(projectId: string, isAuthenticated: boolean): Promise<{ user: User }> {
    const response = await this.api.post('/auth/earth-engine/update/', {
      project_id: projectId,
      is_authenticated: isAuthenticated
    });
    return response.data;
  }

  // Projects
  async getProjects(): Promise<AnalysisProject[]> {
    const response = await this.api.get('/auth/projects/');
    return response.data.results || response.data;
  }

  async createProject(project: Omit<AnalysisProject, 'id' | 'created_at' | 'updated_at'>): Promise<AnalysisProject> {
    const response = await this.api.post('/auth/projects/', project);
    return response.data;
  }

  async updateProject(id: number, project: Partial<AnalysisProject>): Promise<AnalysisProject> {
    const response = await this.api.patch(`/auth/projects/${id}/`, project);
    return response.data;
  }

  async deleteProject(id: number): Promise<void> {
    await this.api.delete(`/auth/projects/${id}/`);
  }

  // Geometries
  async getGeometries(): Promise<GeometryInput[]> {
    const response = await this.api.get('/auth/geometries/');
    return response.data.results || response.data;
  }

  async createGeometry(geometry: Omit<GeometryInput, 'id' | 'created_at'>): Promise<GeometryInput> {
    const response = await this.api.post('/auth/geometries/', geometry);
    return response.data;
  }

  // File uploads
  async uploadFile(file: File, uploadType: string): Promise<FileUpload> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);
    formData.append('upload_type', uploadType);

    const response = await this.api.post('/auth/uploads/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Analysis endpoints
  async runAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
    const response = await this.api.post('/analysis/run/', request);
    return response.data;
  }

  async getAnalysisHistory(): Promise<AnalysisResponse[]> {
    const response = await this.api.get('/analysis/history/');
    return response.data.results || response.data;
  }

  async getAnalysisResult(id: number): Promise<AnalysisResponse> {
    const response = await this.api.get(`/analysis/results/${id}/`);
    return response.data;
  }

  // Image metadata and selection
  async getImageMetadata(request: {
    project_id: string;
    coordinates: any;
    analysis_type: string;
    start_date: string;
    end_date: string;
    cloud_cover?: number;
  }): Promise<{ success: boolean; images: ImageMetadata[]; error?: string }> {
    const response = await this.api.post('/analysis/image-metadata/', request);
    return response.data;
  }

  async createCustomMap(request: {
    project_id: string;
    coordinates: any;
    analysis_type: string;
    selected_indices: number[];
    start_date: string;
    end_date: string;
  }): Promise<MapVisualization> {
    const response = await this.api.post('/visualization/custom-map/', request);
    return response.data;
  }

  // Demo mode
  async runDemo(params?: any): Promise<AnalysisResponse> {
    const response = await this.api.post('/analysis/demo/', params || {});
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    const response = await this.api.get('/health/');
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;
