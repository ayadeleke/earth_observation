export interface User {
  id: number;
  email: string;
  username: string;
  earth_engine_project_id?: string;
  is_earth_engine_authenticated: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  password_confirm: string;
  earth_engine_project_id?: string;
}

export interface AnalysisProject {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface GeometryInput {
  id: number;
  name: string;
  geometry: any; // GeoJSON geometry
  created_at: string;
}

export interface AnalysisRequest {
  id?: number;
  name: string;
  analysis_type: 'ndvi' | 'lst' | 'sentinel1' | 'sentinel2' | 'comprehensive';
  satellite: 'landsat' | 'sentinel';
  geometry: any; // GeoJSON geometry
  start_date: string;
  end_date: string;
  cloud_cover: number;
  use_cloud_masking: boolean;
  strict_masking: boolean;
  selected_images?: number[];
  project_id?: number;
}

export interface AnalysisResult {
  id: number;
  analysis_request: number;
  data: AnalysisDataPoint[];
  statistics: AnalysisStatistics;
  plot_file?: string;
  csv_file?: string;
  map_file?: string;
  total_observations: number;
  date_range_covered: string;
  created_at: string;
  updated_at: string;
}

export interface AnalysisDataPoint {
  date: string;
  image_id: string;
  doy: number;
  ndvi?: number;
  lst?: number;
  backscatter?: number;
  original_cloud_cover: number | string;
  effective_cloud_cover: number | string;
  cloud_masking_applied: boolean;
}

export interface AnalysisStatistics {
  mean_ndvi?: number;
  std_ndvi?: number;
  min_ndvi?: number;
  max_ndvi?: number;
  median_ndvi?: number;
  total_observations: number;
  [key: string]: any;
}

export interface AnalysisResponse {
  success: boolean;
  data: AnalysisDataPoint[];
  error?: string;
  statistics: AnalysisStatistics;
  metadata: {
    total_observations: number;
    date_range: string;
    collection_size: number;
    cloud_masking_applied: boolean;
    strict_masking: boolean;
  };
  plot_url?: string;
  csv_url?: string;
  map_url?: string;
  map_filename?: string;
  fallback_url?: string;
}

export interface FileUpload {
  id: number;
  name: string;
  file: string;
  upload_type: 'shapefile' | 'geojson' | 'kml';
  processed: boolean;
  created_at: string;
}

export interface ApiError {
  message: string;
  status?: number;
  errors?: Record<string, string[]>;
}

export interface ImageMetadata {
  id: string;
  date: string;
  cloud_cover: number;
  satellite: string;
  scene_id: string;
}

export interface MapVisualization {
  success: boolean;
  map_url: string;
  map_filename: string;
  fallback_url?: string;
  error?: string;
}
