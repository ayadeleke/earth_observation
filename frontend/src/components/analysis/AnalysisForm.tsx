import React, { useState, useEffect } from 'react';
import { ShapefileUpload } from '../upload/ShapefileUpload';

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

interface AnalysisFormProps {
  onSubmit: (formData: FormData, dateRangeType: string) => void;
  onAreaSelect: (coordinates: any, wkt: string, source: string) => void;
  loading?: boolean;
  error?: string;
  initialData?: Partial<FormData>;
}

export const AnalysisForm: React.FC<AnalysisFormProps> = ({
  onSubmit,
  onAreaSelect,
  loading = false,
  error = '',
  initialData = {}
}) => {
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
    polarization: 'VV',
    ...initialData
  });

  const [activeTab, setActiveTab] = useState<string>('coordinates');
  const [dateRangeType, setDateRangeType] = useState<string>('years');
  const [eeStatus, setEeStatus] = useState<any>(null);

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
    
    setFormData((prev: FormData) => {
      const newData = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };
      
      // Auto-select correct satellite for SAR analysis
      if (name === 'analysisType' && value === 'sar') {
        newData.satellite = 'sentinel1';
      }
      // Auto-select landsat for LST analysis (only supported by Landsat)
      else if (name === 'analysisType' && value === 'lst') {
        newData.satellite = 'landsat';
      }
      
      return newData;
    });
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

  // Handle area selection from map or shapefile
  const handleAreaSelect = (coordinates: any, wkt: string = '', source: string = 'drawing') => {
    // Update coordinates field
    setFormData((prev: FormData) => ({
      ...prev,
      coordinates: wkt
    }));
    
    // Call parent handler
    onAreaSelect(coordinates, wkt, source);
  };

  // Handle form submission
  const handleSubmit = (e: any) => {
    e.preventDefault();
    onSubmit(formData, dateRangeType);
  };

  // Get satellite description
  const getSatelliteDescription = () => {
    switch (formData.satellite) {
      case 'landsat':
        return 'NDVI and LST analysis using Landsat thermal and optical bands.';
      case 'sentinel2':
        return 'High-resolution NDVI analysis using Sentinel-2 optical imagery.';
      case 'sentinel1':
        return 'SAR backscatter analysis using Sentinel-1 C-band radar data.';
      default:
        return 'NDVI analysis using Landsat thermal and optical bands.';
    }
  };

  return (
    <div className="card border-0 shadow-lg" style={{
      borderRadius: '1.5rem',
      background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)'
    }}>
      <div className="card-header bg-transparent border-0 pb-0" style={{ padding: '2rem 2rem 0 2rem' }}>
        <div className="d-flex align-items-center mb-3">
          <div className="bg-primary bg-opacity-10 rounded-3 p-2 me-3">
            <i className="fas fa-cogs text-primary" style={{ fontSize: '1.5rem' }}></i>
          </div>
          <h3 className="mb-0 fw-bold text-dark">Analysis Parameters</h3>
        </div>
        <p className="text-muted mb-0">Configure your satellite imagery analysis settings</p>
      </div>
      <div className="card-body" style={{ padding: '1.5rem 2rem 2rem 2rem' }}>
        
        <form onSubmit={handleSubmit} encType="multipart/form-data">
          {/* Area of Interest Section */}
          <div className="mb-4">
            <div className="d-flex align-items-center mb-3">
              <div className="bg-info bg-opacity-10 rounded-2 p-2 me-3">
                <i className="fas fa-map-marker-alt text-info"></i>
              </div>
              <div>
                <label className="form-label mb-0 fw-semibold text-dark">Area of Interest</label>
                <p className="text-muted small mb-0">Define the geographical area for analysis</p>
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
                    transition: 'all 0.3s ease'
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
                  <ShapefileUpload 
                    onFileUpload={(result: any) => {
                      console.log('Shapefile uploaded:', result);
                      if (result.bounds) {
                        const coords = result.bounds;
                        handleAreaSelect(coords, result.wkt || '', 'shapefile');
                      }
                    }}
                    onCoordinatesExtracted={(bounds: any) => {
                      console.log('Coordinates extracted from shapefile:', bounds);
                      handleAreaSelect(bounds, '', 'shapefile');
                    }}
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* Date Selection Options */}
          <div className="mb-4">
            <div className="d-flex align-items-center mb-3">
              <div className="bg-warning bg-opacity-10 rounded-2 p-2 me-3">
                <i className="fas fa-calendar-range text-warning"></i>
              </div>
              <div>
                <label className="form-label mb-0 fw-semibold text-dark">Date Range Selection</label>
                <p className="text-muted small mb-0">Choose your temporal analysis period</p>
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
                <label className="form-check-label">
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
                <label className="form-check-label">
                  <i className="fas fa-calendar-day me-1"></i>Exact Dates
                </label>
              </div>
            </div>
            
            {/* Year Range Selection (Default) */}
            {dateRangeType === 'years' && (
              <div>
                <div className="row">
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label htmlFor="startYear" className="form-label">Start Year</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        name="startYear"
                        value={formData.startYear}
                        onChange={handleInputChange}
                        min="1988" 
                        max="2025"
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label htmlFor="endYear" className="form-label">End Year</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        name="endYear"
                        value={formData.endYear}
                        onChange={handleInputChange}
                        min="1988" 
                        max="2025"
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
              className="form-select form-select-lg" 
              name="analysisType"
              value={formData.analysisType}
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
              className="form-select form-select-lg" 
              name="satellite"
              value={formData.satellite}
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
              <option value="landsat">Landsat (30m resolution)</option>
              <option value="sentinel2">Sentinel-2 (10m resolution)</option>
              <option value="sentinel1">Sentinel-1 SAR (10m resolution)</option>
            </select>
            <div className="form-text">
              <i className="fas fa-info-circle me-1"></i>
              <span>{getSatelliteDescription()}</span>
            </div>
          </div>

          {/* Cloud Cover Filter (for Optical satellites only) */}
          {formData.satellite !== 'sentinel1' && 
          <>
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
          </>
          }

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
              className="btn btn-lg shadow-sm" 
              disabled={loading}
              style={{
                background: loading ? '#6c757d' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '1rem',
                padding: '1rem 2rem',
                color: 'white',
                fontWeight: '600',
                fontSize: '1.1rem',
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
                  <div className="spinner-border spinner-border-sm me-3" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  Processing Analysis...
                </>
              ) : (
                <>
                  <i className="fas fa-rocket me-3"></i>
                  Run Analysis
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
