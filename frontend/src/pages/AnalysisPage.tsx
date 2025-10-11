import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { InteractiveMap } from '../components/map/InteractiveMap';
import AnalysisDashboard from '../components/analysis/AnalysisDashboard';
import { AnalysisForm } from '../components/analysis/AnalysisForm';
import authService from '../services/authService';
import '../styles/AnalysisPage.css';

const AnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [uploadedShapefile, setUploadedShapefile] = useState<File | null>(null);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [clearMapLayers] = useState<boolean>(false);
  const [clearShapefileLayers] = useState<boolean>(false);
  const [geometryForMap, setGeometryForMap] = useState<any>(null);
  const [lastFormData, setLastFormData] = useState<any>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectAnalyses, setProjectAnalyses] = useState<any[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [formInitialData, setFormInitialData] = useState<any>({});
  const [loadedAnalysisMessage, setLoadedAnalysisMessage] = useState<string>('');
  const [initialDateRangeType, setInitialDateRangeType] = useState<string>('years');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [mapDrawnCoordinates, setMapDrawnCoordinates] = useState<string>('');

  // Delete analysis function
  const deleteAnalysis = async (analysisId: number, analysisName: string) => {
    if (!window.confirm(`Are you sure you want to delete the analysis "${analysisName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = authService.getAccessToken();
      const response = await fetch(`http://localhost:8000/api/v1/analysis/delete/${analysisId}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        
        // Remove the deleted analysis from the local state
        setProjectAnalyses(prev => prev.filter(analysis => analysis.id !== analysisId));
        
        // Clear current selection if the deleted analysis was selected
        if (selectedAnalysis?.id === analysisId) {
          setSelectedAnalysis(null);
          setFormInitialData({});
          setResults(null);
          setShowResults(false);
          setGeometryForMap(null);
          setLastFormData(null);
          setLoadedAnalysisMessage('');
          setInitialDateRangeType('years');
        }
        
        setLoadedAnalysisMessage(`Analysis "${result.deleted_analysis?.name || analysisName}" deleted successfully`);
        
        // Clear the success message after 5 seconds
        setTimeout(() => {
          setLoadedAnalysisMessage('');
        }, 5000);
        
      } else {
        const errorData = await response.json();
        setError(`Failed to delete analysis: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error deleting analysis:', err);
      setError('Failed to delete analysis. Please try again.');
    }
  };

  // Helper function to convert GeoJSON to WKT
  const convertGeoJSONToWKT = (geoJson: any): string => {
    try {
      if (!geoJson) return '';
      
      // Handle FeatureCollection format
      if (geoJson.type === 'FeatureCollection' && geoJson.features && geoJson.features.length > 0) {
        const geometry = geoJson.features[0].geometry;
        return convertGeometryToWKT(geometry);
      }
      
      // Handle Feature format
      if (geoJson.type === 'Feature' && geoJson.geometry) {
        return convertGeometryToWKT(geoJson.geometry);
      }
      
      // Handle direct geometry format
      if (geoJson.type && geoJson.coordinates) {
        return convertGeometryToWKT(geoJson);
      }
      
      // If it's already a string (WKT), return as is
      if (typeof geoJson === 'string') {
        return geoJson;
      }
      
      return '';
    } catch (error) {
      console.warn('Error converting GeoJSON to WKT:', error);
      return '';
    }
  };

  const convertGeometryToWKT = (geometry: any): string => {
    if (!geometry || !geometry.coordinates) {
      return '';
    }
    
    switch (geometry.type) {
      case 'Polygon':
        const coords = geometry.coordinates[0]; // First ring of polygon
        if (!coords || coords.length === 0) {
          return '';
        }
        
        // Ensure the polygon is closed (first point equals last point)
        let polygonCoords = [...coords];
        if (polygonCoords[0][0] !== polygonCoords[polygonCoords.length - 1][0] || 
            polygonCoords[0][1] !== polygonCoords[polygonCoords.length - 1][1]) {
          polygonCoords.push(polygonCoords[0]);
        }
        
        const wktCoords = polygonCoords.map((coord: number[]) => `${coord[0]} ${coord[1]}`).join(', ');
        return `POLYGON((${wktCoords}))`;
      
      case 'Point':
        return `POINT(${geometry.coordinates[0]} ${geometry.coordinates[1]})`;
      
      default:
        console.warn('Unsupported geometry type:', geometry.type);
        return '';
    }
  };

  // Get project ID from URL parameters
  useEffect(() => {
    const project = searchParams.get('project');
    if (project) {
      setProjectId(project);
      loadProjectAnalyses(project);
    }
  }, [searchParams]);

  // Load analyses for the current project
  const loadProjectAnalyses = async (projectId: string) => {
    try {
      const api = authService.getAuthenticatedAPI();
      const response = await api.get(`/projects/${projectId}/analyses/`);
      
      if (response.data.success) {
        setProjectAnalyses(response.data.analyses);
        
        // If there are analyses, select the most recent one
        if (response.data.analyses.length > 0) {
          const mostRecent = response.data.analyses[0];
          setSelectedAnalysis(mostRecent);
          if (mostRecent.results) {
            setResults(mostRecent.results);
            setShowResults(true);
          }
        }
      }
    } catch (error) {
      console.error('Error loading project analyses:', error);
    }
  };

  // Handle area selection from map
  const handleAreaSelect = (coordinates: any, wkt: string = '', source: string = 'drawing', geometry: any = null) => {
    // Use provided geometry or create GeoJSON geometry for map visualization
    let mapGeometry = geometry;
    if (!mapGeometry && Array.isArray(coordinates) && coordinates.length > 0) {
      mapGeometry = {
        type: 'Polygon',
        coordinates: [coordinates.map((coord: any) => {
          if (Array.isArray(coord) && coord.length === 2) {
            return [coord[0], coord[1]]; // lon,lat for GeoJSON
          }
          return [coord.lng, coord.lat];
        })]
      };
    }
    setGeometryForMap(mapGeometry);
    
    // Update coordinates drawn from map
    setMapDrawnCoordinates(wkt);
    
    // Update form initial data with the new coordinates
    setFormInitialData((prev: any) => ({
      ...prev,
      coordinates: wkt
    }));
    
    // Clear uploaded shapefile when drawing on map (not when shapefile sets coordinates)
    if (wkt && uploadedShapefile && source === 'drawing') {
      setUploadedShapefile(null);
    }
  };

  // Handle form submission from AnalysisForm
  const handleFormSubmit = async (formData: any, dateRangeType: string) => {
    if (!formData.coordinates.trim() && !uploadedShapefile) {
      setError('Please select an area of interest either by drawing on the map or uploading a shapefile');
      return;
    }

    // Store form data for use in results dashboard
    setLastFormData(formData);
    
    console.log('=== Storing Form Data Debug ===');
    console.log('Form data being stored:', formData);
    console.log('enableCloudMasking:', formData.enableCloudMasking);
    console.log('maskingStrictness:', formData.maskingStrictness);

    setLoading(true);
    setError('');
    setLoadedAnalysisMessage(''); // Clear any loaded analysis message
    setInitialDateRangeType('years'); // Reset date range type when starting new analysis

    try {
      // Prepare the request data
      let requestData: any;
      let contentType: string;
      
      if (uploadedShapefile) {
        // Use FormData for shapefile uploads
        requestData = new FormData();
        
        // Add form data
        Object.keys(formData).forEach(key => {
          let value = formData[key as keyof typeof formData];
          // Convert sentinel1 to sentinel for backend compatibility
          if (key === 'satellite' && value === 'sentinel1') {
            value = 'sentinel';
          }
          requestData.append(key, String(value));
        });

        // Add shapefile
        requestData.append('shapefile', uploadedShapefile);
        
        // Add additional fields
        if (projectId) {
          requestData.append('project_id', projectId);
        }
        requestData.append('projectId', 'ee-ayotundenew');
        requestData.append('dateRangeType', dateRangeType);
        
        contentType = 'multipart/form-data';
      } else {
        // Use JSON for regular requests
        const requestBody: any = {
          coordinates: formData.coordinates,
          analysis_type: formData.analysisType,
          satellite: formData.satellite === 'sentinel1' ? 'sentinel' : formData.satellite, // Backend expects 'sentinel' for SAR
          project_id: projectId || undefined, // Use actual project ID
          date_range_type: dateRangeType
        };

        // Add date parameters based on range type
        if (dateRangeType === 'years') {
          requestBody.start_year = parseInt(formData.startYear?.toString() || new Date(formData.startDate).getFullYear().toString());
          requestBody.end_year = parseInt(formData.endYear?.toString() || new Date(formData.endDate).getFullYear().toString());
        } else {
          requestBody.start_date = formData.startDate;
          requestBody.end_date = formData.endDate;
        }

        // Add cloud cover and masking parameters for all optical satellites
        if (formData.satellite !== 'sentinel1' && ['ndvi', 'lst', 'comprehensive'].includes(formData.analysisType)) {
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

      console.log('=== Request Debug ===');
      console.log('Form satellite:', formData.satellite);
      console.log('Form analysisType:', formData.analysisType);
      console.log('Form polarization:', formData.polarization);
      console.log('Form enableCloudMasking:', formData.enableCloudMasking);
      console.log('Form maskingStrictness:', formData.maskingStrictness);
      console.log('Coordinates:', formData.coordinates);
      console.log('Content type:', contentType);
      console.log('Date range type:', dateRangeType);
      console.log('Request body/data:', contentType === 'application/json' ? requestData : 'FormData (check network tab)');
      
      // Determine the correct endpoint based on analysis type
      let endpoint = '';
      switch (formData.analysisType) {
        case 'ndvi':
          endpoint = '/analysis/process_ndvi/';
          break;
        case 'lst':
          endpoint = '/analysis/process_lst/';
          break;
        case 'sar':
          endpoint = '/analysis/process_sentinel/';
          break;
        case 'comprehensive':
          endpoint = '/analysis/process_comprehensive/';
          break;
        default:
          endpoint = '/analysis/process_ndvi/'; // Default to NDVI
      }

      // Make the API call using authenticated service
      const api = authService.getAuthenticatedAPI();
      let response;
      
      if (contentType === 'application/json') {
        response = await api.post(endpoint, JSON.parse(requestData as string));
      } else {
        // For FormData, use the axios instance directly
        response = await api.post(endpoint, requestData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      const result = response.data;
      
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
        
        // Check if this is a duplicate analysis
        if (result.is_duplicate) {
          setLoadedAnalysisMessage(`${result.duplicate_message || 'Loaded existing analysis with same parameters'}`);
          
          // Set a timeout to clear the duplicate message after 7 seconds
          setTimeout(() => {
            setLoadedAnalysisMessage('');
          }, 7000);
        }
        
        setResults(result);
        setShowResults(true);
        setError(''); // Clear any previous errors
        
        // Reload project analyses if we're in a project context
        if (projectId) {
          loadProjectAnalyses(projectId);
        }
      } else {
        setError(result.message || 'Analysis failed');
      }
      
    } catch (error: any) {
      console.error('Analysis error:', error);
      console.error('Error response:', error.response);
      console.error('Error response data:', error.response?.data);
      
      let errorMessage = 'An error occurred during analysis';
      
      if (error.response?.status === 403) {
        errorMessage = error.response?.data?.detail || error.response?.data?.message || 'You do not have permission to perform this analysis. Please ensure you are logged in with the correct account.';
      } else if (error.response?.data) {
        errorMessage = error.response.data.detail || error.response.data.message || error.response.data.error || errorMessage;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions for data transformation
  const transformTimeSeriesData = (data: any[], analysisType: string) => {
    if (!Array.isArray(data)) {
      console.log('=== transformTimeSeriesData Debug ===');
      console.log('Input data is not an array:', data);
      return [];
    }
    
    console.log('=== transformTimeSeriesData Debug ===');
    console.log('Input data length:', data.length);
    console.log('Sample input:', data.slice(0, 2));
    console.log('Analysis type:', analysisType);
    
    const transformed = data.map((item: any) => {
      const date = new Date(item.date || item.time || '2020-01-01');
      const result: any = {
        date: date.toISOString().split('T')[0],
        time: date.getTime()
      };
      
      // Add analysis-specific data with proper field mapping
      switch (analysisType.toLowerCase()) {
        case 'ndvi':
          result.ndvi = parseFloat(item.ndvi || item.mean_ndvi || item.value || 0);
          break;
        case 'lst':
          result.lst = parseFloat(item.lst || item.mean_lst || item.temperature || item.value || 0);
          break;
        case 'sar':
          // SAR backend returns backscatter_vv, vv_backscatter fields
          result.backscatter = parseFloat(item.backscatter || item.backscatter_vv || item.vv_backscatter || item.mean_backscatter || item.value || 0);
          break;
        default:
          result.value = parseFloat(item.value || item.ndvi || item.lst || item.backscatter || item.backscatter_vv || 0);
      }
      
      return result;
    });
    
    console.log('Transformed time series data length:', transformed.length);
    console.log('Sample transformed:', transformed.slice(0, 2));
    return transformed;
  };

  const transformStatistics = (stats: any, analysisType: string) => {
    if (!stats) return {};
    
    console.log('=== transformStatistics Debug ===');
    console.log('Input stats:', stats);
    console.log('Analysis type:', analysisType);
    
    let transformed: any = {
      analysisType: analysisType,
      area_km2: parseFloat(stats.area_km2 || 0),
      pixel_count: parseInt(stats.pixel_count || 0),
      date_range: stats.date_range || '',
      total_observations: parseInt(stats.total_individual_observations || stats.annual_observations || 0),
      
      // The Statistics component expects a 'count' field specifically
      count: parseInt(stats.total_individual_observations || stats.annual_observations || stats.count || stats.pixel_count || stats.observations || 0)
    };
    
    // Handle analysis-specific statistics with proper field mapping
    switch (analysisType.toLowerCase()) {
      case 'ndvi':
        transformed.mean = parseFloat(stats.mean_ndvi || stats.mean || 0);
        transformed.min = parseFloat(stats.min_ndvi || stats.min || 0);
        transformed.max = parseFloat(stats.max_ndvi || stats.max || 0);
        transformed.std = parseFloat(stats.std_ndvi || stats.std || stats.stdDev || 0);
        break;
      case 'lst':
        transformed.mean = parseFloat(stats.mean_lst || stats.mean_temperature || stats.mean || 0);
        transformed.min = parseFloat(stats.min_lst || stats.min_temperature || stats.min || 0);
        transformed.max = parseFloat(stats.max_lst || stats.max_temperature || stats.max || 0);
        transformed.std = parseFloat(stats.std_lst || stats.std_temperature || stats.std || stats.stdDev || 0);
        break;
      case 'sar':
        // SAR backend returns mean_vv, min_vv, max_vv, std_vv fields
        transformed.mean = parseFloat(stats.mean_backscatter || stats.mean_vv || stats.mean || 0);
        transformed.min = parseFloat(stats.min_backscatter || stats.min_vv || stats.min || 0);
        transformed.max = parseFloat(stats.max_backscatter || stats.max_vv || stats.max || 0);
        transformed.std = parseFloat(stats.std_backscatter || stats.std_vv || stats.std || stats.stdDev || 0);
        break;
      default:
        transformed.mean = parseFloat(stats.mean || 0);
        transformed.min = parseFloat(stats.min || 0);
        transformed.max = parseFloat(stats.max || 0);
        transformed.std = parseFloat(stats.std || stats.stdDev || 0);
    }
    
    console.log('Transformed stats with count field:', transformed);
    console.log('Count value specifically:', transformed.count);
    return transformed;
  };

  const transformDataForTable = (data: any[], analysisType: string) => {
    if (!Array.isArray(data)) return [];
    
    console.log('=== transformDataForTable Debug ===');
    console.log('Input data:', data.slice(0, 2));
    console.log('Analysis type:', analysisType);
    
    const transformed = data.map((item: any, index: number) => {
      // Create the row object with DataTable expected field names
      const row: any = {
        id: index + 1,
        date: item.date || item.time || 'Unknown',
        imageId: item.image_id || item.imageId || `img_${index + 1}`,
        
        // Analysis-specific value fields that DataTable expects
        ndviValue: undefined,
        lstValue: undefined,
        backscatterValue: undefined,
        
        // Cloud cover and masking fields that DataTable expects
        originalCloudCover: parseFloat(item.cloud_cover || item.originalCloudCover || 0),
        adjustedCloudCover: parseFloat(item.adjusted_cloud_cover || item.adjustedCloudCover || item.cloud_cover || 0),
        cloudMaskingApplied: Boolean(item.cloud_masking_applied || item.cloudMaskingApplied || false),
        
        // Additional metadata
        lat: parseFloat(item.lat || 0),
        lon: parseFloat(item.lon || 0),
        satellite: item.satellite || '',
        
        // For SAR-specific fields - map both VV and VH backscatter properly
        backscatterVV: parseFloat(item.backscatter_vv || item.vv_backscatter || item.backscatterVV || 0),
        backscatterVH: parseFloat(item.backscatter_vh || item.vh_backscatter || item.backscatterVH || 0),
        vvVhRatio: parseFloat(item.vv_vh_ratio || item.vvVhRatio || 0),
        orbitDirection: item.orbit_direction || item.orbitDirection || 'ASCENDING'
      };
      
      // Set the appropriate analysis-specific value field
      switch (analysisType.toLowerCase()) {
        case 'ndvi':
          row.ndviValue = parseFloat(item.ndvi || item.value || 0);
          break;
        case 'lst':
          row.lstValue = parseFloat(item.lst || item.temperature || item.value || 0);
          break;
        case 'sar':
        case 'backscatter':
          // SAR backend returns backscatter_vv, backscatter_vh, vv_backscatter fields
          row.backscatterValue = parseFloat(item.backscatter || item.backscatter_vv || item.vv_backscatter || item.value || 0);
          break;
        default:
          row.ndviValue = parseFloat(item.value || item.ndvi || item.lst || item.backscatter || 0);
      }
      
      return row;
    });
    
    console.log('Transformed table data sample:', transformed.slice(0, 2));
    console.log('Field names in transformed data:', transformed.length > 0 ? Object.keys(transformed[0]) : []);
    return transformed;
  };

  // Get CSRF token for Django (currently unused but may be needed for future authentication)
  // const getCsrfToken = () => {
  //   const cookies = document.cookie.split(';');
  //   for (let cookie of cookies) {
  //     const [name, value] = cookie.trim().split('=');
  //     if (name === 'csrftoken') {
  //       return value;
  //     }
  //   }
  //   return '';
  // };

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
                <div className="rounded-3 p-3 me-md-4 mb-3 mb-md-0 d-flex align-items-center justify-content-center" style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                  width: '80px',
                  height: '80px'
                }}>
                  <i className="fas fa-satellite text-white" style={{ fontSize: '2.5rem' }}></i>
                </div>
                <div>
                  <h1 className="display-5 display-md-4 fw-bold text-">
                    Earth Observation Analysis
                  </h1>
                  <p className="lead text mb-0 opacity-90">Advanced satellite imagery and vegetation indices analysis platform</p>
                </div>
              </div>
              <div className="d-flex gap-2 gap-md-3 flex-wrap justify-content-center justify-content-md-start">
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
      
      {/* Saved Analyses Panel */}
      {projectId && projectAnalyses.length > 0 && (
        <div className="container mb-4">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-light d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <i className="fas fa-history me-2"></i>
                Saved Analyses for this Project
              </h5>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  setSelectedAnalysis(null);
                  setFormInitialData({});
                  setResults(null);
                  setShowResults(false);
                  setGeometryForMap(null);
                  setLastFormData(null);
                  setLoadedAnalysisMessage('');
                  setInitialDateRangeType('years'); // Reset to default
                }}
                title="Clear loaded analysis and start fresh"
              >
                <i className="fas fa-times me-1"></i>New Analysis
              </button>
            </div>
            <div className="card-body">
              <div className="row">
                {projectAnalyses.map((analysis) => (
                  <div key={analysis.id} className="col-md-6 col-lg-4 mb-3">
                    <div className={`card ${selectedAnalysis?.id === analysis.id ? 'border-primary' : 'border-light'}`}>
                      <div className="card-body p-3">
                        <h6 className="card-title">{analysis.analysis_type.toUpperCase()} Analysis</h6>
                        <p className="card-text small text-muted mb-2">
                          {new Date(analysis.created_at).toLocaleDateString()}
                        </p>
                        <p className="card-text small">
                          <strong>Satellite:</strong> {analysis.satellite}<br/>
                          <strong>Date Range:</strong> {analysis.start_date} to {analysis.end_date}
                        </p>
                        <div className="d-flex gap-2">
                          <button
                            className={`btn ${selectedAnalysis?.id === analysis.id ? 'btn-primary' : 'btn-outline-primary'} btn-sm flex-grow-1`}
                            onClick={() => {
                              setSelectedAnalysis(analysis);
                              if (analysis.results) {
                                // Process saved results the same way as fresh analysis results
                                console.log('=== Loading Saved Analysis Results ===');
                                console.log('Saved analysis data:', analysis.results);
                                
                                // Set the results directly - they should have the same structure as fresh results
                                setResults(analysis.results);
                                setShowResults(true);
                                
                                // Create form data for proper transformation and form population
                                const formData = {
                                  analysisType: analysis.analysis_type,
                                  satellite: analysis.satellite,
                                  startDate: analysis.start_date,
                                  endDate: analysis.end_date,
                                  cloudCover: analysis.cloud_cover || 20,
                                  cloudCoverValue: analysis.cloud_cover || 20, // Sync with cloudCover
                                  coordinates: convertGeoJSONToWKT(analysis.geometry_data),
                                  // Convert boolean fields to form format
                                  enableCloudMasking: analysis.use_cloud_masking !== undefined ? analysis.use_cloud_masking : true,
                                  maskingStrictness: analysis.strict_masking ? 'true' : 'false', // Form expects 'true'/'false' strings
                                  polarization: analysis.polarization || 'VV',
                                  // Add year fields if needed (extract from dates)
                                  startYear: new Date(analysis.start_date).getFullYear(),
                                  endYear: new Date(analysis.end_date).getFullYear()
                                };
                                
                                // Set form data for dashboard transformation
                                setLastFormData(formData);
                                
                                // Set initial data for the form to populate fields
                                setFormInitialData(formData);
                                
                                // Set date range type to 'dates' since saved analyses use specific dates
                                setInitialDateRangeType('dates');
                                
                                // Set success message
                                setLoadedAnalysisMessage(`Loaded ${analysis.analysis_type.toUpperCase()} analysis from ${new Date(analysis.created_at).toLocaleDateString()}`);
                                
                                console.log('Set form data for saved analysis:', formData);
                                
                                // Update map geometry if available
                                if (analysis.geometry_data) {
                                  // Use the original GeoJSON for map display
                                  let mapGeometry = analysis.geometry_data;
                                  
                                  // Convert FeatureCollection to simple geometry for map
                                  if (mapGeometry.type === 'FeatureCollection' && mapGeometry.features && mapGeometry.features.length > 0) {
                                    mapGeometry = mapGeometry.features[0].geometry;
                                  } else if (mapGeometry.type === 'Feature' && mapGeometry.geometry) {
                                    mapGeometry = mapGeometry.geometry;
                                  }
                                  
                                  setGeometryForMap(mapGeometry);
                                }
                              }
                            }}
                          >
                            {selectedAnalysis?.id === analysis.id ? 'Current' : 'Load Results'}
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteAnalysis(analysis.id, `${analysis.analysis_type.toUpperCase()} (${new Date(analysis.created_at).toLocaleDateString()})`);
                            }}
                            title="Delete this analysis"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
            {loadedAnalysisMessage && (
              <div className={`alert ${loadedAnalysisMessage.includes('duplicate') || loadedAnalysisMessage.includes('existing') ? 'alert-warning' : 'alert-success'}`} role="alert">
                <i className={`fas ${loadedAnalysisMessage.includes('duplicate') || loadedAnalysisMessage.includes('existing') ? 'fa-info-circle' : 'fa-check-circle'} me-2`}></i>
                {loadedAnalysisMessage}
                <button
                  type="button"
                  className="btn-close float-end"
                  onClick={() => setLoadedAnalysisMessage('')}
                  aria-label="Close"
                ></button>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="row g-4">
          {/* Analysis Form */}
          <div className="col-lg-5">
            <AnalysisForm
              onSubmit={handleFormSubmit}
              onAreaSelect={handleAreaSelect}
              loading={loading}
              error={error}
              initialData={formInitialData}
              initialDateRangeType={initialDateRangeType}
            />
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
                  geometry={geometryForMap}
                />
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
              {/* Debug logging before passing to dashboard */}
              {(() => {
                console.log('=== Passing to AnalysisDashboard Debug ===');
                console.log('Full backend results:', results);
                console.log('First data item from backend:', results.data?.[0]);
                console.log('Cloud masking applied from backend:', results.data?.[0]?.cloudMaskingApplied);
                console.log('Cloud masking settings from backend:', results.cloud_masking_settings);
                console.log('lastFormData:', lastFormData);
                
                return null;
              })()}
              
              {/* Create unified analysis data object with consistent source of truth */}
              {(() => {
                // Use original form data as primary source of truth for user inputs
                const unifiedAnalysisData = {
                  // Backend-generated data (analysis results)
                  timeSeriesData: transformTimeSeriesData(results.time_series_data || [], results.analysis_type || 'ndvi'),
                  statistics: transformStatistics(results.statistics, results.analysis_type || 'ndvi'),
                  tableData: transformDataForTable(results.data || [], results.analysis_type || 'ndvi'),
                  geometry: results.geometry || geometryForMap,
                  
                  // Original user inputs (consistent source of truth)
                  analysisType: lastFormData?.analysisType || results.analysis_type?.toLowerCase() || 'ndvi',
                  satellite: lastFormData?.satellite || results.satellite || 'landsat',
                  startDate: lastFormData?.startDate || results.start_date || '2020-01-01',
                  endDate: lastFormData?.endDate || results.end_date || '2023-12-31',
                  cloudCover: lastFormData?.cloudCover || results.cloud_cover || 20,
                  
                  // Cloud masking settings (prefer backend processed values, fallback to user input)
                  enableCloudMasking: results.cloud_masking_settings?.enabled ?? 
                                    results.data?.[0]?.cloudMaskingApplied ?? 
                                    lastFormData?.enableCloudMasking ?? false,
                  maskingStrictness: results.cloud_masking_settings?.strict ? 'true' : 
                                   (lastFormData?.maskingStrictness || 'false'),
                  
                  // Additional metadata
                  cloud_masking_settings: results.cloud_masking_settings
                };
                
                console.log('=== Unified Analysis Data ===');
                console.log('Using form data for:', ['analysisType', 'satellite', 'startDate', 'endDate', 'cloudCover']);
                console.log('Using backend data for:', ['timeSeriesData', 'statistics', 'tableData', 'geometry', 'enableCloudMasking']);
                console.log('Final unified data:', unifiedAnalysisData);
                
                return (
                  <AnalysisDashboard 
                    analysisData={unifiedAnalysisData}
                    onDataUpdate={(data) => console.log('Dashboard data updated:', data)}
                  />
                );
              })()}
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
