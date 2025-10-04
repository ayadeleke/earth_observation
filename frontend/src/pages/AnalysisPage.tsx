import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { InteractiveMap } from '../components/map/InteractiveMap';
import AnalysisMapLayer from '../components/map/AnalysisMapLayer';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import AnalysisDashboard from '../components/analysis/AnalysisDashboard';
import '../styles/AnalysisPage.css';

interface FormData {
  coordinates: string;
  startYear: number;
  endYear: number;
  startDate: string;
  endDate: string;
  analysisType: string;
  satellite: string;
  cloudCover: number;
  cloudCoverValue: number;
  enableCloudMasking: boolean;
  maskingStrictness: string;
  polarization: string;
}

const AnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<FormData>({
    coordinates: '',
    startYear: 2000,
    endYear: 2024,
    startDate: '2020-01-01',
    endDate: '2024-12-31',
    analysisType: 'ndvi',
    satellite: 'landsat',
    cloudCover: 20,
    cloudCoverValue: 20,
    enableCloudMasking: false,
    maskingStrictness: 'false',
    polarization: 'VV'
  });

  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('coordinates');
  const [uploadedShapefile, setUploadedShapefile] = useState<File | null>(null);
  const [dateRangeType, setDateRangeType] = useState<string>('years');
  const [showResults, setShowResults] = useState<boolean>(false);
  const [clearMapLayers, setClearMapLayers] = useState<boolean>(false);
  const [clearShapefileLayers, setClearShapefileLayers] = useState<boolean>(false);
  const [eeStatus, setEeStatus] = useState<any>(null);
  const [showMapVisualization, setShowMapVisualization] = useState<boolean>(false);
  const [mapVisualizationData, setMapVisualizationData] = useState<any>(null);
  const [mapError, setMapError] = useState<string>('');
  const [geometryForMap, setGeometryForMap] = useState<any>(null);

  // Check Earth Engine status on component mount
  useEffect(() => {
    const checkEarthEngineStatus = async () => {
      try {
        const response = await fetch('http://localhost:8000/auth/ee/status/');
        if (response.ok) {
          const status = await response.json();
          setEeStatus(status);
        }
      } catch (error) {
        console.log('Could not fetch EE status:', error);
        // Set default status if backend is not available
        setEeStatus({
          authenticated: false,
          authentication_method: 'Service Account (Pending Setup)',
          service_account_configured: false
        });
      }
    };

    checkEarthEngineStatus();
  }, []);

  // Handle input changes
  const handleInputChange = (e: any) => {
    const { name, value, type } = e.target;
    const checked = (e.target as any).checked;
    
    // If coordinates are being manually entered, clear uploaded shapefile and shapefile layer
    if (name === 'coordinates' && value.trim()) {
      setUploadedShapefile(null);
      // Clear shapefile layer when manual coordinates are entered
      setClearShapefileLayers(true);
      setTimeout(() => setClearShapefileLayers(false), 100); // Reset after clearing
      // Also clear drawn map layers when manual coordinates are entered
      setClearMapLayers(true);
      setTimeout(() => setClearMapLayers(false), 100); // Reset after clearing
    }
    
    setFormData((prev: FormData) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle cloud cover slider sync
  const handleCloudCoverChange = (e: any) => {
    const value = e.target.value;
    setFormData((prev: FormData) => ({
      ...prev,
      cloudCover: Number(value),
      cloudCoverValue: Number(value)
    }));
  };

  const handleCloudCoverValueChange = (e: any) => {
    const value = e.target.value;
    setFormData((prev: FormData) => ({
      ...prev,
      cloudCover: Number(value),
      cloudCoverValue: Number(value)
    }));
  };

  // Handle area selection from map
  const handleAreaSelect = (coordinates: any, wkt: string = '', source: string = 'drawing') => {
    // Update coordinates field - set to WKT if provided, otherwise clear it
    setFormData((prev: FormData) => ({
      ...prev,
      coordinates: wkt
    }));
    
    // Create GeoJSON geometry for map visualization
    let geometry = null;
    if (Array.isArray(coordinates) && coordinates.length > 0) {
      geometry = {
        type: 'Polygon',
        coordinates: [coordinates.map((coord: any) => {
          if (Array.isArray(coord) && coord.length === 2) {
            return [coord[0], coord[1]]; // lon,lat for GeoJSON
          }
          return [coord.lng, coord.lat];
        })]
      };
    }
    setGeometryForMap(geometry);
    
    // Clear uploaded shapefile only when drawing on map (not when shapefile sets coordinates)
    if (wkt && uploadedShapefile && source === 'drawing') {
      setUploadedShapefile(null);
      // Reset the file input
      const fileInput = document.getElementById('shapefileInput') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    }
  };

  // Handle shapefile upload
  const handleShapefileUpload = (event: any) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedShapefile(file);
      // Clear manual coordinates when shapefile is uploaded
      setFormData((prev: FormData) => ({
        ...prev,
        coordinates: ''
      }));
      // Clear map layers when shapefile is uploaded
      setClearMapLayers(true);
      setTimeout(() => setClearMapLayers(false), 100); // Reset after clearing
      // In a real implementation, you would process the shapefile here
      console.log('Shapefile uploaded:', file.name);
    }
  };

  // Handle shapefile removal
  const handleShapefileRemove = () => {
    setUploadedShapefile(null);
    // Clear coordinates when shapefile is removed
    setFormData((prev: FormData) => ({
      ...prev,
      coordinates: ''
    }));
    // Clear shapefile layer when shapefile is removed
    setClearShapefileLayers(true);
    setTimeout(() => setClearShapefileLayers(false), 100); // Reset after clearing
    // Reset the file input
    const fileInput = document.getElementById('shapefileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    console.log('Shapefile removed, coordinates cleared');
  };

  // Handle form submission
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    
    if (!formData.coordinates.trim() && !uploadedShapefile) {
      setError('Please select an area of interest either by drawing on the map or uploading a shapefile');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Prepare the request data
      let requestData: any;
      let contentType: string;
      
      if (uploadedShapefile) {
        // Use FormData for shapefile uploads
        requestData = new FormData();
        
        // Add form data
        Object.keys(formData).forEach(key => {
          const value = formData[key as keyof FormData];
          requestData.append(key, String(value));
        });

        // Add shapefile
        requestData.append('shapefile', uploadedShapefile);
        
        // Add additional fields
        requestData.append('projectId', 'ee-ayotundenew');
        requestData.append('dateRangeType', dateRangeType);
        
        contentType = 'multipart/form-data';
      } else {
        // Use JSON for regular requests - match Flask parameter structure
        const requestBody: any = {
          coordinates: formData.coordinates,
          analysis_type: formData.analysisType,
          satellite: formData.satellite,
          project_id: 'ee-ayotundenew',
          date_range_type: dateRangeType
        };

        // Add date parameters based on range type (match Flask behavior)
        if (dateRangeType === 'years') {
          requestBody.start_year = parseInt(formData.startYear?.toString() || new Date(formData.startDate).getFullYear().toString());
          requestBody.end_year = parseInt(formData.endYear?.toString() || new Date(formData.endDate).getFullYear().toString());
        } else {
          requestBody.start_date = formData.startDate;
          requestBody.end_date = formData.endDate;
        }

        // Add cloud cover and masking parameters (match Flask field names)
        if (formData.satellite === 'landsat' && ['ndvi', 'lst', 'comprehensive'].includes(formData.analysisType)) {
          requestBody.cloud_cover = parseInt(formData.cloudCover.toString());
          requestBody.use_cloud_masking = formData.enableCloudMasking;
          requestBody.strict_masking = formData.maskingStrictness === 'strict';
        }

        // Add polarization for SAR analyses
        if (formData.analysisType === 'sar' || formData.analysisType === 'comprehensive') {
          requestBody.polarization = formData.polarization;
        }

        requestData = JSON.stringify(requestBody);
        
        contentType = 'application/json';
      }

      // Debug log the request parameters
      console.log('=== Request Debug ===');
      console.log('Form cloudCover:', formData.cloudCover);
      console.log('Form cloudCoverValue:', formData.cloudCoverValue);
      console.log('Coordinates:', formData.coordinates ? formData.coordinates.substring(0, 100) + '...' : '(empty)');
      console.log('Content type:', contentType);
      console.log('Date range type:', dateRangeType);
      if (contentType === 'application/json') {
        console.log('Request body:', requestData);
        const parsedBody = JSON.parse(requestData);
        console.log('Cloud cover in request:', parsedBody.cloud_cover);
      }

      // Determine the correct endpoint based on analysis type
      let endpoint = 'http://localhost:8000/';
      switch (formData.analysisType) {
        case 'ndvi':
          endpoint += 'process_ndvi/';
          break;
        case 'lst':
          endpoint += 'process_lst/';
          break;
        case 'sar':
          endpoint += 'process_sentinel/';
          break;
        case 'comprehensive':
          endpoint += 'process_comprehensive/';
          break;
        default:
          endpoint += 'process_ndvi/'; // Default to NDVI
      }

      // Make the API call to Django backend
      const headers: any = {};
      if (contentType === 'application/json') {
        headers['Content-Type'] = 'application/json';
      }
      // For FormData, let browser set Content-Type automatically
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: requestData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}. Details: ${errorText}`);
      }

      const result = await response.json();
      
      // Add comprehensive debugging for all analysis types
      console.log('=== Analysis Response ===');
      console.log('Analysis Type:', formData.analysisType);
      console.log('Full result:', result);
      console.log('Result success:', result.success);
      console.log('Result data length:', result.data?.length);
      console.log('Statistics:', result.statistics);
      console.log('Time series data:', result.time_series_data?.length);
      
      if (result.data && result.data.length > 0) {
        console.log('First data item:', result.data[0]);
        console.log('First data item keys:', Object.keys(result.data[0]));
      }
      
      // Debug geometry from backend
      if (result.geometry) {
        console.log('=== Backend Geometry Debug ===');
        console.log('Backend geometry type:', result.geometry.type);
        console.log('Backend geometry coordinates:', result.geometry.coordinates?.length, 'coordinate arrays');
        console.log('User geometry for comparison:', geometryForMap);
      } else {
        console.log('No geometry returned from backend, using user input geometry');
      }
      
      if (result.success) {
        console.log('=== Data Transformation Debug ===');
        console.log('Original data sample:', result.data?.slice(0, 2));
        console.log('Original time_series_data sample:', result.time_series_data?.slice(0, 2));
        console.log('Original statistics:', result.statistics);
        
        setResults(result);
        setShowResults(true);
        setError(''); // Clear any previous errors
      } else {
        setError(result.message || 'Analysis failed');
      }
      
    } catch (error: any) {
      console.error('Analysis error:', error);
      setError(error.message || 'An error occurred during analysis');
    } finally {
      setLoading(false);
    }
  };

  // Get satellite description
  const getSatelliteDescription = () => {
    switch (formData.satellite) {
      case 'landsat':
        return 'NDVI and LST analysis using Landsat thermal and optical bands.';
      case 'sentinel2':
        return 'High-resolution NDVI analysis using Sentinel-2 optical imagery.';
      default:
        return 'NDVI analysis using Landsat thermal and optical bands.';
    }
  };

  // Transform backend data to match frontend table expectations
  const transformDataForTable = (data: any[], analysisType: string) => {
    if (!data || data.length === 0) return [];
    
    const transformed = data.map((item: any) => ({
      date: item.date,
      imageId: item.image_id || item.imageId || 'N/A',
      ndviValue: item.ndvi || item.ndviValue,
      lstValue: item.lst || item.lstValue, 
      backscatterValue: item.backscatter || item.backscatterValue || item.backscatter_vv || item.vh || item.vv,
      backscatterVH: item.backscatter_vh || item.vh_backscatter, // Add VH backscatter
      vvVhRatio: item.vv_vh_ratio, // Add VV/VH ratio
      orbitDirection: item.orbit_direction, // Add orbit direction
      originalCloudCover: item.originalCloudCover || item.cloud_cover || item.estimated_cloud_cover || 0,
      adjustedCloudCover: item.adjustedCloudCover || item.effective_cloud_cover || item.cloud_cover || 0,
      cloudMaskingApplied: item.cloud_masking_applied || item.cloudMaskingApplied || false,
      satellite: item.satellite || 'Unknown',
      lat: item.lat,
      lon: item.lon,
      analysisType: item.analysis_type || analysisType
    }));
    
    console.log('Transformed table data sample:', transformed.slice(0, 2));
    return transformed;
  };

  // Transform backend statistics to match frontend expectations
  const transformStatistics = (stats: any, analysisType: string) => {
    if (!stats) return null;
    
    const analysisPrefix = analysisType.toLowerCase();
    
    // Special handling for SAR statistics which use VV polarization
    if (analysisPrefix === 'sar') {
      return {
        mean: stats.mean_vv || stats.mean,
        min: stats.min_vv || stats.min,
        max: stats.max_vv || stats.max,
        std: stats.std_vv || stats.std,
        count: stats.pixel_count || stats.num_images || stats.count,
        median: stats.median_vv || stats.median,
        // Additional info
        area_km2: stats.area_km2,
        date_range: stats.date_range,
        annual_observations: stats.num_images
      };
    }
    
    return {
      mean: stats[`mean_${analysisPrefix}`] || stats.mean,
      min: stats[`min_${analysisPrefix}`] || stats.min,
      max: stats[`max_${analysisPrefix}`] || stats.max,
      std: stats[`std_${analysisPrefix}`] || stats.std,
      count: stats.pixel_count || stats.total_individual_observations || stats.count,
      median: stats[`median_${analysisPrefix}`] || stats.median,
      // Additional info
      area_km2: stats.area_km2,
      date_range: stats.date_range,
      annual_observations: stats.annual_observations
    };
  };

  // Transform time series data to ensure consistent field names
  const transformTimeSeriesData = (data: any[], analysisType: string) => {
    if (!data || data.length === 0) return [];
    
    return data.map((item: any) => ({
      date: item.date,
      ndvi: item.ndvi || item.ndviValue,
      lst: item.lst || item.lstValue,
      backscatter: item.backscatter || item.backscatterValue || item.backscatter_vv || item.vh || item.vv,
      count: item.count || item.annual_observations || 1,
      cloud_cover: item.cloud_cover || item.estimated_cloud_cover,
      satellite: item.satellite,
      analysisType: item.analysis_type || analysisType
    }));
  };

  return (
    <div>
      {/* Professional Header Section */}
      <div className="aheader-section" style={{
        padding: '2rem 0',
        marginBottom: '1rem'
      }}>
        <div className="container">
          <div className="row align-items-center">
            <div className="col-12">
              <div className="d-flex align-items-center mb-3 flex-column flex-md-row text-center text-md-start">
                <div className="rounded-3 p-2 p-md-3 me-md-4 mb-3 mb-md-0 d-flex align-items-center justify-content-center" style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                  width: window.innerWidth < 768 ? '60px' : '80px',
                  height: window.innerWidth < 768 ? '60px' : '80px'
                }}>
                  <i className="fas fa-satellite text-white" style={{ fontSize: window.innerWidth < 768 ? '1.8rem' : '2.5rem' }}></i>
                </div>
                <div>
                  <h1 className="h3 h2-md fw-bold text-dark">
                    Earth Observation Analysis
                  </h1>
                  <p className="small text-muted mb-0">Advanced satellite imagery and vegetation indices analysis platform</p>
                </div>
              </div>
              <div className="d-flex gap-1 gap-md-3 flex-wrap justify-content-center justify-content-md-start">
                <span className="badge bg-light text-dark">
                  <i className="fas fa-satellite me-2"></i>Landsat & Sentinel
                </span>
                <span className="badge bg-light text-dark">
                  <i className="fas fa-leaf me-2"></i>NDVI Analysis
                </span>
                <span className="badge bg-light text-dark">
                  <i className="fas fa-thermometer-half me-2"></i>Temperature Monitoring
                </span>
                <span className="badge bg-light text-dark">
                  <i className="fas fa-satellite-dish me-2"></i>Backscatter Analysis
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        {/* Error Alert */}
        <div className="row">
          <div className="col-12 mb-3">
            {error && (
              <div className="alert alert-danger" role="alert">
                <i className="fas fa-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="row g-4">
          {/* Analysis Form */}
          <div className="col-lg-5">
            <div className="card border-0 shadow-lg" style={{
              borderRadius: '1rem',
              background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)'
            }}>
              <div className="card-header bg-transparent border-0 pb-0" style={{ padding: window.innerWidth < 768 ? '0.75rem 0.75rem 0 0.75rem' : '1rem 1rem 0 1rem' }}>
                <div className="d-flex align-items-center mb-2">
                  <div className="bg-primary bg-opacity-10 rounded-3 p-1 p-md-2 me-2 me-md-3">
                    <i className="fas fa-cogs text-primary" style={{ fontSize: '1rem' }}></i>
                  </div>
                  <h3 className="mb-0 fw-bold text-dark" style={{ fontSize: window.innerWidth < 768 ? '1.1rem' : '1.25rem' }}>Analysis Parameters</h3>
                </div>
                <p className="text-muted mb-0" style={{ fontSize: window.innerWidth < 768 ? '0.8rem' : '0.875rem' }}>Configure your satellite imagery analysis settings</p>
              </div>
              <div className="card-body" style={{ padding: window.innerWidth < 768 ? '0.75rem' : '1rem' }}>
              
              <form onSubmit={handleSubmit} encType="multipart/form-data">
                {/* Area of Interest Section */}
                <div className="mb-4">
                  <div className="d-flex align-items-center mb-3">
                    <div className="bg-info bg-opacity-10 rounded-2 p-2 me-2 me-md-3">
                      <i className="fas fa-map-marker-alt text-info" style={{ fontSize: window.innerWidth < 768 ? '0.9rem' : '1rem' }}></i>
                    </div>
                    <div>
                      <label className="form-label mb-0 fw-semibold text-dark" style={{ fontSize: window.innerWidth < 768 ? '0.95rem' : '1rem' }}>Area of Interest</label>
                      <p className="text-muted mb-0" style={{ fontSize: window.innerWidth < 768 ? '0.75rem' : '0.875rem' }}>Define the geographical area for analysis</p>
                    </div>
                  </div>
                  
                  {/* Enhanced Tab Navigation */}
                  <ul className="nav nav-pills mb-3 bg-light rounded-3 p-1" role="tablist" style={{ border: '1px solid rgba(0,0,0,0.05)' }}>
                    <li className="nav-item flex-fill" role="presentation">
                      <button 
                        className={`nav-link w-100 border-0 ${activeTab === 'coordinates' ? 'active' : ''}`}
                        type="button" 
                        onClick={() => setActiveTab('coordinates')}
                        style={{
                          borderRadius: '0.5rem',
                          fontWeight: '500',
                          backgroundColor: activeTab === 'coordinates' ? '#667eea' : 'transparent',
                          color: activeTab === 'coordinates' ? 'white' : '#6c757d',
                          transition: 'all 0.3s ease',
                          fontSize: window.innerWidth < 768 ? '0.8rem' : '0.875rem',
                          padding: window.innerWidth < 768 ? '0.5rem' : '0.75rem'
                        }}
                        onMouseEnter={(e) => {
                          if (activeTab !== 'coordinates') {
                            (e.target as HTMLButtonElement).style.backgroundColor = '#f8f9fa';
                            (e.target as HTMLButtonElement).style.color = '#495057';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (activeTab !== 'coordinates') {
                            (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                            (e.target as HTMLButtonElement).style.color = '#6c757d';
                          }
                        }}
                      >
                        <i className="fas fa-edit me-2"></i>Manual Input
                      </button>
                    </li>
                    <li className="nav-item flex-fill" role="presentation">
                      <button 
                        className={`nav-link w-100 border-0 ${activeTab === 'shapefile' ? 'active' : ''}`}
                        type="button"
                        onClick={() => setActiveTab('shapefile')}
                        style={{
                          borderRadius: '0.5rem',
                          fontWeight: '500',
                          backgroundColor: activeTab === 'shapefile' ? '#667eea' : 'transparent',
                          color: activeTab === 'shapefile' ? 'white' : '#6c757d',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (activeTab !== 'shapefile') {
                            (e.target as HTMLButtonElement).style.backgroundColor = '#f8f9fa';
                            (e.target as HTMLButtonElement).style.color = '#495057';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (activeTab !== 'shapefile') {
                            (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                            (e.target as HTMLButtonElement).style.color = '#6c757d';
                          }
                        }}
                      >
                        <i className="fas fa-upload me-2"></i>Upload Shapefile
                      </button>
                    </li>
                  </ul>
                  
                  {/* Tab Content */}
                  <div className="tab-content">
                    {/* Manual Coordinates Tab */}
                    {activeTab === 'coordinates' && (
                      <div className="tab-pane fade show active">
                        <textarea 
                          className="form-control form-control-lg" 
                          name="coordinates"
                          value={formData.coordinates}
                          onChange={handleInputChange}
                          rows={4} 
                          placeholder="Enter coordinates in WKT format or draw on map"
                          style={{
                            borderRadius: '0.75rem',
                            border: '2px solid #e9ecef',
                            padding: '0.75rem 1rem',
                            fontSize: '1rem',
                            transition: 'all 0.3s ease',
                            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
                          }}
                          onFocus={(e) => {
                            (e.target as HTMLTextAreaElement).style.borderColor = '#667eea';
                            (e.target as HTMLTextAreaElement).style.boxShadow = '0 0 0 0.2rem rgba(102, 126, 234, 0.25)';
                          }}
                          onBlur={(e) => {
                            (e.target as HTMLTextAreaElement).style.borderColor = '#e9ecef';
                            (e.target as HTMLTextAreaElement).style.boxShadow = 'none';
                          }}
                        />
                        <div className="form-text">
                          Example: POLYGON((-74.0 40.7, -73.9 40.7, -73.9 40.8, -74.0 40.8, -74.0 40.7))
                        </div>
                      </div>
                    )}
                    
                    {/* Shapefile Upload Tab */}
                    {activeTab === 'shapefile' && (
                      <div className="tab-pane fade show active">
                        <div className="upload-area border rounded text-center" 
                             style={{ 
                               borderStyle: 'dashed', 
                               backgroundColor: '#f8f9fa',
                               borderRadius: '1rem',
                               border: '3px dashed #667eea',
                               transition: 'all 0.3s ease',
                               cursor: 'pointer',
                               padding: window.innerWidth < 768 ? '1rem' : '1.5rem'
                             }}
                             onMouseEnter={(e) => {
                               (e.target as HTMLDivElement).style.backgroundColor = '#e8f2ff';
                               (e.target as HTMLDivElement).style.borderColor = '#4f46e5';
                             }}
                             onMouseLeave={(e) => {
                               (e.target as HTMLDivElement).style.backgroundColor = '#f8f9fa';
                               (e.target as HTMLDivElement).style.borderColor = '#667eea';
                             }}>
                          <i className="fas fa-cloud-upload-alt text-muted mb-2" style={{ fontSize: window.innerWidth < 768 ? '1.5rem' : '2rem' }}></i>
                          <p className="mb-2" style={{ fontSize: window.innerWidth < 768 ? '0.85rem' : '1rem' }}>Upload a shapefile package (.zip containing all required components)</p>
                          <input 
                            type="file" 
                            className="form-control" 
                            accept=".zip" 
                            style={{ display: 'none' }}
                            onChange={handleShapefileUpload}
                            id="shapefileInput"
                          />
                          <button 
                            type="button" 
                            className="btn btn-outline-primary" 
                            onClick={() => {
                              const element = document.getElementById('shapefileInput');
                              if (element) element.click();
                            }}
                          >
                            <i className="fas fa-folder-open me-1"></i>Choose ZIP File
                          </button>
                          {uploadedShapefile && (
                            <div className="mt-2">
                              <div className="alert alert-success d-flex justify-content-between align-items-center" style={{ margin: '0.5rem 0' }}>
                                <div className="text-truncate" style={{ maxWidth: window.innerWidth < 768 ? '200px' : '300px' }}>
                                  <i className="fas fa-check-circle me-1"></i>
                                  <span title={uploadedShapefile.name} style={{ fontSize: window.innerWidth < 768 ? '0.8rem' : '0.9rem' }}>
                                    {window.innerWidth < 768 && uploadedShapefile.name.length > 25 
                                      ? uploadedShapefile.name.substring(0, 25) + '...' 
                                      : uploadedShapefile.name}
                                  </span>
                                </div>
                                <button 
                                  type="button" 
                                  className="btn btn-sm btn-outline-danger ms-2 flex-shrink-0"
                                  onClick={handleShapefileRemove}
                                  title="Remove shapefile"
                                >
                                  <i className="fas fa-times"></i>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="form-text mt-2">
                          <strong>Shapefile Requirements:</strong>
                          <ul className="mb-0 mt-1">
                            <li><strong>Required:</strong> Package all shapefile components in a ZIP file</li>
                            <li><strong>Must include:</strong> .shp, .shx, .dbf files with the same base name</li>
                            <li><strong>Optional:</strong> .prj file for projection information</li>
                            <li><strong>Example:</strong> myarea.shp, myarea.shx, myarea.dbf → myarea.zip</li>
                          </ul>
                          <div className="mt-2">
                            <small className="text-muted">
                              <i className="fas fa-info-circle me-1"></i>
                              Single .shp files cannot be uploaded as they require companion files that browsers cannot upload together.
                            </small>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Date Selection Options */}
                <div className="mb-4">
                  <div className="d-flex align-items-center mb-3">
                    <div className="bg-warning bg-opacity-10 rounded-2 p-2 me-2 me-md-3">
                      <i className="fas fa-calendar-range text-warning" style={{ fontSize: window.innerWidth < 768 ? '0.9rem' : '1rem' }}></i>
                    </div>
                    <div>
                      <label className="form-label mb-0 fw-semibold text-dark" style={{ fontSize: window.innerWidth < 768 ? '0.95rem' : '1rem' }}>Date Range Selection</label>
                      <p className="text-muted mb-0" style={{ fontSize: window.innerWidth < 768 ? '0.75rem' : '0.875rem' }}>Choose your temporal analysis period</p>
                    </div>
                  </div>
                  
                  {/* Date Range Type Selection */}
                  <div className="mb-3">
                    <div className="form-check form-check-inline">
                      <input 
                        className="form-check-input" 
                        type="radio" 
                        name="dateRangeType" 
                        value="years" 
                        checked={dateRangeType === 'years'}
                        onChange={(e) => setDateRangeType(e.target.value)}
                      />
                      <label className="form-check-label" style={{ fontSize: window.innerWidth < 768 ? '0.85rem' : '0.9rem' }}>
                        <i className="fas fa-calendar-alt me-1"></i>Year Range
                      </label>
                    </div>
                    <div className="form-check form-check-inline">
                      <input 
                        className="form-check-input" 
                        type="radio" 
                        name="dateRangeType" 
                        value="dates"
                        checked={dateRangeType === 'dates'}
                        onChange={(e) => setDateRangeType(e.target.value)}
                      />
                      <label className="form-check-label" style={{ fontSize: window.innerWidth < 768 ? '0.85rem' : '0.9rem' }}>
                        <i className="fas fa-calendar-day me-1"></i>Exact Dates
                      </label>
                    </div>
                  </div>
                  
                  {/* Year Range Selection (Default) */}
                  {dateRangeType === 'years' && (
                    <div>
                      <div className="row">
                        <div className="col-12 col-md-6 mb-2 mb-md-0">
                          <div className="mb-3">
                            <label htmlFor="startYear" className="form-label small">Start Year</label>
                            <input 
                              type="number" 
                              className="form-control" 
                              name="startYear"
                              value={formData.startYear}
                              onChange={handleInputChange}
                              min="1988" 
                              max="2025"
                              style={{ padding: window.innerWidth < 768 ? '0.5rem' : '0.75rem' }}
                            />
                          </div>
                        </div>
                        <div className="col-12 col-md-6">
                          <div className="mb-3">
                            <label htmlFor="endYear" className="form-label small">End Year</label>
                            <input 
                              type="number" 
                              className="form-control" 
                              name="endYear"
                              value={formData.endYear}
                              onChange={handleInputChange}
                              min="1988" 
                              max="2025"
                              style={{ padding: window.innerWidth < 768 ? '0.5rem' : '0.75rem' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Exact Date Selection */}
                  {dateRangeType === 'dates' && (
                    <div>
                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label htmlFor="startDate" className="form-label">Start Date</label>
                            <input 
                              type="date" 
                              className="form-control form-control-lg" 
                              name="startDate"
                              value={formData.startDate}
                              onChange={handleInputChange}
                              min="1988-01-01" 
                              max="2025-12-31"
                              style={{
                                borderRadius: '0.75rem',
                                border: '2px solid #e9ecef',
                                padding: '0.75rem 1rem',
                                fontSize: '1rem',
                                transition: 'all 0.3s ease'
                              }}
                              onFocus={(e) => {
                                (e.target as HTMLInputElement).style.borderColor = '#667eea';
                                (e.target as HTMLInputElement).style.boxShadow = '0 0 0 0.2rem rgba(102, 126, 234, 0.25)';
                              }}
                              onBlur={(e) => {
                                (e.target as HTMLInputElement).style.borderColor = '#e9ecef';
                                (e.target as HTMLInputElement).style.boxShadow = 'none';
                              }}
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label htmlFor="endDate" className="form-label">End Date</label>
                            <input 
                              type="date" 
                              className="form-control form-control-lg" 
                              name="endDate"
                              value={formData.endDate}
                              onChange={handleInputChange}
                              min="1988-01-01" 
                              max="2025-12-31"
                              style={{
                                borderRadius: '0.75rem',
                                border: '2px solid #e9ecef',
                                padding: '0.75rem 1rem',
                                fontSize: '1rem',
                                transition: 'all 0.3s ease'
                              }}
                              onFocus={(e) => {
                                (e.target as HTMLInputElement).style.borderColor = '#667eea';
                                (e.target as HTMLInputElement).style.boxShadow = '0 0 0 0.2rem rgba(102, 126, 234, 0.25)';
                              }}
                              onBlur={(e) => {
                                (e.target as HTMLInputElement).style.borderColor = '#e9ecef';
                                (e.target as HTMLInputElement).style.boxShadow = 'none';
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Analysis Type Selection */}
                <div className="mb-4">
                  <div className="d-flex align-items-center mb-3">
                    <div className="bg-success bg-opacity-10 rounded-2 p-2 me-3">
                      <i className="fas fa-chart-line text-success"></i>
                    </div>
                    <div>
                      <label className="form-label mb-0 fw-semibold text-dark">Analysis Type</label>
                      <p className="text-muted small mb-0">Select the type of satellite analysis to perform</p>
                    </div>
                  </div>
                  <select 
                    className="form-select" 
                    name="analysisType"
                    value={formData.analysisType}
                    onChange={handleInputChange}
                    style={{
                      borderRadius: '0.5rem',
                      border: '1px solid #e9ecef',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.9rem',
                      transition: 'all 0.3s ease'
                    }}
                    onFocus={(e) => {
                      (e.target as HTMLSelectElement).style.borderColor = '#667eea';
                      (e.target as HTMLSelectElement).style.boxShadow = '0 0 0 0.2rem rgba(102, 126, 234, 0.25)';
                    }}
                    onBlur={(e) => {
                      (e.target as HTMLSelectElement).style.borderColor = '#e9ecef';
                      (e.target as HTMLSelectElement).style.boxShadow = 'none';
                    }}
                  >
                    <option value="ndvi">NDVI (Vegetation Index)</option>
                    <option value="lst">Land Surface Temperature</option>
                    <option value="sar">SAR Backscatter (Sentinel-1 only)</option>
                    <option value="comprehensive">Comprehensive Analysis (All)</option>
                  </select>
                  <div className="form-text">
                    <i className="fas fa-info-circle me-1"></i>
                    Choose the type of analysis to perform on the selected area.
                  </div>
                </div>

                {/* Satellite Mission */}
                <div className="mb-4">
                  <div className="d-flex align-items-center mb-3">
                    <div className="bg-primary bg-opacity-10 rounded-2 p-2 me-3">
                      <i className="fas fa-satellite-dish text-primary"></i>
                    </div>
                    <div>
                      <label className="form-label mb-0 fw-semibold text-dark">Satellite Mission</label>
                      <p className="text-muted small mb-0">Choose the satellite data source</p>
                    </div>
                  </div>
                  <select 
                    className="form-select" 
                    name="satellite"
                    value={formData.satellite}
                    onChange={handleInputChange}
                    style={{
                      borderRadius: '0.5rem',
                      border: '1px solid #e9ecef',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.9rem',
                      transition: 'all 0.3s ease'
                    }}
                    onFocus={(e) => {
                      (e.target as HTMLSelectElement).style.borderColor = '#667eea';
                      (e.target as HTMLSelectElement).style.boxShadow = '0 0 0 0.2rem rgba(102, 126, 234, 0.25)';
                    }}
                    onBlur={(e) => {
                      (e.target as HTMLSelectElement).style.borderColor = '#e9ecef';
                      (e.target as HTMLSelectElement).style.boxShadow = 'none';
                    }}
                  >
                    <option value="landsat">Landsat (30m resolution)</option>
                    <option value="sentinel2">Sentinel-1 (10m resolution)</option>
                  </select>
                  <div className="form-text">
                    <i className="fas fa-info-circle me-1"></i>
                    <span>{getSatelliteDescription()}</span>
                  </div>
                </div>

                {/* Cloud Cover Filter (for Landsat) */}
                <div className="mb-4">
                  <label htmlFor="cloudCover" className="form-label">
                    <i className="fas fa-cloud me-2"></i>
                    Maximum Cloud Cover (%)
                  </label>
                  <div className="row align-items-center">
                    <div className="col-8">
                      <input 
                        type="range" 
                        className="form-range" 
                        name="cloudCover"
                        value={formData.cloudCover}
                        onChange={handleCloudCoverChange}
                        min="0" 
                        max="100" 
                        step="5"
                      />
                    </div>
                    <div className="col-4">
                      <div className="input-group input-group-sm">
                        <input 
                          type="number" 
                          className="form-control" 
                          name="cloudCoverValue"
                          value={formData.cloudCoverValue}
                          onChange={handleCloudCoverValueChange}
                          min="0" 
                          max="100" 
                          step="5"
                          style={{
                            borderRadius: '0.5rem 0 0 0.5rem',
                            border: '2px solid #e9ecef',
                            borderRight: 'none',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.95rem',
                            transition: 'all 0.3s ease'
                          }}
                          onFocus={(e) => {
                            const target = e.target as HTMLInputElement;
                            const group = target.parentElement as HTMLDivElement;
                            target.style.borderColor = '#667eea';
                            target.style.boxShadow = '0 0 0 0.2rem rgba(102, 126, 234, 0.25)';
                            const span = group.querySelector('.input-group-text') as HTMLSpanElement;
                            if (span) {
                              span.style.borderColor = '#667eea';
                              span.style.backgroundColor = '#667eea';
                              span.style.color = 'white';
                            }
                          }}
                          onBlur={(e) => {
                            const target = e.target as HTMLInputElement;
                            const group = target.parentElement as HTMLDivElement;
                            target.style.borderColor = '#e9ecef';
                            target.style.boxShadow = 'none';
                            const span = group.querySelector('.input-group-text') as HTMLSpanElement;
                            if (span) {
                              span.style.borderColor = '#e9ecef';
                              span.style.backgroundColor = '#e9ecef';
                              span.style.color = '#6c757d';
                            }
                          }}
                        />
                        <span className="input-group-text" style={{
                          borderRadius: '0 0.5rem 0.5rem 0',
                          border: '2px solid #e9ecef',
                          borderLeft: 'none',
                          backgroundColor: '#e9ecef',
                          transition: 'all 0.3s ease',
                          fontWeight: '600'
                        }}>%</span>
                      </div>
                    </div>
                  </div>
                  <div className="form-text">
                    <i className="fas fa-info-circle me-1"></i>
                    Filter images with cloud cover below this threshold. Lower values provide clearer images but may reduce available data.
                  </div>
                </div>

                {/* Cloud Masking Options (for Landsat) */}
                <div className="mb-4">
                  <label className="form-label">
                    <i className="fas fa-eye-slash me-2"></i>
                    Cloud Masking Options
                  </label>
                  
                  {/* Enable Cloud Masking */}
                  <div className="form-check form-switch mb-2">
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      name="enableCloudMasking"
                      checked={formData.enableCloudMasking}
                      onChange={handleInputChange}
                    />
                    <label className="form-check-label">
                      Apply cloud masking to images
                    </label>
                  </div>
                  
                  {/* Masking Strictness */}
                  <div className="mb-2">
                    <label htmlFor="maskingStrictness" className="form-label small">Masking Level</label>
                    <select 
                      className="form-select form-select-sm" 
                      name="maskingStrictness"
                      value={formData.maskingStrictness}
                      onChange={handleInputChange}
                      style={{
                        borderRadius: '0.5rem',
                        border: '2px solid #e9ecef',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.875rem',
                        transition: 'all 0.3s ease'
                      }}
                      onFocus={(e) => {
                        (e.target as HTMLSelectElement).style.borderColor = '#667eea';
                        (e.target as HTMLSelectElement).style.boxShadow = '0 0 0 0.15rem rgba(102, 126, 234, 0.25)';
                      }}
                      onBlur={(e) => {
                        (e.target as HTMLSelectElement).style.borderColor = '#e9ecef';
                        (e.target as HTMLSelectElement).style.boxShadow = 'none';
                      }}
                    >
                      <option value="false">Standard (recommended)</option>
                      <option value="true">Strict (more aggressive)</option>
                    </select>
                  </div>
                  
                  <div className="form-text">
                    <i className="fas fa-info-circle me-1"></i>
                    Cloud masking removes cloudy pixels for cleaner analysis. Standard masking balances quality and data availability. Strict masking provides highest quality but may reduce available pixels.
                  </div>
                </div>

                {/* SAR Polarization (for Sentinel-1) */}
                {formData.analysisType === 'sar' && (
                  <div className="mb-4">
                    <label className="form-label">
                      <i className="fas fa-radio me-2"></i>
                      SAR Polarization
                    </label>
                    <select 
                      className="form-select form-select-lg" 
                      name="polarization"
                      value={formData.polarization}
                      onChange={handleInputChange}
                      style={{
                        borderRadius: '0.75rem',
                        border: '2px solid #e9ecef',
                        padding: '0.75rem 1rem',
                        fontSize: '1rem',
                        transition: 'all 0.3s ease'
                      }}
                      onFocus={(e) => {
                        (e.target as HTMLSelectElement).style.borderColor = '#667eea';
                        (e.target as HTMLSelectElement).style.boxShadow = '0 0 0 0.2rem rgba(102, 126, 234, 0.25)';
                      }}
                      onBlur={(e) => {
                        (e.target as HTMLSelectElement).style.borderColor = '#e9ecef';
                        (e.target as HTMLSelectElement).style.boxShadow = 'none';
                      }}
                    >
                      <option value="VV">VV - Vertical Transmit, Vertical Receive</option>
                      <option value="VH">VH - Vertical Transmit, Horizontal Receive</option>
                      <option value="HH">HH - Horizontal Transmit, Horizontal Receive</option>
                      <option value="HV">HV - Horizontal Transmit, Vertical Receive</option>
                    </select>
                    <div className="form-text">
                      <i className="fas fa-info-circle me-1"></i>
                      SAR polarization affects sensitivity to different surface features. VV is commonly used for vegetation monitoring.
                    </div>
                  </div>
                )}

                {/* Earth Engine Integration Info */}
                <div className="mb-4">
                  <div className="alert alert-info border-0" style={{ backgroundColor: '#e8f4f8' }}>
                    <div className="d-flex align-items-center mb-2">
                      <i className="fas fa-cloud text-primary me-2" style={{ fontSize: '1.2rem' }}></i>
                      <strong className="text-primary">Google Earth Engine Initialized for Analysis</strong>
                    </div>
                    
                    {eeStatus ? (
                      <>
                        <p className="mb-2 small text-muted">
                          <i className="fas fa-key me-1"></i>
                          Authentication: {eeStatus.authentication_method || 'Service Account'}
                        </p>

                        <p className="mb-2 small">
                          {eeStatus.authenticated || eeStatus.service_account_available ? (
                            <><i className="fas fa-check-circle text-success me-1"></i>
                            Ready for satellite imagery processing</>
                          ) : (
                            <><i className="fas fa-cog text-warning me-1"></i>
                            Service account active</>
                          )}
                        </p>
                        
                        
                        {eeStatus.service_account_configured && !eeStatus.service_account_available && (
                          <p className="mb-2 small text-warning">
                            <i className="fas fa-exclamation-triangle me-1"></i>
                            Waiting for service account key file
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="mb-2 small">
                        <i className="fas fa-check-circle text-success me-1"></i>
                        Authenticated and ready to process satellite imagery
                      </p>
                    )}
                    
                    <p className="mb-0 small text-muted">
                      <i className="fas fa-external-link-alt me-1"></i>
                      <a href="https://ee-ayotundenew.projects.earthengine.app/view/forestmonitor" 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="text-decoration-none">
                        View Earth Engine App Dashboard
                      </a>
                    </p>
                  </div>
                </div>

                {/* Professional Submit Button */}
                <div className="d-grid gap-2 mt-4">
                  <button 
                    type="submit" 
                    className={`btn shadow-sm ${window.innerWidth < 768 ? 'btn' : 'btn-lg'}`}
                    disabled={loading}
                    style={{
                      background: loading ? '#6c757d' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                      borderRadius: '1rem',
                      padding: window.innerWidth < 768 ? '0.75rem 1rem' : '1rem 2rem',
                      color: 'white',
                      fontWeight: '600',
                      fontSize: window.innerWidth < 768 ? '1rem' : '1.1rem',
                      transition: 'all 0.3s ease',
                      transform: loading ? 'none' : 'translateY(0)',
                      cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
                        (e.target as HTMLButtonElement).style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading) {
                        (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
                        (e.target as HTMLButtonElement).style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                      }
                    }}
                  >
                    {loading ? (
                      <>
                        <div className="spinner-border spinner-border-sm me-2" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        {window.innerWidth < 768 ? 'Processing...' : 'Processing Analysis...'}
                      </>
                    ) : (
                      <>
                        <i className={`fas fa-rocket ${window.innerWidth < 768 ? 'me-2' : 'me-3'}`}></i>
                        {window.innerWidth < 768 ? 'Run Analysis' : 'Run Analysis'}
                      </>
                    )}
                  </button>
                </div>
              </form>
              </div>
            </div>
          </div>
          
          {/* Interactive Map */}
          <div className="col-lg-7">
            <div className="card border-0 shadow-lg" style={{
              borderRadius: '1.5rem',
              overflow: 'hidden'
            }}>
              <div className="card-header bg-white border-0" style={{ padding: '1.5rem 2rem' }}>
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <div className="bg-success bg-opacity-10 rounded-3 p-2 me-3">
                      <i className="fas fa-map text-success" style={{ fontSize: '1.5rem' }}></i>
                    </div>
                    <div>
                      <h5 className="card-title mb-0 fw-bold">Interactive Map</h5>
                      <small className="text-muted">Draw polygons or upload shapefiles to define your area of interest</small>
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    <span className="badge bg-success bg-opacity-10 text-success px-3 py-2 rounded-pill">
                      <i className="fas fa-draw-polygon me-1"></i>Draw Mode
                    </span>
                  </div>
                </div>
              </div>
              <div className="card-body p-0" style={{ height: '600px', position: 'relative' }}>
                <InteractiveMap 
                  onAreaSelect={handleAreaSelect} 
                  clearLayers={clearMapLayers}
                  clearShapefileLayers={clearShapefileLayers}
                  uploadedShapefile={uploadedShapefile as any}
                >
                  {/* Add NDVI/LST visualization layer */}
                  {showMapVisualization && geometryForMap && results && (
                    <AnalysisMapLayer
                      geometry={geometryForMap}
                      startDate={formData.startDate}
                      endDate={formData.endDate}
                      analysisType={formData.analysisType}
                      satellite={formData.satellite}
                      cloudCover={formData.cloudCover}
                      visible={showMapVisualization}
                      onMapDataLoad={setMapVisualizationData}
                      onError={setMapError}
                    />
                  )}
                </InteractiveMap>
              </div>
            </div>
            
            {/* Advanced Analysis Section */}
            <div className="card border-0 shadow-lg mt-4" style={{
              borderRadius: '1.5rem',
              height: '400px',
              background: 'linear-gradient(145deg, #f8f9fa 0%, #e9ecef 100%)'
            }}>
              <div className="card-body text-center py-4 mt-5">
                <div className="mb-3">
                  <div className="bg-primary bg-opacity-10 rounded-circle p-3 d-inline-flex">
                    <i className="fas fa-microscope text-primary" style={{ fontSize: '2rem' }}></i>
                  </div>
                </div>
                <h4 className="fw-bold mb-3">Advanced Image Analysis</h4>
                <p className="text-muted mb-3">
                  Unlock powerful satellite image processing with advanced analysis tools, custom spectral analysis, and detailed change detection.
                </p>
                <div className="d-flex justify-content-center gap-2 flex-wrap mb-3">
                  <span className="badge bg-success bg-opacity-10 text-success px-2 py-1 small">
                    <i className="fas fa-chart-area me-1"></i>Spectral
                  </span>
                  <span className="badge bg-warning bg-opacity-10 text-warning px-2 py-1 small">
                    <i className="fas fa-exchange-alt me-1"></i>Change Detection
                  </span>
                  <span className="badge bg-info bg-opacity-10 text-info px-2 py-1 small">
                    <i className="fas fa-layer-group me-1"></i>Multi-temporal
                  </span>
                </div>
                <button
                  className="btn btn-primary px-4 py-2"
                  onClick={() => navigate('/advanced-image-analysis')}
                  style={{
                    borderRadius: '0.75rem',
                    fontWeight: '600',
                    boxShadow: '0 2px 8px rgba(13, 110, 253, 0.3)'
                  }}
                >
                  <i className="fas fa-rocket me-2"></i>
                  Launch Advanced Analysis
                </button>
              </div>
            </div>
          </div>
        </div>



        {/* Results Section - Enhanced Dashboard */}
        {showResults && results && (
          <div className="row mt-5">
            <div className="col-12">
              <AnalysisDashboard 
                analysisData={{
                  timeSeriesData: transformTimeSeriesData(results.time_series_data || [], results.analysis_type || formData.analysisType),
                  statistics: transformStatistics(results.statistics, results.analysis_type || formData.analysisType),
                  tableData: transformDataForTable(results.data || [], results.analysis_type),
                  geometry: results.geometry || geometryForMap, // Use backend processed geometry if available, fallback to user input
                  analysisType: results.analysis_type?.toLowerCase() || formData.analysisType,
                  satellite: results.satellite || formData.satellite,
                  startDate: formData.startDate,
                  endDate: formData.endDate,
                  cloudCover: formData.cloudCover
                }}
                onDataUpdate={(data) => console.log('Dashboard data updated:', data)}
              />
            </div>
          </div>
        )}

        {/* Legacy Results Section (kept as fallback) */}
        {showResults && results && false && (
          <div className="row mt-5">
            <div className="col-12">
              <div className="card result-container">
                <div className="card-header bg-light">
                  <h3 className="card-title mb-0">
                    <i className="fas fa-chart-line feature-icon"></i>
                    Analysis Results
                  </h3>
                </div>
                <div className="card-body">
                  <div id="results">
                    {/* Analysis Success Indicator */}
                    <div className="alert alert-success mb-4">
                      <div className="d-flex align-items-center">
                        <i className="fas fa-check-circle me-3" style={{ fontSize: '1.5rem' }}></i>
                        <div>
                          <h5 className="mb-1">Analysis Completed Successfully!</h5>
                          <p className="mb-0">
                            {results.analysis_type} analysis using {results.satellite} 
                            {results.demo_mode ? ' (Demo Mode)' : ' (Real Earth Engine Data)'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Map Visualization Controls */}
                    {(results.analysis_type === 'NDVI' || results.analysis_type === 'LST') && geometryForMap && (
                      <div className="card mb-4">
                        <div className="card-header">
                          <h5 className="card-title mb-0">
                            <i className="fas fa-satellite me-2"></i>
                            Map Visualization
                          </h5>
                        </div>
                        <div className="card-body">
                          <div className="row align-items-center">
                            <div className="col-md-8">
                              <p className="mb-2">
                                Display the calculated {results.analysis_type} imagery on the map, clipped to your selected area.
                              </p>
                              {mapError && (
                                <div className="alert alert-warning alert-sm">
                                  <i className="fas fa-exclamation-triangle me-2"></i>
                                  {mapError}
                                </div>
                              )}
                              {mapVisualizationData && (
                                <div className="alert alert-info alert-sm">
                                  <i className="fas fa-info-circle me-2"></i>
                                  Map visualization loaded successfully. Zoom to the colored area on the map above to see the {results.analysis_type} imagery.
                                </div>
                              )}
                            </div>
                            <div className="col-md-4 text-end">
                              <button
                                className={`btn ${showMapVisualization ? 'btn-danger' : 'btn-primary'}`}
                                onClick={() => {
                                  setShowMapVisualization(!showMapVisualization);
                                  if (showMapVisualization) {
                                    // Clear map data when hiding visualization
                                    setMapVisualizationData(null);
                                    setMapError('');
                                  }
                                }}
                                disabled={!geometryForMap}
                              >
                                <i className={`fas ${showMapVisualization ? 'fa-eye-slash' : 'fa-eye'} me-2`}></i>
                                {showMapVisualization ? 'Hide' : 'Show'} on Map
                              </button>
                            </div>
                          </div>
                          
                          {/* Visualization Legend */}
                          {showMapVisualization && mapVisualizationData && (
                            <div className="mt-3">
                              <hr />
                              <div className="row">
                                <div className="col-md-6">
                                  <h6>
                                    <i className="fas fa-palette me-2"></i>
                                    Color Scale
                                  </h6>
                                  {results.analysis_type === 'NDVI' ? (
                                    <div className="d-flex align-items-center">
                                      <div className="legend-gradient ndvi-gradient me-3" style={{
                                        background: 'linear-gradient(to right, red, yellow, green)',
                                        width: '100px',
                                        height: '20px',
                                        border: '1px solid #ccc'
                                      }}></div>
                                      <div>
                                        <small>
                                          <span className="text-danger">Red: Low Vegetation</span> → 
                                          <span className="text-success"> Green: High Vegetation</span>
                                        </small>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="d-flex align-items-center">
                                      <div className="legend-gradient lst-gradient me-3" style={{
                                        background: 'linear-gradient(to right, blue, cyan, yellow, red)',
                                        width: '100px',
                                        height: '20px',
                                        border: '1px solid #ccc'
                                      }}></div>
                                      <div>
                                        <small>
                                          <span className="text-primary">Blue: Cool</span> → 
                                          <span className="text-danger"> Red: Hot</span>
                                        </small>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="col-md-6">
                                  <h6>
                                    <i className="fas fa-ruler me-2"></i>
                                    Value Range
                                  </h6>
                                  <small className="text-muted">
                                    {results.analysis_type === 'NDVI' 
                                      ? '-1.0 (Water/No Vegetation) to +1.0 (Dense Vegetation)'
                                      : '0°C (Cold) to 40°C (Hot) Land Surface Temperature'
                                    }
                                  </small>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Statistics Cards */}
                    {results.statistics && (
                      <div className="row mb-4">
                        {results.analysis_type === 'NDVI' && (
                          <>
                            <div className="col-md-3 mb-3">
                              <div className="card stats-card h-100">
                                <div className="card-body text-center">
                                  <i className="fas fa-chart-line text-success mb-2" style={{ fontSize: '2rem' }}></i>
                                  <h6 className="card-title">Mean NDVI</h6>
                                  <h4 className="text-success mb-0">
                                    {results.statistics.mean_ndvi?.toFixed(3) || results.statistics.basic_stats?.mean?.toFixed(3)}
                                  </h4>
                                </div>
                              </div>
                            </div>
                            <div className="col-md-3 mb-3">
                              <div className="card stats-card h-100">
                                <div className="card-body text-center">
                                  <i className="fas fa-arrow-up text-warning mb-2" style={{ fontSize: '2rem' }}></i>
                                  <h6 className="card-title">Max NDVI</h6>
                                  <h4 className="text-warning mb-0">
                                    {results.statistics.max_ndvi?.toFixed(3) || results.statistics.basic_stats?.max?.toFixed(3)}
                                  </h4>
                                </div>
                              </div>
                            </div>
                            <div className="col-md-3 mb-3">
                              <div className="card stats-card h-100">
                                <div className="card-body text-center">
                                  <i className="fas fa-arrow-down text-danger mb-2" style={{ fontSize: '2rem' }}></i>
                                  <h6 className="card-title">Min NDVI</h6>
                                  <h4 className="text-danger mb-0">
                                    {results.statistics.min_ndvi?.toFixed(3) || results.statistics.basic_stats?.min?.toFixed(3)}
                                  </h4>
                                </div>
                              </div>
                            </div>
                            <div className="col-md-3 mb-3">
                              <div className="card stats-card h-100">
                                <div className="card-body text-center">
                                  <i className="fas fa-chart-bar text-info mb-2" style={{ fontSize: '2rem' }}></i>
                                  <h6 className="card-title">Std Dev</h6>
                                  <h4 className="text-info mb-0">
                                    {results.statistics.std_ndvi?.toFixed(3) || results.statistics.basic_stats?.std?.toFixed(3)}
                                  </h4>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                        
                        {results.analysis_type === 'LST' && (
                          <>
                            <div className="col-md-3 mb-3">
                              <div className="card stats-card h-100">
                                <div className="card-body text-center">
                                  <i className="fas fa-thermometer-half text-primary mb-2" style={{ fontSize: '2rem' }}></i>
                                  <h6 className="card-title">Mean LST (°C)</h6>
                                  <h4 className="text-primary mb-0">
                                    {results.statistics?.mean_lst?.toFixed(1) || 
                                     results.statistics?.basic_stats?.mean?.toFixed(1) ||
                                     (results.data?.length > 0 ? 
                                      (results.data.reduce((sum: number, item: any) => sum + (item.lst || 0), 0) / results.data.length).toFixed(1) : 'N/A')}
                                  </h4>
                                </div>
                              </div>
                            </div>
                            <div className="col-md-3 mb-3">
                              <div className="card stats-card h-100">
                                <div className="card-body text-center">
                                  <i className="fas fa-arrow-up text-danger mb-2" style={{ fontSize: '2rem' }}></i>
                                  <h6 className="card-title">Max LST (°C)</h6>
                                  <h4 className="text-danger mb-0">
                                    {results.statistics?.max_lst?.toFixed(1) || 
                                     results.statistics?.basic_stats?.max?.toFixed(1) ||
                                     (results.data?.length > 0 ? 
                                      Math.max(...results.data.map((item: any) => item.lst || 0)).toFixed(1) : 'N/A')}
                                  </h4>
                                </div>
                              </div>
                            </div>
                            <div className="col-md-3 mb-3">
                              <div className="card stats-card h-100">
                                <div className="card-body text-center">
                                  <i className="fas fa-arrow-down text-info mb-2" style={{ fontSize: '2rem' }}></i>
                                  <h6 className="card-title">Min LST (°C)</h6>
                                  <h4 className="text-info mb-0">
                                    {results.statistics?.min_lst?.toFixed(1) || 
                                     results.statistics?.basic_stats?.min?.toFixed(1) ||
                                     (results.data?.length > 0 ? 
                                      Math.min(...results.data.map((item: any) => item.lst || 0)).toFixed(1) : 'N/A')}
                                  </h4>
                                </div>
                              </div>
                            </div>
                            <div className="col-md-3 mb-3">
                              <div className="card stats-card h-100">
                                <div className="card-body text-center">
                                  <i className="fas fa-chart-bar text-secondary mb-2" style={{ fontSize: '2rem' }}></i>
                                  <h6 className="card-title">Std Dev</h6>
                                  <h4 className="text-secondary mb-0">
                                    {results.statistics.std_lst?.toFixed(2) || 'N/A'}
                                  </h4>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Time Series Chart */}
                    {(results.time_series_data || results.data) && (results.time_series_data || results.data).length > 0 && (
                      <div className="card mb-4">
                        <div className="card-header">
                          <h5 className="card-title mb-0">
                            <i className="fas fa-chart-line me-2"></i>
                            Time Series Analysis {results.time_series_data ? '(Annual Means)' : '(Individual Images)'}
                          </h5>
                        </div>
                        <div className="card-body">
                          <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={results.time_series_data || results.data}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="date" 
                                tick={{ fontSize: 12 }}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                              />
                              <YAxis 
                                domain={results.analysis_type === 'NDVI' ? [0, 1] : 
                                        results.analysis_type === 'LST' ? ['dataMin - 2', 'dataMax + 2'] : 
                                        ['dataMin', 'dataMax']}
                                tick={{ fontSize: 12 }}
                                tickFormatter={(value: number) => {
                                  if (results.analysis_type === 'NDVI') return value.toFixed(2);
                                  if (results.analysis_type === 'LST') return `${value.toFixed(1)}°C`;
                                  return `${value.toFixed(1)}dB`;
                                }}
                                label={{ 
                                  value: results.analysis_type === 'NDVI' ? 'NDVI Value' : 
                                         results.analysis_type === 'LST' ? 'Temperature (°C)' : 'Backscatter (dB)',
                                  angle: -90, 
                                  position: 'insideLeft' 
                                }}
                              />
                              <Tooltip 
                                formatter={(value: number, name: string) => {
                                  const formattedValue = value.toFixed(results.analysis_type === 'NDVI' ? 3 : 1);
                                  const label = results.analysis_type === 'NDVI' ? 'NDVI' : 
                                               results.analysis_type === 'LST' ? 'LST (°C)' : 
                                               name.includes('vh') ? 'VH Backscatter (dB)' : 'VV Backscatter (dB)';
                                  return [formattedValue, label];
                                }}
                                labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString()}`}
                              />
                              <Legend />
                              {results.analysis_type === 'SAR' ? (
                                <>
                                  <Line 
                                    type="linear" 
                                    dataKey="backscatter_vv" 
                                    stroke="#007bff"
                                    strokeWidth={3}
                                    dot={{ fill: "#007bff", strokeWidth: 2, r: 6 }}
                                    activeDot={{ r: 8 }}
                                    name="VV Backscatter (dB)"
                                  />
                                  <Line 
                                    type="linear" 
                                    dataKey="backscatter_vh" 
                                    stroke="#28a745"
                                    strokeWidth={3}
                                    dot={{ fill: "#28a745", strokeWidth: 2, r: 6 }}
                                    activeDot={{ r: 8 }}
                                    name="VH Backscatter (dB)"
                                  />
                                </>
                              ) : (
                                <Line 
                                  type="linear" 
                                  dataKey={results.analysis_type === 'NDVI' ? 'ndvi' : 
                                           results.analysis_type === 'LST' ? 'lst' : 'backscatter_vv'} 
                                  stroke={results.analysis_type === 'NDVI' ? '#28a745' : 
                                          results.analysis_type === 'LST' ? '#dc3545' : '#007bff'}
                                  strokeWidth={3}
                                  dot={{ fill: results.analysis_type === 'NDVI' ? '#28a745' : 
                                               results.analysis_type === 'LST' ? '#dc3545' : '#007bff', 
                                         strokeWidth: 2, r: 6 }}
                                  activeDot={{ r: 8 }}
                                  name={results.analysis_type === 'NDVI' ? 'NDVI' : 
                                        results.analysis_type === 'LST' ? 'LST (°C)' : 'Backscatter VV (dB)'}
                                />
                              )}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Data Table */}
                    {results.data && results.data.length > 0 && (
                      <div className="card mb-4">
                        <div className="card-header">
                          <h5 className="card-title mb-0">
                            <i className="fas fa-table me-2"></i>
                            Detailed Data Table
                          </h5>
                        </div>
                        <div className="card-body">
                          <div className="table-responsive">
                            <table className="table table-striped table-hover">
                              <thead className="table-dark">
                                <tr>
                                  <th scope="col">#</th>
                                  <th scope="col">Image ID</th>
                                  <th scope="col">Date</th>
                                  <th scope="col">Satellite</th>
                                  <th scope="col">Cloud Cover (%)</th>
                                  {results.analysis_type === 'NDVI' && (
                                    <>
                                      <th scope="col">NDVI Value</th>
                                      <th scope="col">Vegetation Status</th>
                                    </>
                                  )}
                                  {results.analysis_type === 'LST' && (
                                    <>
                                      <th scope="col">LST (°C)</th>
                                      <th scope="col">Pixel Count</th>
                                      <th scope="col">Temperature Class</th>
                                    </>
                                  )}
                                  {results.analysis_type === 'SAR' && (
                                    <>
                                      <th scope="col">VV Backscatter (dB)</th>
                                      <th scope="col">VH Backscatter (dB)</th>
                                      <th scope="col">Pixel Count</th>
                                    </>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {results.data.map((item: any, index: number) => (
                                  <tr key={index}>
                                    <td>{index + 1}</td>
                                    <td>
                                      <code className="text-primary" style={{ fontSize: '0.8rem' }}>
                                        {item.image_id || `IMG_${new Date(item.date).getFullYear()}${String(new Date(item.date).getMonth() + 1).padStart(2, '0')}${String(new Date(item.date).getDate()).padStart(2, '0')}`}
                                      </code>
                                    </td>
                                    <td>
                                      <span className="badge bg-secondary">
                                        {new Date(item.date).toLocaleDateString()}
                                      </span>
                                    </td>
                                    <td>
                                      <span className="badge bg-info">
                                        {item.satellite || results.satellite || 'Unknown'}
                                      </span>
                                    </td>
                                    <td>
                                      <span className={`badge ${
                                        results.analysis_type === 'SAR' ? 'bg-secondary' :
                                        (item.estimated_cloud_cover || 0) < 10 ? 'bg-success' :
                                        (item.estimated_cloud_cover || 0) < 30 ? 'bg-warning text-dark' : 'bg-danger'
                                      }`}>
                                        {results.analysis_type === 'SAR' ? 'N/A (SAR)' : 
                                         `${item.estimated_cloud_cover?.toFixed(1) || 'N/A'}%`}
                                      </span>
                                    </td>
                                    {results.analysis_type === 'NDVI' && (
                                      <>
                                        <td>
                                          <span className={`badge ${
                                            item.ndvi > 0.7 ? 'bg-success' :
                                            item.ndvi > 0.4 ? 'bg-warning' : 'bg-danger'
                                          }`}>
                                            {item.ndvi.toFixed(3)}
                                          </span>
                                        </td>
                                        <td>
                                          <span className={`badge ${
                                            item.ndvi > 0.7 ? 'bg-success' :
                                            item.ndvi > 0.4 ? 'bg-warning text-dark' : 'bg-danger'
                                          }`}>
                                            {item.ndvi > 0.7 ? 'Dense Vegetation' :
                                             item.ndvi > 0.4 ? 'Moderate Vegetation' : 'Sparse/No Vegetation'}
                                          </span>
                                        </td>
                                      </>
                                    )}
                                    {results.analysis_type === 'LST' && (
                                      <>
                                        <td>
                                          <span className={`badge ${
                                            item.lst > 35 ? 'bg-danger' :
                                            item.lst > 25 ? 'bg-warning text-dark' : 'bg-info'
                                          }`}>
                                            {item.lst?.toFixed(1) || 'N/A'}°C
                                          </span>
                                        </td>
                                        <td>
                                          <span className="badge bg-secondary">
                                            {item.count?.toLocaleString() || 'N/A'}
                                          </span>
                                        </td>
                                        <td>
                                          <span className={`badge ${
                                            item.lst > 35 ? 'bg-danger' :
                                            item.lst > 25 ? 'bg-warning text-dark' : 'bg-info'
                                          }`}>
                                            {item.lst > 35 ? 'Very Hot' :
                                             item.lst > 25 ? 'Warm' : 'Cool'}
                                          </span>
                                        </td>
                                      </>
                                    )}
                                    {results.analysis_type === 'SAR' && (
                                      <>
                                        <td>
                                          <span className="badge bg-primary">
                                            {item.backscatter_vv?.toFixed(1) || 'N/A'} dB
                                          </span>
                                        </td>
                                        <td>
                                          <span className="badge bg-info">
                                            {item.backscatter_vh?.toFixed(1) || 'N/A'} dB
                                          </span>
                                        </td>
                                        <td>
                                          <span className="badge bg-secondary">
                                            {item.count?.toLocaleString() || 'N/A'}
                                          </span>
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          
                          {/* Data Summary */}
                          <div className="mt-3 p-3 bg-light rounded">
                            <h6 className="mb-2">
                              <i className="fas fa-info-circle me-1"></i>
                              Data Summary
                            </h6>
                            <div className="row">
                              <div className="col-md-3">
                                <small className="text-muted">
                                  <strong>Individual Records:</strong> {results.data?.length || 0}
                                </small>
                              </div>
                              <div className="col-md-3">
                                <small className="text-muted">
                                  <strong>Time Series Points:</strong> {results.time_series_data?.length || results.data?.length || 0}
                                </small>
                              </div>
                              <div className="col-md-3">
                                <small className="text-muted">
                                  <strong>Date Range:</strong> {
                                    results.data?.length > 0 ? new Date(results.data[0]?.date).toLocaleDateString() : 'N/A'
                                  } - {
                                    results.data?.length > 0 ? new Date(results.data[results.data.length - 1]?.date).toLocaleDateString() : 'N/A'
                                  }
                                </small>
                              </div>
                              <div className="col-md-3">
                                <small className="text-muted">
                                  <strong>Analysis Type:</strong> {results.analysis_type}
                                </small>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Analysis Details */}
                    <div className="row">
                      <div className="col-md-6">
                        <div className="card">
                          <div className="card-header">
                            <h6 className="card-title mb-0">
                              <i className="fas fa-info-circle me-2"></i>
                              Analysis Details
                            </h6>
                          </div>
                          <div className="card-body">
                            <table className="table table-sm">
                              <tbody>
                                <tr>
                                  <td><strong>Analysis Type:</strong></td>
                                  <td>{results.analysis_type}</td>
                                </tr>
                                <tr>
                                  <td><strong>Satellite:</strong></td>
                                  <td>{results.satellite}</td>
                                </tr>
                                <tr>
                                  <td><strong>Date Range:</strong></td>
                                  <td>{results.statistics?.date_range || `${results.request_parameters?.start_date} to ${results.request_parameters?.end_date}`}</td>
                                </tr>
                                <tr>
                                  <td><strong>Cloud Cover:</strong></td>
                                  <td>{results.request_parameters?.cloud_cover}%</td>
                                </tr>
                                {results.statistics?.area_km2 && (
                                  <tr>
                                    <td><strong>Area:</strong></td>
                                    <td>{results.statistics.area_km2.toFixed(2)} km²</td>
                                  </tr>
                                )}
                                {results.statistics?.pixel_count && (
                                  <tr>
                                    <td><strong>Pixels:</strong></td>
                                    <td>{results.statistics.pixel_count.toLocaleString()}</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                      
                      <div className="col-md-6">
                        <div className="card">
                          <div className="card-header">
                            <h6 className="card-title mb-0">
                              <i className="fas fa-download me-2"></i>
                              Download Results
                            </h6>
                          </div>
                          <div className="card-body">
                            {results.plot_url && (
                              <div className="mb-3">
                                <a 
                                  href={`http://localhost:8000${results.plot_url}`} 
                                  className="btn btn-outline-primary btn-sm me-2"
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <i className="fas fa-chart-line me-1"></i>
                                  Download Plot
                                </a>
                              </div>
                            )}
                            {results.csv_url && (
                              <div className="mb-3">
                                <a 
                                  href={`http://localhost:8000${results.csv_url}`} 
                                  className="btn btn-outline-success btn-sm me-2"
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <i className="fas fa-file-csv me-1"></i>
                                  Download CSV
                                </a>
                              </div>
                            )}
                            <div className="mt-3">
                              <small className="text-muted">
                                <i className="fas fa-info-circle me-1"></i>
                                Results saved to database (ID: {results.database_id})
                              </small>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Raw Data Toggle */}
                    <div className="card mt-4">
                      <div className="card-header">
                        <button 
                          className="btn btn-link p-0 text-decoration-none" 
                          type="button" 
                          data-bs-toggle="collapse" 
                          data-bs-target="#rawDataCollapse"
                        >
                          <i className="fas fa-code me-2"></i>
                          View Raw Data
                        </button>
                      </div>
                      <div className="collapse" id="rawDataCollapse">
                        <div className="card-body">
                          <pre className="bg-light p-3" style={{ maxHeight: '400px', overflow: 'auto' }}>
                            {JSON.stringify(results, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Historical Data Information */}
        <div className="alert alert-info mb-4 mt-4" role="alert">
          <i className="fas fa-info-circle me-2"></i>
          <strong>Historical Data Availability:</strong> 
          Landsat data is available from 1988 onwards. Earlier years (1988-1999) use Landsat 5 TM data, 
          while more recent years combine data from multiple Landsat missions (5, 7, 8, 9) for better coverage.
        </div>
      </div>
    </div>
  );
};

export default AnalysisPage;
