import React, { useState, useEffect, useCallback } from 'react';

interface InteractiveMapSimpleProps {
  analysisData?: any;
  geometry?: any;
  startDate?: string;
  endDate?: string;
  satellite?: string;
  analysisType?: string;
  cloudCover?: number;
  enableCloudMasking?: boolean;
  maskingStrictness?: string;
}

const InteractiveMapSimple: React.FC<InteractiveMapSimpleProps> = ({
  analysisData,
  geometry,
  startDate,
  endDate,
  satellite = 'landsat',
  analysisType = 'ndvi',
  cloudCover = 20,
  enableCloudMasking = true,
  maskingStrictness = 'false'
}) => {
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMap = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Creating interactive map...');
      console.log('Geometry received:', geometry);
      
      // Convert geometry to proper format for backend
      let coordinates;
      if (typeof geometry === 'string') {
        // Already a WKT string
        coordinates = geometry;
      } else if (geometry && geometry.type === 'Polygon' && geometry.coordinates) {
        // GeoJSON format - convert to coordinate array
        coordinates = geometry.coordinates[0];
      } else if (Array.isArray(geometry)) {
        // Already coordinate array
        coordinates = geometry;
      } else {
        throw new Error('Invalid geometry format. Expected WKT string, GeoJSON Polygon, or coordinate array');
      }
      
      console.log('Converted coordinates:', coordinates);
      
      // Use the create_custom_map endpoint
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
      
      const requestBody = {
        coordinates: coordinates,
        start_date: startDate,
        end_date: endDate,
        satellite: satellite,
        analysis_type: analysisType,
        cloud_cover: cloudCover,
        selected_indices: 'first_last', // Always use first and last images
        cloud_masking_level: enableCloudMasking ? (maskingStrictness === 'strict' ? 'strict' : 'recommended') : 'disabled'
      };

      console.log('=== InteractiveMapSimple Request Debug ===');
      console.log('enableCloudMasking:', enableCloudMasking);
      console.log('maskingStrictness:', maskingStrictness);
      console.log('Calculated cloud_masking_level:', requestBody.cloud_masking_level);
      console.log('Full request body:', requestBody);
      
      const response = await fetch(`${API_BASE_URL}/visualization/create_custom_map/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();
      
      if (result.success && result.map_url) {
        console.log('Map created successfully:', result.map_url);
        
        // Construct full URL to Django backend static files
        let fullMapUrl = result.map_url;
        if (fullMapUrl.startsWith('/static/')) {
          // Convert relative static path to full backend URL
          const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
          fullMapUrl = `${backendUrl}${result.map_url}`;
        }
        
        console.log('Full map URL:', fullMapUrl);
        setMapUrl(fullMapUrl);
      } else {
        throw new Error(result.error || 'Failed to create interactive map');
      }
    } catch (error) {
      console.error('Error creating interactive map:', error);
      setError(error instanceof Error ? error.message : 'Failed to create interactive map');
    } finally {
      setLoading(false);
    }
  }, [geometry, startDate, endDate, satellite, analysisType, cloudCover, enableCloudMasking, maskingStrictness]);

  useEffect(() => {
    if (analysisData && geometry && startDate && endDate) {
      createMap();
    }
  }, [analysisData, geometry, startDate, endDate, createMap]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2 text-muted">Creating interactive map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger d-flex align-items-center" role="alert">
        <i className="fas fa-exclamation-triangle me-2"></i>
        <div>
          <strong>Map Creation Error:</strong> {error}
          <br />
          <button 
            className="btn btn-sm btn-outline-danger mt-2" 
            onClick={createMap}
          >
            <i className="fas fa-redo me-1"></i>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!mapUrl) {
    return (
      <div className="alert alert-info d-flex align-items-center" role="alert">
        <i className="fas fa-info-circle me-2"></i>
        <div>
          Interactive map will be displayed here after analysis is complete.
        </div>
      </div>
    );
  }

  return (
    <div className="interactive-map-container mb-2 mt-4">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h5 className="mb-0">
          <i className="fas fa-map me-2"></i>
          Interactive Analysis Map
        </h5>
        <div className="btn-group btn-group-sm">
          <button 
            className="btn btn-outline-primary"
            onClick={() => window.open(mapUrl, '_blank')}
            title="Open in new tab"
          >
            <i className="fas fa-external-link-alt"></i>
          </button>
          <button 
            className="btn btn-outline-secondary"
            onClick={createMap}
            title="Refresh map"
          >
            <i className="fas fa-refresh"></i>
          </button>
        </div>
      </div>
      
      <div className="map-frame-container">
        <iframe
          src={mapUrl}
          width="100%"
          height="800"
          style={{ 
            border: '1px solid #dee2e6', 
            borderRadius: '0.375rem',
            boxShadow: '0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)'
          }}
          title="Interactive Analysis Map"
          loading="lazy"
          onLoad={() => console.log('Map iframe loaded successfully')}
          onError={() => console.error('Map iframe failed to load')}
        />
      </div>
      
      <div className="mt-2">
        <small className="text-muted fst-italic">
          Map shows {analysisType.toUpperCase()} analysis using {satellite} satellite data
          from {startDate} to {endDate} with first and last images.
        </small>
      </div>
    </div>
  );
};

export default InteractiveMapSimple;