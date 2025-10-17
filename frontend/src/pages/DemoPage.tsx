import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, FeatureGroup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';

interface MockFormData {
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

interface MockDataPoint {
  date: string;
  image_id: string;
  doy: number;
  ndvi?: number;
  lst?: number;
  backscatter?: number;
  original_cloud_cover: number;
  effective_cloud_cover: number;
  cloud_masking_applied: boolean;
}

interface MockStatistics {
  mean_ndvi?: number;
  std_ndvi?: number;
  min_ndvi?: number;
  max_ndvi?: number;
  median_ndvi?: number;
  mean_lst?: number;
  std_lst?: number;
  min_lst?: number;
  max_lst?: number;
  total_observations: number;
}

const DemoPage: React.FC = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<MockFormData>({
    coordinates: '',
    startYear: 2020,
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
  const [dateRangeType, setDateRangeType] = useState<string>('years');
  const [showResults, setShowResults] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('coordinates');
  const [uploadedShapefile, setUploadedShapefile] = useState<File | null>(null);
  const mapRef = useRef<any>(null);
  const featureGroupRef = useRef<any>(null);

  // Custom Map Component with Drawing Controls
  const MapWithDrawingControls: React.FC = () => {
    useEffect(() => {
      // Delay to ensure map and feature group are ready
      const timer = setTimeout(() => {
        if (mapRef.current && featureGroupRef.current) {
          const map = mapRef.current;
          const featureGroup = featureGroupRef.current;

          // Configure draw controls
          const drawControl = new L.Control.Draw({
            edit: {
              featureGroup: featureGroup,
            },
            draw: {
              polygon: {
                allowIntersection: false,
                showArea: true,
                drawError: {
                  color: '#e1e100',
                  message: '<strong>Oh snap!</strong> you can\'t draw that!'
                },
                shapeOptions: {
                  color: '#2563eb',
                  weight: 2,
                  fillOpacity: 0.2
                }
              },
              rectangle: {
                shapeOptions: {
                  color: '#2563eb',
                  weight: 2,
                  fillOpacity: 0.2
                }
              },
              circle: false,
              circlemarker: false,
              marker: false,
              polyline: false
            }
          });

          map.addControl(drawControl);

          // Handle draw events
          map.on(L.Draw.Event.CREATED, (event: any) => {
            const layer = event.layer;
            // Keep existing layers and add new one (area will persist on map)
            featureGroup.addLayer(layer);
            
            // Convert to WKT format
            const coordinates = layer.getLatLngs()[0].map((latlng: any) => 
              `${latlng.lng} ${latlng.lat}`
            ).join(', ');
            
            const wkt = `POLYGON((${coordinates}, ${layer.getLatLngs()[0][0].lng} ${layer.getLatLngs()[0][0].lat}))`;
            
            setFormData(prev => ({
              ...prev,
              coordinates: wkt
            }));
          });

          map.on(L.Draw.Event.EDITED, (event: any) => {
            const layers = event.layers;
            layers.eachLayer((layer: any) => {
              const coordinates = layer.getLatLngs()[0].map((latlng: any) => 
                `${latlng.lng} ${latlng.lat}`
              ).join(', ');
              
              const wkt = `POLYGON((${coordinates}, ${layer.getLatLngs()[0][0].lng} ${layer.getLatLngs()[0][0].lat}))`;
              
              setFormData(prev => ({
                ...prev,
                coordinates: wkt
              }));
            });
          });

          map.on(L.Draw.Event.DELETED, () => {
            setFormData(prev => ({
              ...prev,
              coordinates: ''
            }));
          });

          return () => {
            map.removeControl(drawControl);
          };
        }
      }, 500); // 500ms delay to ensure map is fully ready

      return () => {
        clearTimeout(timer);
      };
    }, []);

    return (
      <MapContainer
        ref={mapRef}
        center={[52.5, 13.4]}
        zoom={8}
        style={{ height: '400px', width: '100%' }}
        whenReady={() => {

        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <FeatureGroup ref={featureGroupRef} />
      </MapContainer>
    );
  };

  // Generate mock data based on coordinates and analysis type
  const generateMockData = (analysisType: string, coordinates: string): { data: MockDataPoint[], statistics: MockStatistics } => {
    // Parse coordinates to determine general climate/vegetation characteristics
    const getRegionCharacteristics = (coords: string) => {
      // Extract latitude/longitude for climate estimation
      const numbers = coords.match(/-?\d+\.\d+|-?\d+/g);
      if (!numbers || numbers.length < 4) {
        return { climate: 'temperate', avgTemp: 15, vegDensity: 0.5 };
      }
      
      const lats = [];
      const lons = [];
      for (let i = 0; i < numbers.length; i += 2) {
        if (i + 1 < numbers.length) {
          lons.push(parseFloat(numbers[i]));
          lats.push(parseFloat(numbers[i + 1]));
        }
      }
      
      const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      const avgLon = lons.reduce((a, b) => a + b, 0) / lons.length;
      
      // Determine climate characteristics based on latitude
      let climate = 'temperate';
      let avgTemp = 15;
      let vegDensity = 0.5;
      
      if (Math.abs(avgLat) < 23.5) { // Tropical
        climate = 'tropical';
        avgTemp = 27;
        vegDensity = 0.7;
      } else if (Math.abs(avgLat) < 35) { // Subtropical
        climate = 'subtropical';
        avgTemp = 22;
        vegDensity = 0.6;
      } else if (Math.abs(avgLat) < 60) { // Temperate
        climate = 'temperate';
        avgTemp = 15;
        vegDensity = 0.5;
      } else { // Arctic/Antarctic
        climate = 'arctic';
        avgTemp = -5;
        vegDensity = 0.2;
      }
      
      // Adjust for arid regions (simplified detection)
      if ((avgLat > 15 && avgLat < 35) || (avgLat < -15 && avgLat > -35)) {
        if (Math.abs(avgLon) < 20 || (avgLon > 20 && avgLon < 50)) { // Desert belts
          climate = 'arid';
          avgTemp += 8;
          vegDensity = 0.15;
        }
      }
      
      return { climate, avgTemp, vegDensity, avgLat, avgLon };
    };
    
    const regionChar = getRegionCharacteristics(coordinates);
    
    const startDate = new Date(dateRangeType === 'years' ? `${formData.startYear}-01-01` : formData.startDate);
    const endDate = new Date(dateRangeType === 'years' ? `${formData.endYear}-12-31` : formData.endDate);
    
    // Calculate observations
    const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const monthsDiff = Math.max(1, Math.floor(daysDiff / 30));
    const observationsPerMonth = 2; // DEMO_OBSERVATIONS_PER_MONTH
    const observations = Math.min(100, Math.max(10, monthsDiff * observationsPerMonth));
    
    const data: MockDataPoint[] = [];
    
    for (let i = 0; i < observations; i++) {
      // Distribute dates evenly with randomness
      const baseDays = Math.floor(i * daysDiff / observations);
      const randomOffset = Math.floor(Math.random() * 11) - 5; // -5 to +5
      const actualDays = Math.max(0, Math.min(daysDiff, baseDays + randomOffset));
      const randomDate = new Date(startDate.getTime() + actualDays * 24 * 60 * 60 * 1000);
      const doy = Math.floor((randomDate.getTime() - new Date(randomDate.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
      
      let ndvi, lst, backscatter;
      
      // Generate data with seasonal variation
      const seasonalFactor = 0.3 * Math.sin(2 * Math.PI * (doy - 100) / 365);
      
      if (analysisType === 'ndvi' || analysisType === 'comprehensive') {
        // Generate NDVI based on region characteristics and season
        let baseNdvi;
        switch (regionChar.climate) {
          case 'tropical':
            baseNdvi = 0.75 + seasonalFactor * 0.15; // High vegetation, some seasonal variation
            break;
          case 'subtropical':
            baseNdvi = 0.65 + seasonalFactor * 0.2; // Good vegetation, moderate seasonal variation
            break;
          case 'temperate':
            baseNdvi = 0.5 + seasonalFactor * 0.25; // Moderate vegetation, strong seasonal variation
            break;
          case 'arid':
            baseNdvi = 0.15 + seasonalFactor * 0.1; // Low vegetation, minimal seasonal variation
            break;
          case 'arctic':
            // Arctic regions can have negative NDVI (ice, snow, water)
            baseNdvi = -0.1 + seasonalFactor * 0.2; // Can be negative in winter, slightly positive in summer
            break;
          default:
            baseNdvi = regionChar.vegDensity + seasonalFactor * 0.2;
        }
        
        // Add random variation based on cloud cover and masking
        const cloudEffect = formData.enableCloudMasking ? 0.05 : 0.1;
        const randomVariation = (Math.random() - 0.5) * cloudEffect * 2;
        
        // Include possibility of negative NDVI values (water, snow, ice, bare soil)
        const finalNdvi = baseNdvi + randomVariation;
        
        // Occasionally add water bodies or snow/ice patches (5-10% chance for negative values)
        const negativeChance = Math.random();
        if (negativeChance < 0.08) { // 8% chance for water/snow/ice
          if (regionChar.climate === 'arctic') {
            ndvi = -0.4 + Math.random() * 0.3; // Ice/snow: -0.4 to -0.1
          } else {
            ndvi = -0.3 + Math.random() * 0.2; // Water bodies: -0.3 to -0.1
          }
        } else {
          // Normal vegetation/land values
          ndvi = Math.max(-0.5, Math.min(0.95, finalNdvi)); // Allow range from -0.5 to 0.95
        }
        
        ndvi = Math.round(ndvi * 1000) / 1000; // Round to 3 decimals
      }
      
      if (analysisType === 'lst' || analysisType === 'comprehensive') {
        // Generate LST based on climate and latitude
        const seasonalTempFactor = 15 * Math.sin(2 * Math.PI * (doy - 100) / 365);
        
        let baseLst = regionChar.avgTemp;
        
        // Apply seasonal variation (stronger at higher latitudes)
        const seasonalStrength = Math.max(0.3, Math.abs(regionChar.avgLat || 0) / 90);
        baseLst += seasonalTempFactor * seasonalStrength;
        
        // Apply random daily variation
        const dailyVariation = (Math.random() - 0.5) * 8;
        lst = baseLst + dailyVariation;
        
        // Apply climate-specific adjustments
        if (regionChar.climate === 'arid') {
          lst += 5; // Desert heat
        } else if (regionChar.climate === 'arctic') {
          lst -= 10; // Arctic cold
        }
        
        lst = Math.round(lst * 100) / 100; // Round to 2 decimals
      }
      
      if (analysisType === 'sar' || analysisType === 'comprehensive') {
        // Generate SAR backscatter based on terrain and vegetation
        let baseBackscatter;
        
        switch (regionChar.climate) {
          case 'tropical':
            baseBackscatter = -8; // Dense vegetation, high backscatter
            break;
          case 'subtropical':
            baseBackscatter = -12; // Moderate vegetation
            break;
          case 'temperate':
            baseBackscatter = -14; // Variable vegetation
            break;
          case 'arid':
            baseBackscatter = -18; // Bare soil/rock, low backscatter
            break;
          case 'arctic':
            baseBackscatter = -15; // Ice/snow, moderate backscatter
            break;
          default:
            baseBackscatter = -14;
        }
        
        // Add vegetation-based variation
        const vegEffect = (regionChar.vegDensity - 0.5) * 6;
        baseBackscatter += vegEffect;
        
        // Add random variation
        const randomVariation = (Math.random() - 0.5) * 6;
        backscatter = baseBackscatter + randomVariation;
        backscatter = Math.round(backscatter * 100) / 100;
      }
      
      data.push({
        date: randomDate.toISOString().split('T')[0],
        image_id: `DEMO_${formData.satellite.toUpperCase()}_${randomDate.getFullYear()}${String(randomDate.getMonth() + 1).padStart(2, '0')}${String(randomDate.getDate()).padStart(2, '0')}`,
        doy,
        ndvi,
        lst,
        backscatter,
        original_cloud_cover: Math.random() * formData.cloudCover,
        effective_cloud_cover: formData.enableCloudMasking ? Math.random() * (formData.cloudCover / 2) : Math.random() * formData.cloudCover,
        cloud_masking_applied: formData.enableCloudMasking
      });
    }
    
    // Sort by date
    data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Calculate statistics
    const statistics: MockStatistics = {
      total_observations: observations
    };
    
    if (analysisType === 'ndvi' || analysisType === 'comprehensive') {
      const ndviValues = data.filter(d => d.ndvi !== undefined).map(d => d.ndvi!);
      if (ndviValues.length > 0) {
        statistics.mean_ndvi = ndviValues.reduce((a, b) => a + b, 0) / ndviValues.length;
        statistics.std_ndvi = Math.sqrt(ndviValues.reduce((sq, n) => sq + Math.pow(n - statistics.mean_ndvi!, 2), 0) / ndviValues.length);
        statistics.min_ndvi = Math.min(...ndviValues);
        statistics.max_ndvi = Math.max(...ndviValues);
        const sortedNdvi = [...ndviValues].sort();
        statistics.median_ndvi = sortedNdvi[Math.floor(sortedNdvi.length / 2)];
      }
    }
    
    if (analysisType === 'lst' || analysisType === 'comprehensive') {
      const lstValues = data.filter(d => d.lst !== undefined).map(d => d.lst!);
      if (lstValues.length > 0) {
        statistics.mean_lst = lstValues.reduce((a, b) => a + b, 0) / lstValues.length;
        statistics.std_lst = Math.sqrt(lstValues.reduce((sq, n) => sq + Math.pow(n - statistics.mean_lst!, 2), 0) / lstValues.length);
        statistics.min_lst = Math.min(...lstValues);
        statistics.max_lst = Math.max(...lstValues);
      }
    }
    
    return { data, statistics };
  };

  // Handle input changes
  const handleInputChange = (e: any) => {
    const { name, value, type } = e.target;
    const checked = (e.target as any).checked;
    
    setFormData((prev: MockFormData) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle cloud cover slider sync
  const handleCloudCoverChange = (e: any) => {
    const value = e.target.value;
    setFormData((prev: MockFormData) => ({
      ...prev,
      cloudCover: Number(value),
      cloudCoverValue: Number(value)
    }));
  };

  const handleCloudCoverValueChange = (e: any) => {
    const value = e.target.value;
    setFormData((prev: MockFormData) => ({
      ...prev,
      cloudCover: Number(value),
      cloudCoverValue: Number(value)
    }));
  };

  // Handle shapefile upload
  const handleShapefileUpload = (event: any) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedShapefile(file);
      // For demo mode, we'll simulate processing the shapefile
      // In a real implementation, you would upload to backend for processing
      setFormData((prev: MockFormData) => ({
        ...prev,
        coordinates: '' // Clear manual coordinates when shapefile is uploaded
      }));

    }
  };

  // Handle shapefile removal
  const handleShapefileRemove = () => {
    setUploadedShapefile(null);
    setFormData((prev: MockFormData) => ({
      ...prev,
      coordinates: ''
    }));
    // Reset the file input
    const fileInput = document.getElementById('shapefileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }

  };

  // Handle form submission
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    
    // Handle coordinates or shapefile for demonstration
    let coordinates = formData.coordinates.trim();
    
    // If shapefile is uploaded in demo mode, use a representative area
    if (uploadedShapefile) {
      // For demo purposes, simulate different regions based on filename
      const filename = uploadedShapefile.name.toLowerCase();
      if (filename.includes('forest') || filename.includes('vegetation')) {
        coordinates = 'POLYGON((-122.5 45.0, -122.0 45.0, -122.0 45.5, -122.5 45.5, -122.5 45.0))'; // Pacific Northwest forest
      } else if (filename.includes('urban') || filename.includes('city')) {
        coordinates = 'POLYGON((-74.1 40.6, -73.9 40.6, -73.9 40.8, -74.1 40.8, -74.1 40.6))'; // NYC area
      } else if (filename.includes('desert') || filename.includes('arid')) {
        coordinates = 'POLYGON((-116.0 34.0, -115.5 34.0, -115.5 34.5, -116.0 34.5, -116.0 34.0))'; // Mojave Desert
      } else {
        coordinates = 'POLYGON((-95.0 39.0, -94.5 39.0, -94.5 39.5, -95.0 39.5, -95.0 39.0))'; // Central US
      }

    } else if (!coordinates) {
      // If no coordinates or shapefile provided, use a default global area for demonstration
      coordinates = 'POLYGON((-180 -60, 180 -60, 180 60, -180 60, -180 -60))'; // Global coverage for demo
    }

    setLoading(true);
    setError('');

    try {
      // Generate mock data based on user input (fully dynamic)
      const mockResults = generateMockData(formData.analysisType, coordinates);

      // Simulate processing delay for realistic experience
      await new Promise(resolve => setTimeout(resolve, 1500));

      setResults({
        success: true,
        data: mockResults.data,
        statistics: mockResults.statistics,
        metadata: {
          total_observations: mockResults.statistics.total_observations,
          date_range: `${dateRangeType === 'years' ? formData.startYear : formData.startDate} to ${dateRangeType === 'years' ? formData.endYear : formData.endDate}`,
          collection_size: mockResults.data.length,
          cloud_masking_applied: formData.enableCloudMasking,
          strict_masking: formData.maskingStrictness === 'true',
          analysis_type: formData.analysisType.toUpperCase(),
          coordinates_used: coordinates
        },
        plot_url: '/demo/mock_plot.png',
        csv_url: '/demo/mock_data.csv',
        demo_mode: true,
        message: 'Demo analysis completed - data generated based on your input parameters'
      });
      setShowResults(true);
    } catch (error) {
      console.error('Demo generation failed:', error);
      setError('Demo generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Clear map selection (only when explicitly requested)
  const clearMapSelection = () => {
    if (featureGroupRef.current) {
      featureGroupRef.current.clearLayers();
    }
    setFormData(prev => ({
      ...prev,
      coordinates: ''
    }));
  };

  // Download mock CSV
  const downloadMockCSV = () => {
    if (!results) return;
    
    let csvContent: string;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    let filename: string;
    
    if (formData.analysisType === 'ndvi' || formData.analysisType === 'comprehensive') {
      csvContent = [
        'date,ndvi',
        ...results.data.filter((item: MockDataPoint) => item.ndvi !== undefined)
          .map((item: MockDataPoint) => `${item.date},${item.ndvi}`)
      ].join('\n');
      filename = `ndvi_demo_data_${timestamp}.csv`;
    } else if (formData.analysisType === 'lst') {
      csvContent = [
        'date,lst,cloud_cover,lst_category',
        ...results.data.filter((item: MockDataPoint) => item.lst !== undefined)
          .map((item: MockDataPoint) => {
            let category = 'Moderate';
            if (item.lst! < 5) category = 'Very Cold';
            else if (item.lst! < 15) category = 'Cold';
            else if (item.lst! < 25) category = 'Moderate';
            else if (item.lst! < 35) category = 'Warm';
            else category = 'Hot';
            return `${item.date},${item.lst},${item.effective_cloud_cover ? item.effective_cloud_cover.toFixed(1) : '0.0'},${category}`;
          })
      ].join('\n');
      filename = `lst_demo_data_${timestamp}.csv`;
    } else if (formData.analysisType === 'sar') {
      csvContent = [
        'date,backscatter,orbit_direction',
        ...results.data.filter((item: MockDataPoint) => item.backscatter !== undefined)
          .map((item: MockDataPoint) => {
            const orbit = Math.random() > 0.5 ? 'ASCENDING' : 'DESCENDING';
            return `${item.date},${item.backscatter},${orbit}`;
          })
      ].join('\n');
      filename = `sentinel1_demo_data_${timestamp}.csv`;
    } else {
      // Comprehensive - include all data
      csvContent = [
        'date,ndvi,lst,backscatter,cloud_cover',
        ...results.data.map((item: MockDataPoint) => 
          `${item.date},${item.ndvi || ''},${item.lst || ''},${item.backscatter || ''},${item.effective_cloud_cover ? item.effective_cloud_cover.toFixed(2) : '0.00'}`
        )
      ].join('\n');
      filename = `comprehensive_demo_data_${timestamp}.csv`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Get satellite description
  const getSatelliteDescription = () => {
    switch (formData.satellite) {
      case 'landsat':
        return 'NDVI and LST analysis using Landsat thermal and optical bands.';
      case 'sentinel2':
        return 'High-resolution NDVI analysis using Sentinel-2 optical imagery.';
      case 'modis':
        return 'LST analysis using MODIS thermal bands with 500m resolution.';
      default:
        return 'NDVI analysis using Landsat thermal and optical bands.';
    }
  };

  return (
    <div>
      {/* Header Section */}
      <div className="header-section">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-8 col-md-7 mb-3 mb-lg-0">
              <h1 className="display-4 display-md-3 display-sm-5 fw-bold mb-3 text-center text-md-start">
                Earth Observation Demo
              </h1>
              <p className="lead mb-0 text-center text-md-start">Experience satellite imagery analysis with simulated data - no authentication required</p>
            </div>
            <div className="col-lg-4 col-md-5 text-center text-lg-end">
              <div className="d-flex flex-column flex-sm-row justify-content-center justify-content-lg-end gap-2">
                <button 
                  className="btn btn-outline-light" 
                  onClick={() => navigate('/')}
                >
                  <i className="fas fa-home"></i> <span className="d-none d-sm-inline">Back to Home</span><span className="d-sm-none">Home</span>
                </button>
                <button 
                  className="btn btn-outline-light" 
                  onClick={() => navigate('/register')}
                >
                  <i className="fas fa-user-plus"></i> <span className="d-none d-sm-inline">Get Full Access</span><span className="d-sm-none">Access</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        {/* Demo Notice */}
        <div className="row">
          <div className="col-12 mb-3">
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="alert alert-warning"
            >
              <i className="fas fa-info-circle me-2"></i>
              <strong>Demo Mode:</strong> This is demo data. Set up Earth Engine for real satellite analysis. 
              For authentic Google Earth Engine analysis, please <button className="btn btn-link p-0 text-decoration-underline" onClick={() => navigate('/register')}>
                create an account</button> or 
                <button className="btn btn-link p-0 text-decoration-underline" onClick={() => navigate('/login')}>
                  log in</button>.
            </motion.div>
          </div>
        </div>

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
            <div className="form-section">
              <h3 className="mb-4">
                <i className="fas fa-cogs  feature-icon"></i>
                Analysis Parameters
              </h3>
              
              <form onSubmit={handleSubmit}>
                {/* Area of Interest Section */}
                <div className="mb-3">
                  <label className="form-label">
                    Area of Interest
                  </label>
                  
                  {/* Tab Navigation */}
                  <div className="mb-3">
                    <div className="btn-group w-100" role="group">
                      <input 
                        type="radio" 
                        className="btn-check" 
                        name="areaInputType" 
                        id="manual-input" 
                        checked={activeTab === 'coordinates'}
                        onChange={() => setActiveTab('coordinates')}
                      />
                      <label className="btn btn-outline-success" htmlFor="manual-input">
                        <i className="fas fa-edit me-2"></i>
                        Manual Input
                      </label>
                      
                      <input 
                        type="radio" 
                        className="btn-check" 
                        name="areaInputType" 
                        id="upload-shapefile" 
                        checked={activeTab === 'shapefile'}
                        onChange={() => setActiveTab('shapefile')}
                      />
                      <label className="btn btn-outline-success" htmlFor="upload-shapefile">
                        <i className="fas fa-upload me-2"></i>
                        Upload Shapefile
                      </label>
                    </div>
                  </div>
                  
                  {/* Tab Content */}
                  <div className="tab-content">
                    {/* Manual Coordinates Tab */}
                    {activeTab === 'coordinates' && (
                      <div className="tab-pane fade show active">
                        <textarea 
                          className="form-control" 
                          name="coordinates"
                          value={formData.coordinates}
                          onChange={handleInputChange}
                          rows={3} 
                          placeholder="Enter coordinates in WKT format or draw on map"
                          style={{ fontFamily: 'monospace', fontSize: '0.9em' }}
                        />
                        <div className="form-text">
                          <strong>Example:</strong> POLYGON((-74.0 40.7, -73.9 40.7, -73.9 40.8, -74.0 40.8, -74.0 40.7))
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
                               border: '3px dashed #064e3b',
                               transition: 'all 0.3s ease',
                               cursor: 'pointer',
                               padding: '1.5rem'
                             }}>
                          <i className="fas fa-cloud-upload-alt text-muted mb-2" style={{ fontSize: '2rem' }}></i>
                          <p className="mb-2">Upload a shapefile package (.zip containing all required components)</p>
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
                            className="btn btn-outline-success" 
                            onClick={() => {
                              const element = document.getElementById('shapefileInput');
                              if (element) element.click();
                            }}
                          >
                            <i className="fas fa-folder-open me-1"></i>Choose ZIP File
                          </button>
                          {uploadedShapefile && (
                            <div className="mt-3">
                              <div className="alert alert-success d-flex justify-content-between align-items-center">
                                <div>
                                  <i className="fas fa-check-circle me-1"></i>
                                  <span>{uploadedShapefile.name}</span>
                                </div>
                                <button 
                                  type="button" 
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={handleShapefileRemove}
                                  title="Remove shapefile"
                                >
                                  <i className="fas fa-times"></i>
                                </button>
                              </div>
                              <div className="alert alert-info mt-2">
                                <i className="fas fa-info-circle me-1"></i>
                                <strong>Demo Mode:</strong> Shapefile uploaded successfully! In demo mode, we'll use a default area for analysis. 
                                For real shapefile processing, please use the full version.
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="form-text mt-2">
                          <strong>Demo Shapefile Requirements:</strong>
                          <ul className="mb-0 mt-1">
                            <li><strong>Required:</strong> Package all shapefile components in a ZIP file</li>
                            <li><strong>Must include:</strong> .shp, .shx, .dbf files with the same base name</li>
                            <li><strong>Optional:</strong> .prj file for projection information</li>
                            <li><strong>Demo Note:</strong> File will be simulated for demonstration purposes</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Date Selection Options */}
                <div className="mb-3">
                  <label className="form-label">
                    Date Range Selection
                  </label>
                  
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
                              max="2024"
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
                              max="2024"
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
                              className="form-control" 
                              name="startDate"
                              value={formData.startDate}
                              onChange={handleInputChange}
                              min="1988-01-01" 
                              max="2024-12-31"
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label htmlFor="endDate" className="form-label">End Date</label>
                            <input 
                              type="date" 
                              className="form-control" 
                              name="endDate"
                              value={formData.endDate}
                              onChange={handleInputChange}
                              min="1988-01-01" 
                              max="2024-12-31"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Analysis Type Selection */}
                <div className="mb-4">
                  <label className="form-label">
                    Analysis Type
                  </label>
                  <select 
                    className="form-select" 
                    name="analysisType"
                    value={formData.analysisType}
                    onChange={handleInputChange}
                  >
                    <option value="ndvi">NDVI (Vegetation Index)</option>
                    <option value="lst">Land Surface Temperature</option>
                    <option value="sar">SAR Backscatter (Sentinel-1)</option>
                    <option value="comprehensive">Comprehensive Analysis (All)</option>
                  </select>
                  <div className="form-text fst-italic">
                    Choose the type of analysis to perform on the selected area. Comprehensive includes NDVI, LST, and SAR data.
                  </div>
                </div>

                {/* Satellite Mission */}
                <div className="mb-4">
                  <label className="form-label">
                    Satellite Mission
                  </label>
                  <select 
                    className="form-select" 
                    name="satellite"
                    value={formData.satellite}
                    onChange={handleInputChange}
                  >
                    <option value="landsat">Landsat (30m resolution)</option>
                    <option value="sentinel2">Sentinel-2 (10m resolution)</option>
                    <option value="modis">MODIS (500m resolution)</option>
                  </select>
                  <div className="form-text fst-italic">
                    <span>{getSatelliteDescription()}</span>
                  </div>
                </div>

                {/* Cloud Cover Filter */}
                <div className="mb-4">
                  <label htmlFor="cloudCover" className="form-label">
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
                        />
                        <span className="input-group-text">%</span>
                      </div>
                    </div>
                  </div>
                  <div className="form-text fst-italic">
                    Filter images with cloud cover below this threshold.
                  </div>
                </div>

                {/* Cloud Masking Options */}
                <div className="mb-4">
                  <label className="form-label">
                    Cloud Masking Options
                  </label>
                  
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
                  
                  <div className="mb-2">
                    <label htmlFor="maskingStrictness" className="form-label small">Masking Level</label>
                    <select 
                      className="form-select form-select-sm" 
                      name="maskingStrictness"
                      value={formData.maskingStrictness}
                      onChange={handleInputChange}
                    >
                      <option value="false">Standard (recommended)</option>
                      <option value="true">Strict (more aggressive)</option>
                    </select>
                  </div>
                </div>

                {/* SAR Polarization */}
                {formData.analysisType === 'sar' && (
                  <div className="mb-4">
                    <label className="form-label">
                      <i className="fas fa-radio me-2"></i>
                      SAR Polarization
                    </label>
                    <select 
                      className="form-select" 
                      name="polarization"
                      value={formData.polarization}
                      onChange={handleInputChange}
                    >
                      <option value="VV">VV - Vertical Transmit, Vertical Receive</option>
                      <option value="VH">VH - Vertical Transmit, Horizontal Receive</option>
                      <option value="HH">HH - Horizontal Transmit, Horizontal Receive</option>
                      <option value="HV">HV - Horizontal Transmit, Vertical Receive</option>
                    </select>
                  </div>
                )}

                {/* Submit Button */}
                <button type="submit" className="btn btn-primary w-100 mb-3" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Generating Demo Results...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-play me-2"></i>
                      Run Demo Analysis
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
          
          {/* Interactive Map for ROI Selection */}
          <div className="col-lg-7">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="card shadow-sm">
                <div className="card-header bg-primary text-success">
                  <h4 className="mb-0">
                    <i className="fas fa-map me-2"></i>
                    Interactive Map
                  </h4>
                  <small className="opacity-75">Click on the map to select an area of interest</small>
                </div>
                <div className="card-body p-0">
                  <MapWithDrawingControls />
                </div>
                <div className="card-footer bg-light">
                  <div className="row align-items-center">
                    <div className="col-md-8">
                      <div className="d-flex align-items-center">
                        <small className="text-muted">
                          Use the drawing tools above to select your area of interest. <br />
                          {formData.coordinates ? 'Area selected! ' : 'No area selected yet. '}
                        </small>
                      </div>
                    </div>
                    <div className="col-md-4 text-end">
                      {formData.coordinates ? (
                        <div>
                          <span className="badge bg-success me-2">
                            <i className="fas fa-check me-1"></i>
                            ROI Selected
                          </span>
                          <button 
                            className="btn btn-outline-secondary btn-sm"
                            onClick={clearMapSelection}
                            title="Clear selection"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ) : (
                        <span className="badge bg-secondary">
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Demo Information Panel */}
        <div className="row mt-4 mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-light">
                <h5 className="card-title mb-0">
                  <i className="fas fa-info-circle text-primary me-2 feature-icon"></i>
                  Demo Information
                </h5>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-6 mb-4">
                    <h6><i className="fas fa-check-circle text-success me-2"></i>Demo Features</h6>
                    <ul className="mb-1">
                      <li><i className=""></i>Simulated satellite data</li>
                      <li><i className=""></i>NDVI, LST, and SAR analysis</li>
                      <li><i className=""></i>CSV data export</li>
                      <li><i className=""></i>Multiple regions available</li>
                      <li><i className=""></i>Instant results</li>
                    </ul>
                  </div>
                  <div className="col-md-6">
                    <h6><i className="fas fa-crown text-warning me-2"></i>Full Version Benefits</h6>
                    <ul className="mb-1">
                      <li><i></i>Real Google Earth Engine data</li>
                      <li><i></i>Custom area selection</li>
                      <li><i></i>Shapefile upload</li>
                      <li><i></i>Full satellite image collections</li>
                      <li><i></i>Advanced analytics</li>
                    </ul>
                    <button 
                      className="btn btn-success btn-sm mt-2"
                      onClick={() => navigate('/register')}
                    >
                      <i className="fas fa-arrow-right me-1"></i>
                      Upgrade Now
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Results Section */}
        {showResults && results && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="row mt-5"
          >
            <div className="col-12">
              <div className="card result-container">
                <div className="card-header bg-light d-flex justify-content-between align-items-center">
                  <h3 className="card-title mb-0">
                    Demo Analysis Results
                  </h3>
                  <button 
                    className="btn btn-outline-primary btn-sm"
                    onClick={downloadMockCSV}
                  >
                    <i className="fas fa-download me-1"></i>
                    Download CSV
                  </button>
                </div>
                <div className="card-body">
                  {/* Statistics Summary */}
                  <div className="row mb-4">
                    {(formData.analysisType === 'ndvi' || formData.analysisType === 'comprehensive') && results.statistics.mean_ndvi && (
                      <>
                        <div className="col-md-3">
                          <div className="bg-success bg-opacity-10 p-3 rounded text-center">
                            <h4 className="text-success mb-1">{results.statistics.mean_ndvi.toFixed(3)}</h4>
                            <small className="text-muted">Mean NDVI</small>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div className="bg-info bg-opacity-10 p-3 rounded text-center">
                            <h4 className="text-secondary mb-1">{results.statistics.std_ndvi ? results.statistics.std_ndvi.toFixed(3) : '0.000'}</h4>
                            <small className="text-muted">Std Dev</small>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div className="bg-warning bg-opacity-10 p-3 rounded text-center">
                            <h4 className="text-warning mb-1">{results.statistics.min_ndvi ? results.statistics.min_ndvi.toFixed(3) : '0.000'}</h4>
                            <small className="text-muted">Min NDVI</small>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div className="bg-danger bg-opacity-10 p-3 rounded text-center">
                            <h4 className="text-danger mb-1">{results.statistics.max_ndvi ? results.statistics.max_ndvi.toFixed(3) : '0.000'}</h4>
                            <small className="text-muted">Max NDVI</small>
                          </div>
                        </div>
                      </>
                    )}
                    {formData.analysisType === 'lst' && results.statistics.mean_lst && (
                      <>
                        <div className="col-md-3">
                          <div className="bg-warning bg-opacity-10 p-3 rounded text-center">
                            <h4 className="text-warning mb-1">{results.statistics.mean_lst.toFixed(1)}°C</h4>
                            <small className="text-muted">Mean LST</small>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div className="bg-info bg-opacity-10 p-3 rounded text-center">
                            <h4 className="text-secondary mb-1">{results.statistics.std_lst ? results.statistics.std_lst.toFixed(1) : '0.0'}°C</h4>
                            <small className="text-muted">Std Dev</small>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div className="bg-success bg-opacity-10 p-3 rounded text-center">
                            <h4 className="text-success mb-1">{results.statistics.min_lst ? results.statistics.min_lst.toFixed(1) : '0.0'}°C</h4>
                            <small className="text-muted">Min LST</small>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div className="bg-danger bg-opacity-10 p-3 rounded text-center">
                            <h4 className="text-danger mb-1">{results.statistics.max_lst ? results.statistics.max_lst.toFixed(1) : '0.0'}°C</h4>
                            <small className="text-muted">Max LST</small>
                          </div>
                        </div>
                      </>
                    )}
                    {formData.analysisType === 'sar' && (
                      <div className="col-md-12">
                        <div className="bg-info bg-opacity-10 p-3 rounded text-center">
                          <h4 className="text-secondary mb-1">{results.statistics.total_observations}</h4>
                          <small className="text-muted">SAR Observations from {results.metadata.date_range}</small>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Time Series Chart */}
                  <div className="row mb-4">
                    <div className="col-12">
                      <div className="card">
                        <div className="card-header">
                          <h5 className="mb-0">
                            Time Series Visualization
                          </h5>
                        </div>
                        <div className="card-body">
                          <div className="mb-3">
                            <small className="text-muted">
                              Showing all {results.data.length} observations from {results.metadata.date_range}
                            </small>
                          </div>
                          <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={results.data}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="date" 
                                tick={{ fontSize: 10 }}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                                interval={Math.max(1, Math.floor(results.data.length / 10))}
                              />
                              <YAxis 
                                tick={{ fontSize: 12 }} 
                                tickCount={10}
                                domain={['dataMin - 0.1', 'dataMax + 0.1']}
                                tickFormatter={(value) => value.toFixed(1)}
                              />
                              <Tooltip 
                                labelFormatter={(value) => `Date: ${value}`}
                                formatter={(value: any, name: string) => [
                                  typeof value === 'number' ? value.toFixed(3) : value,
                                  name
                                ]}
                              />
                              <Legend />
                              {(formData.analysisType === 'ndvi' || formData.analysisType === 'comprehensive') && (
                                <Line 
                                  type="linear" 
                                  dataKey="ndvi" 
                                  stroke="#28a745" 
                                  strokeWidth={2}
                                  name="NDVI"
                                  connectNulls={false}
                                  dot={{ fill: "#28a745", strokeWidth: 2, r: 3 }}
                                />
                              )}
                              {(formData.analysisType === 'lst' || formData.analysisType === 'comprehensive') && (
                                <Line 
                                  type="linear" 
                                  dataKey="lst" 
                                  stroke="#dc3545" 
                                  strokeWidth={2}
                                  name="LST (°C)"
                                  connectNulls={false}
                                  dot={{ fill: "#dc3545", strokeWidth: 2, r: 3 }}
                                />
                              )}
                              {(formData.analysisType === 'sar' || formData.analysisType === 'comprehensive') && (
                                <Line 
                                  type="linear" 
                                  dataKey="backscatter" 
                                  stroke="#17a2b8" 
                                  strokeWidth={2}
                                  name="Backscatter (dB)"
                                  connectNulls={false}
                                  dot={{ fill: "#17a2b8", strokeWidth: 2, r: 3 }}
                                />
                              )}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Data Table Preview */}
                  <div className="table-responsive">
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Image ID</th>
                          {(formData.analysisType === 'ndvi' || formData.analysisType === 'comprehensive') && <th>NDVI</th>}
                          {(formData.analysisType === 'lst' || formData.analysisType === 'comprehensive') && <th>LST (°C)</th>}
                          {(formData.analysisType === 'sar' || formData.analysisType === 'comprehensive') && <th>Backscatter (dB)</th>}
                          <th>Cloud Cover (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.data.slice(0, 10).map((item: MockDataPoint, index: number) => (
                          <tr key={index}>
                            <td>{item.date}</td>
                            <td><code className="small">{item.image_id}</code></td>
                            {(formData.analysisType === 'ndvi' || formData.analysisType === 'comprehensive') && 
                              <td className="text-success fw-bold">{item.ndvi ? item.ndvi.toFixed(3) : '-'}</td>}
                            {(formData.analysisType === 'lst' || formData.analysisType === 'comprehensive') && 
                              <td className="text-danger fw-bold">{item.lst ? item.lst.toFixed(1) : '-'}</td>}
                            {(formData.analysisType === 'sar' || formData.analysisType === 'comprehensive') && 
                              <td className="text-secondary fw-bold">{item.backscatter ? item.backscatter.toFixed(1) : '-'}</td>}
                            <td className="text-muted">{item.effective_cloud_cover ? item.effective_cloud_cover.toFixed(1) : '0.0'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {results.data.length > 10 && (
                      <p className="text-muted text-center">
                        Showing first 10 of {results.data.length} observations. 
                        <button className="btn btn-link p-0 ms-1" onClick={downloadMockCSV}>
                          Download full dataset
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default DemoPage;