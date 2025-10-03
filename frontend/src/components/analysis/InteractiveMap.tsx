import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, LayersControl, FeatureGroup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { AnalysisMapLayer } from '../map/AnalysisMapLayer';
import 'leaflet/dist/leaflet.css';

// Legend Component
const Legend: React.FC<{
  analysisType: string;
  satellite: string;
  startDate: string;
  endDate: string;
}> = ({ analysisType, satellite, startDate, endDate }) => {
  const map = useMap();

  useEffect(() => {
    const legend = new L.Control({ position: 'bottomright' });

    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'legend');
      div.style.cssText = `
        background: white;
        padding: 10px;
        border-radius: 5px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        font-family: Arial, sans-serif;
        font-size: 12px;
        max-width: 200px;
      `;
      
      div.innerHTML = `
        <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold;">
          📊 ${analysisType.toUpperCase()} Analysis
        </h4>
        <p style="margin: 2px 0;"><strong>Satellite:</strong> ${satellite.toUpperCase()}</p>
        <p style="margin: 2px 0;"><strong>Period:</strong> ${startDate} to ${endDate}</p>
        <p style="margin: 2px 0;"><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
      `;
      return div;
    };

    legend.addTo(map);
    return () => {
      legend.remove();
    };
  }, [map, analysisType, satellite, startDate, endDate]);

  return null;
};

// Area of Interest Component
const AOILayer: React.FC<{ geometry?: any }> = ({ geometry }) => {
  const map = useMap();

  useEffect(() => {
    if (!geometry) return;

    let aoiLayer: L.GeoJSON;

    try {
      const aoiStyle = {
        color: 'red',
        weight: 3,
        fillOpacity: 0.1,
        fillColor: 'red',
        opacity: 0.8
      };

      aoiLayer = L.geoJSON(geometry, { style: aoiStyle }).addTo(map);
      
      // Fit map to AOI bounds
      const bounds = aoiLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    } catch (error) {
      console.warn('Could not add AOI layer:', error);
    }

    return () => {
      if (aoiLayer) {
        map.removeLayer(aoiLayer);
      }
    };
  }, [map, geometry]);

  return null;
};

