import React, { useEffect, useState, useRef } from 'react';
import { useMap, TileLayer } from 'react-leaflet';
import L from 'leaflet';

interface NDVIMapLayerProps {
  geometry?: any;
  startDate: string;
  endDate: string;
  analysisType: string;
  satellite: string;
  cloudCover: number;
  visible: boolean;
  shouldLoad?: boolean; // New prop to control when to load
  onMapDataLoad?: (data: any) => void;
  onError?: (error: string) => void;
}

export const AnalysisMapLayer: React.FC<NDVIMapLayerProps> = ({
  geometry,
  startDate,
  endDate,
  analysisType,
  satellite,
  cloudCover,
  visible,
  shouldLoad = false,
  onMapDataLoad,
  onError
}) => {
  const map = useMap();
  const [loading, setLoading] = useState<boolean>(false);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Use refs to avoid recreating functions that cause infinite re-renders
  const onMapDataLoadRef = useRef(onMapDataLoad);
  const onErrorRef = useRef(onError);

  // Update refs when props change
  useEffect(() => {
    onMapDataLoadRef.current = onMapDataLoad;
    onErrorRef.current = onError;
  });

  useEffect(() => {

    if (!geometry || !shouldLoad) {

      // Remove existing layer if conditions not met
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
        tileLayerRef.current = null;
      }
      return;
    }

    const loadMapVisualization = async () => {
      setLoading(true);
      try {
        // Convert geometry to proper GeoJSON format if needed
        let geoJsonGeometry = geometry;
        
        // If geometry is a string (WKT), convert to GeoJSON
        if (typeof geometry === 'string' && geometry.startsWith('POLYGON')) {
          // Parse WKT polygon to GeoJSON
          const coordString = geometry.match(/POLYGON\(\(([^)]+)\)\)/)?.[1];
          if (coordString) {
            const coordinates = coordString.split(', ').map(pair => {
              const [lng, lat] = pair.trim().split(' ').map(Number);
              return [lng, lat];
            });
            geoJsonGeometry = {
              type: 'Polygon',
              coordinates: [coordinates]
            };
          }
        }
        // If geometry is already an object but not proper GeoJSON, ensure it has the right structure
        else if (geometry && typeof geometry === 'object' && !geometry.type) {
          // Handle case where geometry might be just coordinates
          if (geometry.coordinates) {
            geoJsonGeometry = {
              type: 'Polygon',
              coordinates: geometry.coordinates
            };
          }
        }

        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
        const response = await fetch(`${apiUrl}/visualization/get_analysis_map/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            geometry: geoJsonGeometry,
            start_date: startDate,
            end_date: endDate,
            analysis_type: analysisType,
            satellite,
            cloud_cover: cloudCover
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Map API error response:', errorText);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const data = await response.json();

        if (data.success && data.tile_url) {
          // Remove existing layer
          if (tileLayerRef.current) {
            map.removeLayer(tileLayerRef.current);
          }

          // Create new tile layer
          const newTileLayer = L.tileLayer(data.tile_url, {
            attribution: 'Google Earth Engine',
            opacity: 0.7,
            maxZoom: 18
          });

          // Add to map initially - LayersControl will manage visibility
          newTileLayer.addTo(map);
          tileLayerRef.current = newTileLayer;

          // Fit map to bounds if available
          if (data.bounds && data.bounds.coordinates) {
            const bounds = data.bounds.coordinates[0];
            const leafletBounds = L.latLngBounds(
              bounds.map((coord: number[]) => [coord[1], coord[0]])
            );
            map.fitBounds(leafletBounds, { padding: [20, 20] });
          }

          if (onMapDataLoadRef.current) {
            onMapDataLoadRef.current(data);
          }
        } else {
          throw new Error(data.error || 'Failed to load map visualization');
        }
      } catch (error) {
        console.error('Error loading map visualization:', error);
        if (onErrorRef.current) {
          onErrorRef.current(error instanceof Error ? error.message : 'Unknown error');
        }
      } finally {
        setLoading(false);
      }
    };

    loadMapVisualization();

    // Cleanup function
    return () => {
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
      }
    };
  }, [geometry, startDate, endDate, analysisType, satellite, cloudCover, visible, shouldLoad, map]);

  // Show loading indicator
  if (loading) {

  }

  // This component doesn't render anything directly since it manages layers on the map
  return null;
};

export default AnalysisMapLayer;