import React, { useEffect, useState } from 'react';
import '../styles/ImageSelector.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

// Leaflet imports
import L from 'leaflet';
import 'leaflet-draw';

// Fix Leaflet default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Types
interface ImageMetadata {
  id: string;
  index: number;
  date: string;
  timestamp: number;
  cloud_cover: number;
  satellite?: string;
  sensor?: string;
  orbit_direction?: string;
  polarization?: string;
  sun_elevation?: number;
}
interface FormData {
  satellite: string;
  analysisType: string;
  startDate: string;
  endDate: string;
  cloudCover: number;
  coordinates: string;
  inputMethod: 'map' | 'text' | 'shapefile';
  cloudMaskingLevel: string;
}

const ImageSelector: React.FC = () => {
  // State management
  const [availableImages, setAvailableImages] = useState<ImageMetadata[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [recommendedIndices, setRecommendedIndices] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [shapefile, setShapefile] = useState<File | null>(null);
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [showAllImages, setShowAllImages] = useState<boolean>(false);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    satellite: '',
    analysisType: '',
    startDate: '',
    endDate: '',
    cloudCover: 20,
    coordinates: 'POLYGON((-74.0059 40.7128, -74.0059 40.7628, -73.9559 40.7628, -73.9559 40.7128, -74.0059 40.7128))',
    inputMethod: 'map',
    cloudMaskingLevel: 'disabled'
  });

  // Initialize component
  useEffect(() => {
    setDefaultDates();
    
    // Add delay to ensure DOM is ready and has proper dimensions
    const timer = setTimeout(() => {
      // Double-check that the container exists and has dimensions
      const mapContainer = document.getElementById('map');
      if (mapContainer && mapContainer.offsetWidth > 0 && mapContainer.offsetHeight > 0) {
        initializeMap();
      } else {

        setTimeout(() => {
          initializeMap();
        }, 500);
      }
    }, 200);
    
    // Cleanup function to prevent memory leaks
    return () => {
      clearTimeout(timer);
      // Proper cleanup for map instance
      if (mapInstance) {
        try {
          mapInstance.off(); // Remove all event listeners
          mapInstance.remove(); // Remove the map
          setMapInstance(null); // Clear the reference
        } catch (error) {

        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array for mount/unmount only

  // Additional cleanup effect for component unmount
  useEffect(() => {
    return () => {
      // Final cleanup when component unmounts
      try {
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
          // Clear any remaining Leaflet references
          (mapContainer as any)._leaflet_id = undefined;
          mapContainer.innerHTML = '';
        }
      } catch (error) {

      }
    };
  }, []);

  // Set default dates (2 years ago to today)
  const setDefaultDates = () => {
    const today = new Date();
    const twoYearsAgo = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate());
    
    setFormData(prev => ({
      ...prev,
      endDate: today.toISOString().split('T')[0],
      startDate: twoYearsAgo.toISOString().split('T')[0]
    }));
  };

  // Initialize Leaflet map
  const initializeMap = () => {
    try {
      // Check if map is already initialized
      const mapContainer = document.getElementById('map');

      if (!mapContainer) {
        console.error('Map container not found!');
        return;
      }
      
      // Ensure container has dimensions before initializing
      if (mapContainer.offsetWidth === 0 || mapContainer.offsetHeight === 0) {

        setTimeout(() => initializeMap(), 200);
        return;
      }
      
      // Clean up any existing map instance first
      if (mapInstance) {

        try {
          mapInstance.off();
          mapInstance.remove();
          setMapInstance(null);
        } catch (error) {

        }
      }
      
      // Prevent double initialization in StrictMode
      if ((mapContainer as any)._leaflet_id) {

        // Force clean the container
        (mapContainer as any)._leaflet_id = undefined;
        mapContainer.innerHTML = '';
      }

      const map = L.map('map', {
        // Add some defensive options
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        dragging: true,
        touchZoom: true,
        preferCanvas: false,
        renderer: L.svg()
      }).setView([40.7128, -74.0060], 10);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      // Force map to resize and redraw with error handling
      setTimeout(() => {
        try {
          if (map && map.getContainer() && map.getContainer().offsetWidth > 0) {
            map.invalidateSize(true);
          }
        } catch (error) {

        }
      }, 200);

      // Try to get user's current location with error handling
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            try {
              if (map && map.getContainer()) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                map.setView([lat, lng], 12);
                
                L.marker([lat, lng])
                  .addTo(map)
                  .bindPopup('Your current location')
                  .openPopup();
              }
            } catch (error) {

            }
          },
          (error) => {

          }
        );
      }

      const drawnItemsLayer = new L.FeatureGroup();
      map.addLayer(drawnItemsLayer);

      // Add drawing controls with error handling
      try {
        const drawControl = new L.Control.Draw({
          edit: {
            featureGroup: drawnItemsLayer
          },
          draw: {
            polygon: {},
            rectangle: {},
            circle: false,
            marker: false,
            polyline: false,
            circlemarker: false
          }
        });
        map.addControl(drawControl);

        // Handle drawn shapes with error handling
        map.on('draw:created', (e: any) => {
          try {
            const layer = e.layer;
            drawnItemsLayer.clearLayers();
            drawnItemsLayer.addLayer(layer);
            
            // Convert to WKT format
            const coordinates = layer.getLatLngs()[0].map((point: any) => 
              `${point.lng} ${point.lat}`
            ).join(', ');
            const wkt = `POLYGON((${coordinates}, ${layer.getLatLngs()[0][0].lng} ${layer.getLatLngs()[0][0].lat}))`;
            
            setFormData(prev => ({ ...prev, coordinates: wkt }));
          } catch (error) {
            console.error('Error handling drawn shape:', error);
          }
        });
      } catch (error) {
        console.error('Error adding draw controls:', error);
      }

      // Store map reference for cleanup
      setMapInstance(map);

    } catch (error) {
      console.error('Error initializing map:', error);
      setError('Failed to initialize map. Please refresh the page.');
    }
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle satellite selection change
  const handleSatelliteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const satellite = e.target.value;
    let analysisType = formData.analysisType;
    
    // Auto-update analysis type based on satellite
    if (satellite === 'sentinel1') {
      analysisType = 'sar';
    } else if (satellite === 'landsat' && !['ndvi', 'lst'].includes(analysisType)) {
      analysisType = 'ndvi';
    } else if (satellite === 'sentinel2' && analysisType !== 'ndvi') {
      analysisType = 'ndvi';
    }
    
    setFormData(prev => ({
      ...prev,
      satellite,
      analysisType
    }));
  };

  // Handle shapefile upload
  const handleShapefileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.zip') || file.name.endsWith('.shp'))) {
      setShapefile(file);
    } else {
      alert('Please upload a .zip or .shp file');
      e.target.value = '';
    }
  };

  // Get image metadata from backend
  const getImageMetadata = async () => {
    if (!formData.satellite || !formData.analysisType) {
      alert('Please select satellite and analysis type');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let requestOptions;
      
      if (formData.inputMethod === 'shapefile' && shapefile) {
        // Handle shapefile upload
        const formDataObj = new FormData();
        formDataObj.append('project_id', 'ee-ayotundenew');
        formDataObj.append('satellite', formData.satellite);
        formDataObj.append('analysis_type', formData.analysisType);
        formDataObj.append('start_date', formData.startDate);
        formDataObj.append('end_date', formData.endDate);
        formDataObj.append('cloud_cover', formData.cloudCover.toString());
        formDataObj.append('date_range_type', 'dates');
        formDataObj.append('cloud_masking_level', formData.cloudMaskingLevel);
        formDataObj.append('shapefile', shapefile);
        
        requestOptions = {
          method: 'POST',
          body: formDataObj
        };
      } else {
        // Handle JSON data
        const jsonData = {
          project_id: 'ee-ayotundenew',
          satellite: formData.satellite,
          analysis_type: formData.analysisType,
          start_date: formData.startDate,
          end_date: formData.endDate,
          cloud_cover: formData.cloudCover,
          coordinates: formData.coordinates,
          date_range_type: 'dates',
          cloud_masking_level: formData.cloudMaskingLevel
        };
        
        requestOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(jsonData)
        };
      }

      const response = await fetch('/api/v1/analysis/get_image_metadata/', requestOptions);
      const data = await response.json();

      if (data.success) {
        setAvailableImages(data.images);
        setRecommendedIndices(data.recommended_selections || []);
        setSelectedIndices([]);
        setError(null);
        
        // Show success message
        if (formData.inputMethod === 'shapefile') {
          setSuccessMessage(`Shapefile processed successfully! Coordinates extracted and ${data.images.length} images found.`);
        } else {
          setSuccessMessage(`Found ${data.images.length} images for the specified criteria.`);
        }
      } else {
        setError(data.error || 'Failed to get image metadata');
        setSuccessMessage('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Toggle image selection
  const toggleImageSelection = (index: number) => {
    setSelectedIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        if (prev.length >= 5) {
          alert('Maximum 5 images can be selected at once');
          return prev;
        }
        return [...prev, index];
      }
    });
  };

  // Select recommended images
  const selectRecommended = () => {
    setSelectedIndices([...recommendedIndices]);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedIndices([]);
  };

  // Create custom map
  const createCustomMap = async () => {
    if (selectedIndices.length === 0) {
      alert('Please select at least one image');
      return;
    }

    setLoading(true);

    try {
      let requestOptions;
      
      if (formData.inputMethod === 'shapefile' && shapefile) {
        // Handle shapefile upload with clipping
        const formDataObj = new FormData();
        formDataObj.append('project_id', 'ee-ayotundenew');
        formDataObj.append('satellite', formData.satellite);
        formDataObj.append('analysis_type', formData.analysisType);
        formDataObj.append('start_date', formData.startDate);
        formDataObj.append('end_date', formData.endDate);
        formDataObj.append('cloud_cover', formData.cloudCover.toString());
        formDataObj.append('coordinates', formData.coordinates);
        formDataObj.append('date_range_type', 'dates');
        formDataObj.append('selected_indices', JSON.stringify(selectedIndices));
        formDataObj.append('clip_to_aoi', 'true');
        formDataObj.append('cloud_masking_level', formData.cloudMaskingLevel);
        formDataObj.append('shapefile', shapefile);
        
        requestOptions = {
          method: 'POST',
          body: formDataObj
        };
      } else {
        // Handle JSON data
        const jsonData = {
          project_id: 'ee-ayotundenew',
          satellite: formData.satellite,
          analysis_type: formData.analysisType,
          start_date: formData.startDate,
          end_date: formData.endDate,
          cloud_cover: formData.cloudCover,
          coordinates: formData.coordinates,
          date_range_type: 'dates',
          selected_indices: selectedIndices,
          clip_to_aoi: false,
          cloud_masking_level: formData.cloudMaskingLevel
        };
        
        requestOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(jsonData)
        };
      }

      const response = await fetch('/api/v1/visualization/create_custom_map/', requestOptions);
      const data = await response.json();

      if (data.success) {
        setMapUrl(data.map_url);
      } else {
        setError(data.error || 'Failed to create custom map');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Get analysis type options based on satellite
  const getAnalysisOptions = () => {
    switch (formData.satellite) {
      case 'landsat':
        return [
          { value: 'ndvi', label: 'NDVI (Vegetation Index)' },
          { value: 'lst', label: 'LST (Land Surface Temperature)' }
        ];
      case 'sentinel2':
        return [
          { value: 'ndvi', label: 'NDVI (Vegetation Index)' }
        ];
      case 'sentinel1':
        return [
          { value: 'sar', label: 'Sentinel-1 SAR Backscatter' }
        ];
      default:
        return [];
    }
  };

  return (
    <div className="container-fluid">
      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="text-center">
            <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }} role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <div className="mt-3">
              <h5>Processing your request...</h5>
              <p className="text-muted">This may take a few moments</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Header */}
      <div className="row m-3">
        <div className="col-12">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <a href="/analysis" className="text-decoration-none">
                  Analysis
                </a>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                Advanced Image Analysis
              </li>
            </ol>
          </nav>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h1 className="mb-2">
                <i className="fas fa-microscope me-2"></i>
                Advanced Image Analysis
              </h1>
              <p className="lead mb-0">Select specific satellite images for detailed analysis and comparison.</p>
            </div>
            <div>
              <a href="/analysis" className="btn btn-outline-secondary">
                <i className="fas fa-arrow-left me-2"></i>Back to Analysis
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Configuration */}
      <div className="row">
        <div className="col-lg-6">
          <div className="card">
            <div className="card-header">
              <h5><i className="fas fa-cogs me-2"></i> Analysis Configuration</h5>
            </div>
            <div className="card-body">
              {/* Landsat Mission Coverage Info */}
              {formData.satellite === 'landsat' && (
                <div className="alert alert-success mb-4" style={{fontSize: '0.9em'}}>
                  <h6 className="alert-heading">
                    Landsat Mission Coverage
                  </h6>
                  <div className="row">
                    <div className="col-md-6">
                      <strong>Historical Data:</strong>
                      <ul className="mb-2">
                        <li><strong>Landsat 5:</strong> 1984-2013 (30m optical, 120m thermal)</li>
                        <li><strong>Landsat 7:</strong> 1999-present (30m optical, 60m thermal)</li>
                      </ul>
                    </div>
                    <div className="col-md-6">
                      <strong>Modern Data:</strong>
                      <ul className="mb-2">
                        <li><strong>Landsat 8:</strong> 2013-present (30m optical, 100m thermal)</li>
                        <li><strong>Landsat 9:</strong> 2021-present (30m optical, 100m thermal)</li>
                      </ul>
                    </div>
                  </div>
                  <small><strong>Note:</strong> All missions are included for maximum data availability. Band differences are automatically handled during processing.</small>
                </div>
              )}

              {/* Sentinel-2 Mission Coverage Info */}
              {formData.satellite === 'sentinel2' && (
                <div className="alert alert-success mb-4" style={{fontSize: '0.9em'}}>
                  <h6 className="alert-heading">
                    Sentinel-2 Mission Coverage
                  </h6>
                  <div className="row">
                    <div className="col-md-6">
                      <strong>Constellation:</strong>
                      <ul className="mb-2">
                        <li><strong>Sentinel-2A:</strong> 2015-present (10m optical)</li>
                        <li><strong>Sentinel-2B:</strong> 2017-present (10m optical)</li>
                      </ul>
                    </div>
                    <div className="col-md-6">
                      <strong>Capabilities:</strong>
                      <ul className="mb-2">
                        <li><strong>Revisit Time:</strong> 5 days (combined constellation)</li>
                        <li><strong>Resolution:</strong> 10m (NDVI bands), 20m/60m (other bands)</li>
                      </ul>
                    </div>
                  </div>
                  <small><strong>Note:</strong> Sentinel-2 provides high-resolution NDVI analysis with frequent revisits. No thermal bands available (LST not supported).</small>
                </div>
              )}

              {/* Sentinel-1 Mission Coverage Info */}
              {formData.satellite === 'sentinel1' && (
                <div className="alert alert-success mb-4" style={{fontSize: '0.9em'}}>
                  <h6 className="alert-heading">
                    Sentinel-1 Mission Coverage
                  </h6>
                  <div className="row">
                    <div className="col-md-6">
                      <strong>Constellation:</strong>
                      <ul className="mb-2">
                        <li><strong>Sentinel-1A:</strong> 2015-present (C-band)</li>
                      </ul>
                    </div>
                    <div className="col-md-6">
                      <strong>Capabilities:</strong>
                      <ul className="mb-2">
                        <li><strong>Revisit Time:</strong> 5 days (combined constellation)</li>
                        <li><strong>Resolution:</strong> 10m (NDVI bands), 20m/60m (other bands)</li>
                      </ul>
                    </div>
                  </div>
                  <small><strong>Note:</strong> Sentinel-1 provides high-resolution SAR backscatter analysis with frequent revisits. No thermal bands available (LST not supported).</small>
                </div>
              )}
              <form>
                <div className="row">
                  <div className="col-md-6">
                    <label htmlFor="satellite" className="form-label">Satellite Mission *</label>
                    <select 
                      className="form-select" 
                      name="satellite"
                      value={formData.satellite}
                      onChange={handleSatelliteChange}
                      required
                    >
                      <option value="">Choose satellite...</option>
                      <option value="landsat">Landsat (30m, NDVI + LST)</option>
                      <option value="sentinel2">Sentinel-2 (10m, NDVI only)</option>
                      <option value="sentinel1">Sentinel-1 SAR</option>
                      <option value="modis">MODIS</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label htmlFor="analysisType" className="form-label">Analysis Type *</label>
                    <select 
                      className="form-select" 
                      name="analysisType"
                      value={formData.analysisType}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Choose analysis type...</option>
                      {getAnalysisOptions().map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="row mt-3">
                  <div className="col-md-4">
                    <label htmlFor="startDate" className="form-label">Start Date *</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      required 
                    />
                  </div>
                  <div className="col-md-4">
                    <label htmlFor="endDate" className="form-label">End Date *</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      name="endDate"
                      value={formData.endDate}
                      onChange={handleInputChange}
                      required 
                    />
                  </div>
                  <div className="col-md-4">
                    <label htmlFor="cloudCover" className="form-label">Max Cloud Cover (%)</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      name="cloudCover"
                      value={formData.cloudCover}
                      onChange={handleInputChange}
                      min="0" 
                      max="100" 
                    />
                  </div>
                </div>
                
                {/* Area of Interest Input Method Selection */}
                <div className="mt-4">
                  <label className="form-label">Area of Interest *</label>
                  <div className="btn-group w-100" role="group">
                    <input
                      type="radio" 
                      className="btn-check" 
                      name="inputMethod" 
                      id="mapInput" 
                      value="map"
                      checked={formData.inputMethod === 'map'}
                      onChange={handleInputChange}
                    />
                    <label className="btn btn-outline-success btn-sm" htmlFor="mapInput">
                      <i className="fas fa-mouse-pointer"></i> Draw on Map
                    </label>
                    
                    <input 
                      type="radio" 
                      className="btn-check" 
                      name="inputMethod" 
                      id="textInput" 
                      value="text"
                      checked={formData.inputMethod === 'text'}
                      onChange={handleInputChange}
                    />
                    <label className="btn btn-outline-success btn-sm" htmlFor="textInput">
                      <i className="fas fa-edit"></i> Enter Manually
                    </label>
                    
                    <input 
                      type="radio" 
                      className="btn-check" 
                      name="inputMethod" 
                      id="shapefileInput" 
                      value="shapefile"
                      checked={formData.inputMethod === 'shapefile'}
                      onChange={handleInputChange}
                    />
                    <label className="btn btn-outline-success btn-sm" htmlFor="shapefileInput">
                      <i className="fas fa-upload"></i> Upload Shapefile
                    </label>
                  </div>
                    <div className="form-text">Draw a polygon on the map or enter coordinates manually when using text input mode.</div>
                </div>
                
                {/* Shapefile Upload Section */}
                {formData.inputMethod === 'shapefile' && (
                  <div className="row mt-3">
                    <div className="col-12">
                      <label htmlFor="shapefileUpload" className="form-label">Upload Shapefile *</label>
                      <input 
                        type="file" 
                        className="form-control" 
                        accept=".zip,.shp" 
                        onChange={handleShapefileUpload}
                      />
                      <div className="form-text fst-italic">
                        Upload a .zip file containing your shapefile (.shp, .shx, .dbf, .prj) or a single .shp file.
                      </div>
                      {shapefile && (
                        <div className="alert alert-success mt-2">
                          <i className="fas fa-check-circle"></i> File uploaded: <strong>{shapefile.name}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Manual Coordinate Input */}
                <div className="row mt-3 mb-3">
                  <div className="col-12">
                    <label htmlFor="coordinates" className="form-label">Coordinates (WKT Polygon) *</label>
                    <textarea 
                      className="form-control" 
                      name="coordinates"
                      value={formData.coordinates}
                      onChange={handleInputChange}
                      rows={3} 
                      required
                      readOnly={formData.inputMethod === 'map'}
                      placeholder="Draw on the map or enter coordinates manually"
                    />
                  </div>
                </div>

                {/* Cloud Masking Options (for Landsat and Sentinel-2) */}
                {(formData.satellite === 'landsat' || formData.satellite === 'sentinel2') && (
                  <div className="mb-4">
                    <label className="form-label">
                      Cloud Masking Level
                    </label>
                    
                    <select 
                      className="form-select" 
                      name="cloudMaskingLevel"
                      value={formData.cloudMaskingLevel}
                      onChange={handleInputChange}
                    >
                      <option value="disabled">Disabled (no cloud masking)</option>
                      <option value="recommended">Standard (recommended)</option>
                      <option value="strict">Strict (aggressive masking)</option>
                    </select>
                    
                    <div className="form-text">
                      <strong>Disabled:</strong> No cloud masking applied<br/>
                      <strong>Standard:</strong> Removes high confidence clouds and shadows<br/>
                      <strong>Strict:</strong> Removes all cloud types including medium probability clouds
                    </div>
                  </div>
                )}
                
                <div className="mt-3">
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={getImageMetadata}
                    disabled={loading}
                  >
                    <i className="fas fa-search"></i> Find Available Images
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        
        {/* Interactive Map */}
        <div className="col-lg-6">
          <div className="card">
            <div className="card-header">
              <h5><i className="fas fa-map"></i> Interactive Map</h5>
              <small className="text-muted">Draw a polygon or rectangle to select your area of interest</small>
            </div>
            <div className="card-body p-0">
              <div 
                id="map" 
                style={{ 
                  height: '450px', 
                  width: '100%', 
                  borderRadius: '1rem', 
                  overflow: 'hidden', 
                  position: 'relative',
                  minHeight: '450px',
                  minWidth: '300px'
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="row mt-3">
          <div className="col-12">
            <div className="alert alert-success">
              <i className="fas fa-check-circle"></i> {successMessage}
            </div>
          </div>
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="row mt-3">
          <div className="col-12">
            <div className="alert alert-danger">
              <i className="fas fa-exclamation-triangle"></i> {error}
            </div>
          </div>
        </div>
      )}

      {/* Image Selection */}
      {availableImages.length > 0 && (
        <div className="row mt-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5><i className="fas fa-images"></i> Available Images 
                  <span className="badge bg-secondary ms-2">
                    {showAllImages ? availableImages.length : Math.min(12, availableImages.length)} 
                    {availableImages.length > 12 && !showAllImages ? ` of ${availableImages.length}` : ''}
                  </span>
                </h5>
                <div>
                  <button 
                    type="button" 
                    className="btn btn-outline-warning btn-sm me-2" 
                    onClick={selectRecommended}
                  >
                    <i className="fas fa-star"></i> Select Recommended
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary btn-sm" 
                    onClick={clearSelection}
                  >
                    <i className="fas fa-times"></i> Clear All
                  </button>
                </div>
              </div>
              <div className="card-body">
                <div className="row">
                  {(showAllImages ? availableImages : availableImages.slice(0, 12)).map((image, index) => {
                    const isRecommended = recommendedIndices.includes(index);
                    const isSelected = selectedIndices.includes(index);
                    const cloudCoverClass = image.cloud_cover < 10 ? 'success' : 
                                          image.cloud_cover < 30 ? 'warning' : 'danger';
                    
                    return (
                      <div key={index} className="col-lg-4 col-md-6">
                        <div 
                          className={`image-card ${isRecommended ? 'recommended' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleImageSelection(index)}
                        >
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <h6 className="mb-0">
                              <i className="fas fa-calendar"></i> {image.date}
                              {isRecommended && <i className="fas fa-star text-warning ms-1" title="Recommended"></i>}
                            </h6>
                            <span className={`badge bg-${cloudCoverClass} cloud-cover-badge`}>
                              {image.cloud_cover}% clouds
                            </span>
                          </div>
                          
                          <div className="small text-muted">
                            <div><i className="fas fa-satellite"></i> {image.satellite || 'N/A'}</div>
                            <div><i className="fas fa-eye"></i> {image.sensor || 'N/A'}</div>
                            {image.orbit_direction && (
                              <div><i className="fas fa-route"></i> {image.orbit_direction}</div>
                            )}
                            {image.polarization && (
                              <div><i className="fas fa-radio"></i> {image.polarization}</div>
                            )}
                          </div>
                          
                          <div className="form-check mt-2">
                            <input 
                              className="form-check-input" 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleImageSelection(index)}
                            />
                            <label className="form-check-label">
                              Select for analysis
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Show More/Show Less Button */}
                {availableImages.length > 12 && (
                  <div className="text-center mt-3">
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={() => setShowAllImages(!showAllImages)}
                    >
                      <i className={`fas fa-${showAllImages ? 'eye-slash' : 'eye'}`}></i>
                      {showAllImages ? 
                        ` Show Less (${availableImages.slice(0, 12).length} of ${availableImages.length})` : 
                        ` Show All Images (${availableImages.length - 12} more)`
                      }
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selection Summary */}
      <div className="row mt-4 mb-4">
        <div className="col-lg-12">
          <div className="selection-summary">
            <h5><i className="fas fa-list-check"></i> Selection Summary</h5>
            
            {shapefile && (
              <div className="alert alert-success">
                <i className="fas fa-scissors me-2"></i>
                <strong>AOI Clipping Enabled:</strong> Analysis results will be clipped to the uploaded shapefile area.
              </div>
            )}
            
            <div>
              {selectedIndices.length === 0 ? (
                <p className="text-muted">Configure your analysis and find images to start selecting.</p>
              ) : (
                <div>
                  <div className="mb-3">
                    <strong>{selectedIndices.length} images selected</strong>
                    <br />
                    <small className="text-muted">
                      Date range: {availableImages.length > 0 && selectedIndices.length > 0 && 
                        `${availableImages[Math.min(...selectedIndices)]?.date} to ${availableImages[Math.max(...selectedIndices)]?.date}`}
                    </small>
                  </div>
                  <div className="selected-dates">
                    {selectedIndices.map(index => {
                      const img = availableImages[index];
                      return img ? (
                        <span key={index} className="badge bg-success me-1 mb-1">
                          {img.date} ({img.cloud_cover}%)
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="col-md-6">
              <button 
                type="button" 
                className="btn btn-primary mt-3" 
                onClick={createCustomMap}
                disabled={selectedIndices.length === 0 || loading}
              >
                <i className="fas fa-map"></i> Run Analysis of these Images
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Generated Map */}
      {mapUrl && (
        <div className="row mt-4 mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5><i className="fas fa-map"></i> Analysis Satellite Imagery Map</h5>
              </div>
              <div className="card-body p-0">
                <iframe 
                  src={`http://localhost:8000${mapUrl}`}
                  style={{ width: '100%', height: '800px', border: 'none' }}
                  title="Advanced Satellite Analysis Map"
                />
              </div>
              <div className="card-footer">
                <small className="text-muted fst-italic">
                  Use the layer control to toggle between different visualizations and time periods.
                </small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="row mt-4">
          <div className="col-12">
            <div className="alert alert-danger">
              <i className="fas fa-exclamation-triangle"></i> {error}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ImageSelector;