interface InteractiveMapProps {
  geometry?: any;
  analysisType: string;
  satellite: string;
  startDate: string;
  endDate: string;
  cloudCover: number;
  selectedImages?: string[];
  onMapDataLoad?: (data: any) => void;
  hasAnalysisResults?: boolean;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  geometry,
  analysisType,
  satellite,
  startDate,
  endDate,
  cloudCover,
  selectedImages,
  onMapDataLoad,
  hasAnalysisResults = false
}) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>([20, 0]);
  const [mapZoom, setMapZoom] = useState(2);
  const [customMapUrl, setCustomMapUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapMode, setMapMode] = useState<'interactive' | 'custom'>('interactive');

  // Update map center based on geometry
  useEffect(() => {
    if (geometry && geometry.coordinates) {
      try {
        const coords = geometry.coordinates[0];
        const centerLat = coords.reduce((sum: number, coord: number[]) => sum + coord[1], 0) / coords.length;
        const centerLon = coords.reduce((sum: number, coord: number[]) => sum + coord[0], 0) / coords.length;
        setMapCenter([centerLat, centerLon]);
        setMapZoom(10);
      } catch (error) {
        console.warn('Could not calculate map center from geometry:', error);
      }
    }
  }, [geometry]);

  // Create custom comprehensive map using ImageSelector approach
  const createCustomMap = async () => {
    if (!geometry || !hasAnalysisResults) {
      console.log('Cannot create custom map: missing geometry or results');
      return;
    }

    setLoading(true);

    try {
      // Convert geometry to WKT format if needed
      let coordinates = '';
      if (geometry && geometry.coordinates) {
        const coords = geometry.coordinates[0];
        const coordString = coords.map((coord: number[]) => `${coord[0]} ${coord[1]}`).join(', ');
        coordinates = `POLYGON((${coordString}))`;
      }

      console.log('=== Creating Custom Map for Analysis ===');
      console.log('Using first and last images only for analysis consistency with Flask');
      console.log('Analysis type:', analysisType);
      console.log('Satellite:', satellite);
      console.log('Date range:', startDate, 'to', endDate);

      const jsonData = {
        project_id: 'ee-ayotundenew',
        satellite: satellite,
        analysis_type: analysisType,
        start_date: startDate,
        end_date: endDate,
        cloud_cover: cloudCover,
        coordinates: coordinates,
        date_range_type: 'dates',
        selected_indices: 'first_last', // Use only first and last images like Flask implementation
        clip_to_aoi: false,
        cloud_masking_level: 'recommended'
      };

      const response = await fetch('/api/v1/visualization/create_custom_map/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(jsonData)
      });

      const data = await response.json();

      if (data.success) {
        setCustomMapUrl(data.map_url);
        setMapMode('custom');
        if (onMapDataLoad) {
          onMapDataLoad(data);
        }
      } else {
        console.error('Failed to create custom map:', data.error);
      }
    } catch (error) {
      console.error('Error creating custom map:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="border-b border-gray-200 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              🌍 Interactive Satellite Imagery Map
            </h2>
            <div className="text-sm text-gray-600 mt-1">
              {mapMode === 'custom' 
                ? 'Analysis map with AOI, first & last images, and calculated layers (like Flask)'
                : 'Interactive layer-based map with Earth Engine tiles'
              }
            </div>
          </div>
          
          {/* Map Mode Controls */}
          {hasAnalysisResults && (
            <div className="flex space-x-2">
              <button
                onClick={() => setMapMode('interactive')}
                className={`px-3 py-1 text-sm rounded-md ${
                  mapMode === 'interactive' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🗺️ Interactive
              </button>
              <button
                onClick={createCustomMap}
                disabled={loading}
                className={`px-3 py-1 text-sm rounded-md ${
                  mapMode === 'custom' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? '⏳ Loading...' : '🛰️ Comprehensive'}
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="h-[600px] relative">
        {mapMode === 'custom' && customMapUrl ? (
          // Custom Comprehensive Map (like ImageSelector)
          <div className="h-full w-full">
            <iframe 
              src={`http://localhost:8000${customMapUrl}`}
              className="h-full w-full border-none"
              title="Comprehensive Satellite Analysis Map"
            />
            <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 rounded px-3 py-2 text-xs text-gray-600 shadow-lg z-[1000]">
              🛰️ Comprehensive map with multiple Earth Engine layers and temporal analysis
            </div>
          </div>
        ) : (
          // Interactive Layer-based Map
          <>
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              className="h-full w-full"
              style={{ zIndex: 1 }}
            >
              <LayersControl position="topright">
                {/* Base Layers */}
                <LayersControl.BaseLayer checked name="🛰️ Satellite">
                  <TileLayer 
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="Tiles © Esri"
                    maxZoom={18}
                  />
                </LayersControl.BaseLayer>
                
                <LayersControl.BaseLayer name="🗺️ OpenStreetMap">
                  <TileLayer 
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="© OpenStreetMap contributors"
                    maxZoom={18}
                  />
                </LayersControl.BaseLayer>

                <LayersControl.BaseLayer name="🌐 Google Maps">
                  <TileLayer 
                    url="https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}"
                    attribution="© Google"
                    maxZoom={18}
                  />
                </LayersControl.BaseLayer>

                {/* Analysis Result Layer - Loads when analysis is complete */}
                <LayersControl.Overlay checked name={`📊 ${analysisType.toUpperCase()} Analysis Result`}>
                  <AnalysisMapLayer
                    geometry={geometry}
                    startDate={startDate}
                    endDate={endDate}
                    analysisType={analysisType}
                    satellite={satellite}
                    cloudCover={cloudCover}
                    visible={true}
                    shouldLoad={hasAnalysisResults}
                    onMapDataLoad={onMapDataLoad}
                    onError={(error) => console.error('Map layer error:', error)}
                  />
                </LayersControl.Overlay>

                {/* Area of Interest Layer */}
                <LayersControl.Overlay checked name="🎯 Area of Interest">
                  <FeatureGroup>
                    <AOILayer geometry={geometry} />
                  </FeatureGroup>
                </LayersControl.Overlay>

                {/* First and Last Image Layers */}
                <LayersControl.Overlay name={`🌅 First Image (${new Date(startDate).getFullYear()})`}>
                  <AnalysisMapLayer
                    geometry={geometry}
                    startDate={startDate}
                    endDate={startDate}
                    analysisType="first_image"
                    satellite={satellite}
                    cloudCover={cloudCover}
                    visible={false}
                    shouldLoad={hasAnalysisResults}
                    onMapDataLoad={onMapDataLoad}
                    onError={(error) => console.error('First image layer error:', error)}
                  />
                </LayersControl.Overlay>

                <LayersControl.Overlay name={`🌇 Last Image (${new Date(endDate).getFullYear()})`}>
                  <AnalysisMapLayer
                    geometry={geometry}
                    startDate={endDate} 
                    endDate={endDate}
                    analysisType="last_image"
                    satellite={satellite}
                    cloudCover={cloudCover}
                    visible={false}
                    shouldLoad={hasAnalysisResults}
                    onMapDataLoad={onMapDataLoad}
                    onError={(error) => console.error('Last image layer error:', error)}
                  />
                </LayersControl.Overlay>

                {analysisType.toLowerCase() === 'ndvi' && (
                  <>
                    <LayersControl.Overlay name={`🍃 First ${analysisType.toUpperCase()} - Coming Soon`}>
                      <div></div>
                    </LayersControl.Overlay>

                    <LayersControl.Overlay name={`🟩 Last ${analysisType.toUpperCase()} - Coming Soon`}>
                      <div></div>
                    </LayersControl.Overlay>

                    <LayersControl.Overlay name={`📈 ${analysisType.toUpperCase()} Change - Coming Soon`}>
                      <div></div>
                    </LayersControl.Overlay>
                  </>
                )}
              </LayersControl>

              {/* Legend */}
              <Legend
                analysisType={analysisType}
                satellite={satellite}
                startDate={startDate}
                endDate={endDate}
              />
            </MapContainer>
            
            {/* Map Controls Info for Interactive Mode */}
            <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 rounded px-3 py-2 text-xs text-gray-600 shadow-lg z-[1000]">
              💡 Use the layer control to toggle between different visualizations. Zoom and pan to explore the area in detail.
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InteractiveMap;