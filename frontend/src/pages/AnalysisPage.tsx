import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InteractiveMap } from '../components/map/InteractiveMap';
import AnalysisDashboard from '../components/analysis/AnalysisDashboard';
import { AnalysisForm } from '../components/analysis/AnalysisForm';
import '../styles/AnalysisPage.css';

const AnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [uploadedShapefile, setUploadedShapefile] = useState<File | null>(null);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [clearMapLayers] = useState<boolean>(false);
  const [clearShapefileLayers] = useState<boolean>(false);
  const [geometryForMap, setGeometryForMap] = useState<any>(null);
  const [lastFormData, setLastFormData] = useState<any>(null);

  // Handle area selection from map
  const handleAreaSelect = (coordinates: any, wkt: string = '', source: string = 'drawing') => {
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
        requestData.append('projectId', 'ee-ayotundenew');
        requestData.append('dateRangeType', dateRangeType);
        
        contentType = 'multipart/form-data';
      } else {
        // Use JSON for regular requests - match Flask parameter structure
        const requestBody: any = {
          coordinates: formData.coordinates,
          analysis_type: formData.analysisType,
          satellite: formData.satellite === 'sentinel1' ? 'sentinel' : formData.satellite, // Backend expects 'sentinel' for SAR
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

        // Add cloud cover and masking parameters for all optical satellites (match Flask field names)
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

  // Helper functions for data transformation
  const transformTimeSeriesData = (data: any[], analysisType: string) => {
    if (!Array.isArray(data)) return [];
    
    console.log('=== transformTimeSeriesData Debug ===');
    console.log('Input data:', data.slice(0, 2));
    console.log('Analysis type:', analysisType);
    
    const transformed = data.map((item: any) => {
      const date = new Date(item.date || item.time || '2020-01-01');
      const result: any = {
        date: date.toISOString().split('T')[0],
        time: date.getTime()
      };
      
      // Add analysis-specific data
      switch (analysisType.toLowerCase()) {
        case 'ndvi':
          result.ndvi = parseFloat(item.ndvi || item.value || 0);
          break;
        case 'lst':
          result.lst = parseFloat(item.lst || item.temperature || item.value || 0);
          break;
        case 'sar':
          result.backscatter = parseFloat(item.backscatter || item.value || 0);
          break;
        default:
          result.value = parseFloat(item.value || 0);
      }
      
      return result;
    });
    
    console.log('Transformed data:', transformed.slice(0, 2));
    return transformed;
  };

  const transformStatistics = (stats: any, analysisType: string) => {
    if (!stats) return {};
    
    return {
      mean: parseFloat(stats.mean || 0),
      min: parseFloat(stats.min || 0),
      max: parseFloat(stats.max || 0),
      std: parseFloat(stats.std || stats.stdDev || 0),
      count: parseInt(stats.count || stats.pixels || 0),
      analysisType: analysisType
    };
  };

  const transformDataForTable = (data: any[], analysisType: string) => {
    if (!Array.isArray(data)) return [];
    
    return data.map((item: any, index: number) => ({
      id: index + 1,
      date: item.date || item.time || 'Unknown',
      value: parseFloat(item.value || item.ndvi || item.lst || item.backscatter || 0),
      analysisType: analysisType
    }));
  };

  // Get CSRF token for Django
  const getCsrfToken = () => {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrftoken') {
        return value;
      }
    }
    return '';
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
            <AnalysisForm
              onSubmit={handleFormSubmit}
              onAreaSelect={handleAreaSelect}
              loading={loading}
              error={error}
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
                >
                  {/* Analysis layers will be managed by AnalysisForm component */}
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
              {/* Debug logging before passing to dashboard */}
              {(() => {
                console.log('=== Passing to AnalysisDashboard Debug ===');
                console.log('Full backend results:', results);
                console.log('First data item from backend:', results.data?.[0]);
                console.log('Cloud masking applied from backend:', results.data?.[0]?.cloudMaskingApplied);
                console.log('Cloud masking settings from backend:', results.cloud_masking_settings);
                console.log('lastFormData:', lastFormData);
                console.log('lastFormData?.enableCloudMasking:', lastFormData?.enableCloudMasking);
                console.log('lastFormData?.maskingStrictness:', lastFormData?.maskingStrictness);
                
                // Use backend cloud masking settings if available, fallback to form data
                const enableCloudMasking = results.cloud_masking_settings?.enabled ?? 
                                         results.data?.[0]?.cloudMaskingApplied ?? 
                                         lastFormData?.enableCloudMasking ?? false;
                const maskingStrictness = results.cloud_masking_settings?.strict ? 'true' : 
                                        (lastFormData?.maskingStrictness || 'false');
                
                console.log('Final enableCloudMasking value:', enableCloudMasking);
                console.log('Final maskingStrictness value:', maskingStrictness);
                return null;
              })()}
              <AnalysisDashboard 
                analysisData={{
                  timeSeriesData: transformTimeSeriesData(results.time_series_data || [], results.analysis_type || 'ndvi'),
                  statistics: transformStatistics(results.statistics, results.analysis_type || 'ndvi'),
                  tableData: transformDataForTable(results.data || [], results.analysis_type || 'ndvi'),
                  geometry: results.geometry || geometryForMap,
                  analysisType: results.analysis_type?.toLowerCase() || 'ndvi',
                  satellite: results.satellite || 'landsat',
                  startDate: results.start_date || '2020-01-01',
                  endDate: results.end_date || '2023-12-31',
                  cloudCover: results.cloud_cover || 30,
                  enableCloudMasking: results.cloud_masking_settings?.enabled ?? 
                                    results.data?.[0]?.cloudMaskingApplied ?? 
                                    lastFormData?.enableCloudMasking ?? false,
                  maskingStrictness: results.cloud_masking_settings?.strict ? 'true' : 
                                   (lastFormData?.maskingStrictness || 'false')
                }}
                onDataUpdate={(data) => console.log('Dashboard data updated:', data)}
              />
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
