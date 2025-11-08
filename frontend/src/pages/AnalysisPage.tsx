import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { InteractiveMap } from '../components/map/InteractiveMap';
import AnalysisDashboard from '../components/analysis/AnalysisDashboard';
import { AnalysisForm } from '../components/analysis/AnalysisForm';
import authService from '../services/authService';
import '../styles/AnalysisPage.css';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

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
  const [projectName, setProjectName] = useState<string | null>(null);
  const [projectAnalyses, setProjectAnalyses] = useState<any[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [formInitialData, setFormInitialData] = useState<any>({});
  const [loadedAnalysisMessage, setLoadedAnalysisMessage] = useState<string>('');
  const [initialDateRangeType, setInitialDateRangeType] = useState<string>('years');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [mapDrawnCoordinates, setMapDrawnCoordinates] = useState<string>('');
  const [showAllAnalyses, setShowAllAnalyses] = useState<boolean>(false);

  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  const [analysisToDelete, setAnalysisToDelete] = useState<string | null>(null);

  // Function to update URL with project name
  const updateURLWithProjectName = useCallback((projectName: string) => {
    const currentSearchParams = new URLSearchParams(window.location.search);
    currentSearchParams.set('project', projectName);
    window.history.replaceState({}, '', `${window.location.pathname}?${currentSearchParams.toString()}`);
  }, []);

  // Delete analysis function
  const deleteAnalysis = async (analysisId: number, analysisName: string) => {
    // Remove the window.confirm - now handled by ConfirmDialog
    try {
      const token = authService.getAccessToken();
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
      const response = await fetch(`${apiUrl}/analysis/delete/${analysisId}/`, {
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

        return '';
    }
  };

  // Load project by name to get the ID
  const loadProjectByName = useCallback(async (projectName: string) => {
    try {
      const api = authService.getAuthenticatedAPI();
      const response = await api.get(`/projects/by-name/${encodeURIComponent(projectName)}/`);
      
      if (response.data.success && response.data.project) {
        const project = response.data.project;
        setProjectId(project.id.toString());
        setProjectName(project.name);
        updateURLWithProjectName(project.name);
        loadProjectAnalyses(project.id.toString());
      } else {
        setError(`Project "${projectName}" not found`);
      }
    } catch (error: any) {
      // If the endpoint doesn't exist (404), fall back to using project name as ID
      if (error.response?.status === 404) {
        setProjectId(projectName);
        setProjectName(projectName);
        loadProjectAnalyses(projectName);
      } else {
        setError(`Failed to load project "${projectName}": ${error.response?.data?.error || error.message}`);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load analyses for the current project
  const loadProjectAnalyses = useCallback(async (projectId: string) => {
    try {
      const api = authService.getAuthenticatedAPI();
      const response = await api.get(`/projects/${projectId}/analyses/`);
      
      if (response.data.success) {
        setProjectAnalyses(response.data.analyses);
        
        if (response.data.analyses.length > 0) {
          const mostRecent = response.data.analyses[0];
          
          if (!projectName && mostRecent.project_name) {
            setProjectName(mostRecent.project_name);
            
            const currentProjectParam = new URLSearchParams(window.location.search).get('project');
            if (currentProjectParam && !isNaN(Number(currentProjectParam))) {
              updateURLWithProjectName(mostRecent.project_name);
            }
          }
          
          setSelectedAnalysis(mostRecent);
          if (mostRecent.results) {
            setResults(mostRecent.results);
            setShowResults(true);
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading project analyses:', error);
    }
  }, [projectName, updateURLWithProjectName]);

  // Load project details by ID to get the name
  const loadProjectDetails = useCallback(async (projectId: string) => {
    try {
      const api = authService.getAuthenticatedAPI();
      const response = await api.get(`/projects/${projectId}/`);
      
      if (response.data) {
        const project = response.data;
        setProjectName(project.name);
        updateURLWithProjectName(project.name);
        return project;
      }
    } catch (error: any) {
      console.error('Error loading project details:', error);
    }
    return null;
  }, [updateURLWithProjectName]);

  // Get project ID from URL parameters
  useEffect(() => {
    const project = searchParams.get('project');
    
    if (project) {
      const isProjectName = isNaN(Number(project));
      
      if (isProjectName) {
        loadProjectByName(project);
      } else {
        setProjectId(project);
        loadProjectDetails(project);
        loadProjectAnalyses(project);
      }
    }
  }, [searchParams, loadProjectByName, loadProjectAnalyses, loadProjectDetails]);

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

    setLoading(true);
    setError('');
    setLoadedAnalysisMessage('');
    setInitialDateRangeType('years');

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

        // Add polarization and orbit direction for SAR analyses
        if (formData.analysisType === 'sar' || formData.analysisType === 'comprehensive') {
          requestBody.polarization = formData.polarization;
          requestBody.orbit_direction = formData.orbitDirection;
        }

        requestData = JSON.stringify(requestBody);
        
        contentType = 'application/json';
      }

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
      
      if (result.success) {
        if (result.is_duplicate) {
          setLoadedAnalysisMessage(`${result.duplicate_message || 'Loaded existing analysis with same parameters'}`);
          
          setTimeout(() => {
            setLoadedAnalysisMessage('');
          }, 7000);
        }
        
        setResults(result);
        setShowResults(true);
        setError('');
        
        if (projectId) {
          loadProjectAnalyses(projectId);
        }
      } else {
        setError(result.message || 'Analysis failed');
      }
      
    } catch (error: any) {
      console.error('Analysis error:', error);
      
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

  // Confirmation dialog handlers
  const handleConfirmDelete = async () => {
    if (analysisToDelete) {
      const analysisId = parseInt(analysisToDelete);
      const analysis = projectAnalyses.find(a => a.id === analysisId);
      const analysisName = analysis 
        ? `${analysis.analysis_type.toUpperCase()} (${new Date(analysis.created_at).toLocaleDateString()})`
        : 'Analysis';
      
      await deleteAnalysis(analysisId, analysisName);
    }
    setShowConfirmDialog(false);
    setAnalysisToDelete(null);
  };

  const handleCancelDelete = () => {
    setShowConfirmDialog(false);
    setAnalysisToDelete(null);
  };

  // Helper functions for data transformation
  const transformTimeSeriesData = (data: any[], analysisType: string) => {
    if (!Array.isArray(data)) {
      return [];
    }
    
    const transformed = data.map((item: any) => {
      const date = new Date(item.date || item.time || '2020-01-01');
      const result: any = {
        date: date.toISOString().split('T')[0],
        time: date.getTime(),
        year: date.getFullYear()
      };
      
      switch (analysisType.toLowerCase()) {
        case 'ndvi':
          result.ndvi = parseFloat(item.ndvi || item.mean_ndvi || item.value || 0);
          break;
        case 'lst':
          result.lst = parseFloat(item.lst || item.mean_lst || item.temperature || item.value || 0);
          break;
        case 'sar':
          result.backscatter = parseFloat(item.backscatter || item.backscatter_vv || item.vv_backscatter || item.mean_backscatter || item.value || 0);
          // Preserve both polarization values
          result.backscatter_vv = parseFloat(item.backscatter_vv || item.vv_backscatter || 0);
          result.backscatter_vh = parseFloat(item.backscatter_vh || item.vh_backscatter || 0);
          result.vv_backscatter = parseFloat(item.vv_backscatter || item.backscatter_vv || 0);
          result.vh_backscatter = parseFloat(item.vh_backscatter || item.backscatter_vh || 0);
          result.count = parseInt(item.count || item.acquisitions_count || 1);
          break;
        default:
          result.value = parseFloat(item.value || item.ndvi || item.lst || item.backscatter || 0);
      }
      
      return result;
    });

    // Group by year and calculate mean values
    const groupedByYear = transformed.reduce((acc: any, item: any) => {
      const year = item.year;
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(item);
      return acc;
    }, {});

    // Calculate means for each year
    const yearlyMeans = Object.keys(groupedByYear).map(year => {
      const yearData = groupedByYear[year];
      const count = yearData.reduce((sum: number, item: any) => sum + (item.count || 1), 0);
      
      const result: any = {
        date: `${year}-01-01`,
        time: new Date(`${year}-01-01`).getTime(),
        year: parseInt(year),
        count: count
      };

      switch (analysisType.toLowerCase()) {
        case 'ndvi':
          result.ndvi = yearData.reduce((sum: number, item: any) => sum + item.ndvi, 0) / yearData.length;
          break;
        case 'lst':
          result.lst = yearData.reduce((sum: number, item: any) => sum + item.lst, 0) / yearData.length;
          break;
        case 'sar':
          result.backscatter = yearData.reduce((sum: number, item: any) => sum + item.backscatter, 0) / yearData.length;
          result.backscatter_vv = yearData.reduce((sum: number, item: any) => sum + (item.backscatter_vv || 0), 0) / yearData.length;
          result.backscatter_vh = yearData.reduce((sum: number, item: any) => sum + (item.backscatter_vh || 0), 0) / yearData.length;
          result.vv_backscatter = yearData.reduce((sum: number, item: any) => sum + (item.vv_backscatter || 0), 0) / yearData.length;
          result.vh_backscatter = yearData.reduce((sum: number, item: any) => sum + (item.vh_backscatter || 0), 0) / yearData.length;
          break;
        default:
          result.value = yearData.reduce((sum: number, item: any) => sum + (item.value || 0), 0) / yearData.length;
      }

      return result;
    });

    // Sort by year
    return yearlyMeans.sort((a, b) => a.year - b.year);
  };

  const transformStatistics = (stats: any, analysisType: string) => {
    if (!stats) return {};
    
    let transformed: any = {
      analysisType: analysisType,
      area_km2: parseFloat(stats.area_km2 || 0),
      pixel_count: parseInt(stats.pixel_count || 0),
      date_range: stats.date_range || '',
      total_observations: parseInt(stats.total_individual_observations || stats.annual_observations || 0),
      count: parseInt(stats.total_individual_observations || stats.annual_observations || stats.count || stats.pixel_count || stats.observations || 0)
    };
    
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
        transformed.mean = parseFloat(stats.mean_backscatter || stats.mean_vv || stats.mean || 0);
        transformed.min = parseFloat(stats.min_backscatter || stats.min_vv || stats.min || 0);
        transformed.max = parseFloat(stats.max_backscatter || stats.max_vv || stats.max || 0);
        transformed.std = parseFloat(stats.std_backscatter || stats.std_vv || stats.std || stats.stdDev || 0);
        // Preserve polarization-specific values for both VV and VH
        transformed.mean_vv = parseFloat(stats.mean_vv || 0);
        transformed.min_vv = parseFloat(stats.min_vv || 0);
        transformed.max_vv = parseFloat(stats.max_vv || 0);
        transformed.std_vv = parseFloat(stats.std_vv || 0);
        transformed.mean_vh = parseFloat(stats.mean_vh || 0);
        transformed.min_vh = parseFloat(stats.min_vh || 0);
        transformed.max_vh = parseFloat(stats.max_vh || 0);
        transformed.std_vh = parseFloat(stats.std_vh || 0);
        // Preserve selected polarization info
        transformed.selected_polarization = stats.selected_polarization;
        break;
      default:
        transformed.mean = parseFloat(stats.mean || 0);
        transformed.min = parseFloat(stats.min || 0);
        transformed.max = parseFloat(stats.max || 0);
        transformed.std = parseFloat(stats.std || stats.stdDev || 0);
    }
    
    return transformed;
  };

  const transformDataForTable = (data: any[], analysisType: string) => {
    if (!Array.isArray(data)) return [];
    
    const transformed = data.map((item: any, index: number) => {
      const row: any = {
        id: index + 1,
        date: item.date || item.time || 'Unknown',
        imageId: item.image_id || item.imageId || `img_${index + 1}`,
        ndviValue: undefined,
        lstValue: undefined,
        backscatterValue: undefined,
        originalCloudCover: parseFloat(item.cloud_cover || item.originalCloudCover || 0),
        adjustedCloudCover: parseFloat(item.adjusted_cloud_cover || item.adjustedCloudCover || item.cloud_cover || 0),
        cloudMaskingApplied: Boolean(item.cloud_masking_applied || item.cloudMaskingApplied || false),
        lat: parseFloat(item.lat || 0),
        lon: parseFloat(item.lon || 0),
        satellite: item.satellite || '',
        backscatterVV: parseFloat(item.backscatter_vv || item.vv_backscatter || item.backscatterVV || 0),
        backscatterVH: parseFloat(item.backscatter_vh || item.vh_backscatter || item.backscatterVH || 0),
        vvVhRatio: parseFloat(item.vv_vh_ratio || item.vvVhRatio || 0),
        orbitDirection: item.orbit_direction || item.orbitDirection || 'ASCENDING'
      };
      
      switch (analysisType.toLowerCase()) {
        case 'ndvi':
          row.ndviValue = parseFloat(item.ndvi || item.value || 0);
          break;
        case 'lst':
          row.lstValue = parseFloat(item.lst || item.temperature || item.value || 0);
          break;
        case 'sar':
        case 'backscatter':
          row.backscatterValue = parseFloat(item.backscatter || item.backscatter_vv || item.vv_backscatter || item.value || 0);
          break;
        default:
          row.ndviValue = parseFloat(item.value || item.ndvi || item.lst || item.backscatter || 0);
      }
      
      return row;
    });
    
    return transformed;
  };

  return (
    <div>
      {/* Professional Header Section */}
      <div className="aheader-section" style={{
        padding: '2rem 0',
        marginBottom: '1rem'
      }}>
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="col-12">
              <div className="d-flex align-items-center mb-3 flex-column flex-md-row text-center text-md-start">
                <div className="rounded-3 p-3 me-md-4 mb-3 mb-md-0 d-flex align-items-center justify-content-center" style={{
                  background: 'linear-gradient(135deg, #062c14 0%, #065d26 50%, #065d26 100%)',
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
                  Landsat & Sentinel
                </span>
                <span className="badge bg-light text-dark">
                  NDVI Analysis
                </span>
                <span className="badge bg-light text-dark">
                  Temperature Monitoring
                </span>
                <span className="badge bg-light text-dark">
                  Backscatter Analysis
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Saved Analyses Panel */}
      {projectId && projectAnalyses.length > 0 && (
        <div className="container-fluid mb-4">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-light d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <i className="fas fa-history me-2"></i>
                Saved Analyses {projectName ? `for "${projectName}"` : 'for this Project'}
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
                  setInitialDateRangeType('years');
                }}
                title="Clear loaded analysis and start fresh"
              >
                <i className="fas fa-times me-1"></i>New Analysis
              </button>
            </div>
            <div className="card-body">
              <div className="row">
                {(showAllAnalyses ? projectAnalyses : projectAnalyses.slice(0, 6)).map((analysis) => (
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
                                setResults(analysis.results);
                                setShowResults(true);
                                
                                const formData = {
                                  analysisType: analysis.analysis_type,
                                  satellite: analysis.satellite,
                                  startDate: analysis.start_date,
                                  endDate: analysis.end_date,
                                  cloudCover: analysis.cloud_cover || 20,
                                  cloudCoverValue: analysis.cloud_cover || 20,
                                  coordinates: convertGeoJSONToWKT(analysis.geometry_data),
                                  enableCloudMasking: analysis.use_cloud_masking !== undefined ? analysis.use_cloud_masking : true,
                                  maskingStrictness: analysis.strict_masking ? 'true' : 'false',
                                  polarization: analysis.polarization || 'VV',
                                  startYear: new Date(analysis.start_date).getFullYear(),
                                  endYear: new Date(analysis.end_date).getFullYear()
                                };
                                
                                setLastFormData(formData);
                                setFormInitialData(formData);
                                setInitialDateRangeType('dates');
                                setLoadedAnalysisMessage(`Loaded ${analysis.analysis_type.toUpperCase()} analysis from ${new Date(analysis.created_at).toLocaleDateString()}`);
                                
                                if (analysis.geometry_data) {
                                  let mapGeometry = analysis.geometry_data;
                                  
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
                              setAnalysisToDelete(analysis.id.toString());
                              setShowConfirmDialog(true);
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
              
              {/* See More / See Less Button */}
              {projectAnalyses.length > 6 && (
                <div className="text-center mt-3">
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => setShowAllAnalyses(!showAllAnalyses)}
                  >
                    <i className={`fas fa-chevron-${showAllAnalyses ? 'up' : 'down'} me-2`}></i>
                    {showAllAnalyses ? 'Show Less' : `See More (${projectAnalyses.length - 6} more)`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="container-fluid">
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
              borderRadius: '1rem',
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
                </div>
              </div>
              <div className="card-body p-0" style={{ height: '820px', position: 'relative' }}>
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
              <div className="card-body text-center py-4 mt-3">
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
                  <span className="badge bg-success bg-opacity-10 text-success px-3 py-2 large">
                    <i className="fas fa-chart-area me-1"></i>Spectral
                  </span>
                  <span className="badge bg-warning bg-opacity-10 text-warning px-3 py-2 large">
                    <i className="fas fa-exchange-alt me-1"></i>Change Detection
                  </span>
                  <span className="badge bg-info bg-opacity-10 text-primary px-3 py-2 large">
                    <i className="fas fa-layer-group me-1"></i>Multi-temporal
                  </span>
                </div>
                <button
                  className="btn btn-primary px-4 py-2.5 mt-2"
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
              {(() => {
                const unifiedAnalysisData = {
                  timeSeriesData: transformTimeSeriesData(results.time_series_data || [], results.analysis_type || 'ndvi'),
                  statistics: transformStatistics(results.statistics, results.analysis_type || 'ndvi'),
                  tableData: transformDataForTable(results.data || [], results.analysis_type || 'ndvi'),
                  geometry: results.geometry || geometryForMap,
                  analysisType: lastFormData?.analysisType || results.analysis_type?.toLowerCase() || 'ndvi',
                  satellite: lastFormData?.satellite || results.satellite || 'landsat',
                  startDate: lastFormData?.startDate || results.start_date || '2020-01-01',
                  endDate: lastFormData?.endDate || results.end_date || '2023-12-31',
                  cloudCover: lastFormData?.cloudCover || results.cloud_cover || 20,
                  enableCloudMasking: results.cloud_masking_settings?.enabled ?? 
                                    results.data?.[0]?.cloudMaskingApplied ?? 
                                    lastFormData?.enableCloudMasking ?? false,
                  maskingStrictness: results.cloud_masking_settings?.strict ? 'true' : 
                                   (lastFormData?.maskingStrictness || 'false'),
                  cloud_masking_settings: results.cloud_masking_settings,
                  polarization: results.statistics?.selected_polarization || results.polarization || lastFormData?.polarization || 'VV',
                  orbitDirection: results.orbit_direction || lastFormData?.orbitDirection || 'DESCENDING'
                };
                
                return (
                  <AnalysisDashboard 
                    analysisData={unifiedAnalysisData}
                    onDataUpdate={(data) => {
                      // Handle data updates if needed
                    }}
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

      {/* Confirmation Dialog */}
      <ConfirmDialog
        show={showConfirmDialog}
        title="Confirm Delete"
        message={(() => {
          const analysis = projectAnalyses.find(a => a.id === parseInt(analysisToDelete || '0'));
          if (analysis) {
            return `Are you sure you want to delete the analysis "${analysis.analysis_type.toUpperCase()} (${new Date(analysis.created_at).toLocaleDateString()})"? This action cannot be undone.`;
          }
          return "Are you sure you want to delete this analysis? This action cannot be undone.";
        })()}
        confirmText="OK"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        variant="success"
      />
    </div>
  );
};

export default AnalysisPage;
