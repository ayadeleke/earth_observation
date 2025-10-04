import React, { useRef, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

// Fix for default markers in Leaflet
import L from 'leaflet';
import 'leaflet-draw';
import * as shapefile from 'shapefile';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export const InteractiveMap = ({ 
  onAreaSelect,
  clearLayers = false,
  clearShapefileLayers = false,
  uploadedShapefile = null,
  initialBounds = null, 
  height = '600px',
  className = '',
  children = null
}) => {
  const mapRef = useRef();
  const drawnItemsRef = useRef();
  const drawControlRef = useRef();
  const shapefileLayerRef = useRef();
  const onAreaSelectRef = useRef(onAreaSelect);

  // Update the ref when onAreaSelect changes
  useEffect(() => {
    onAreaSelectRef.current = onAreaSelect;
  }, [onAreaSelect]);

  // Clear layers when clearLayers prop changes to true
  useEffect(() => {
    if (clearLayers && drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
    }
  }, [clearLayers]);

  // Clear shapefile layers when clearShapefileLayers prop changes to true
  useEffect(() => {
    if (clearShapefileLayers && shapefileLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(shapefileLayerRef.current);
      shapefileLayerRef.current = null;
    }
  }, [clearShapefileLayers]);

  // Helper function to process GeoJSON features
  const processGeojsonFeatures = async (geojson, filename) => {
    if (!geojson.features || geojson.features.length === 0) {
      throw new Error('No features found in shapefile');
    }
    
    // Process the shapefile features to extract coordinates (and display on map)
    console.log(`Found ${geojson.features.length} features in shapefile`);
    
    // Create a feature group for all shapefile features
    const shapefileGroup = L.featureGroup();
    
    // Process each feature in the shapefile
    geojson.features.forEach((feature, index) => {
      if (feature.geometry) {
        // Convert GeoJSON to Leaflet layer with the actual geometry
        const layer = L.geoJSON(feature, {
          style: {
            color: '#ff7800',
            fillColor: '#ff7800',
            fillOpacity: 0.3,
            weight: 2,
            dashArray: '5, 5' // Dashed line to distinguish from drawn shapes
          }
        });
        
        // Add to the shapefile group
        shapefileGroup.addLayer(layer);
        
        // Add popup with feature info
        layer.bindPopup(`
          <strong>Shapefile: ${filename}</strong><br>
          Feature ${index + 1}<br>
          Type: ${feature.geometry.type}<br>
          <small>Real shapefile geometry</small>
        `);
      }
    });
    
    // Add the shapefile group to the map
    console.log('Adding shapefile group to map:', {
      groupHasLayers: shapefileGroup.getLayers().length > 0,
      mapExists: !!mapRef.current,
      groupBounds: shapefileGroup.getBounds()
    });
    
    shapefileLayerRef.current = shapefileGroup;
    mapRef.current.addLayer(shapefileGroup);
    console.log('Shapefile layer added successfully');
    
    // Clear any drawn shapes when shapefile is loaded
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
    }
    
    // Fit map to the actual shapefile bounds
    const bounds = shapefileGroup.getBounds();
    mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    
    // Generate WKT from the first feature (or combine all features)
    const firstFeature = geojson.features[0];
    let wkt = '';
    
    if (firstFeature.geometry.type === 'Polygon') {
      const coordinates = firstFeature.geometry.coordinates[0];
      const wktCoords = coordinates.map(coord => `${coord[0]} ${coord[1]}`).join(', ');
      wkt = `POLYGON((${wktCoords}))`;
    } else if (firstFeature.geometry.type === 'MultiPolygon') {
      // Handle MultiPolygon by taking the first polygon
      const coordinates = firstFeature.geometry.coordinates[0][0];
      const wktCoords = coordinates.map(coord => `${coord[0]} ${coord[1]}`).join(', ');
      wkt = `POLYGON((${wktCoords}))`;
    } else if (firstFeature.geometry.type === 'Point') {
      const coords = firstFeature.geometry.coordinates;
      wkt = `POINT(${coords[0]} ${coords[1]})`;
    } else {
      console.warn('Unsupported geometry type:', firstFeature.geometry.type);
      // Fallback to creating a bounding box
      const bounds = L.geoJSON(firstFeature).getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      wkt = `POLYGON((${sw.lng} ${sw.lat}, ${ne.lng} ${sw.lat}, ${ne.lng} ${ne.lat}, ${sw.lng} ${ne.lat}, ${sw.lng} ${sw.lat}))`;
    }
    
    // Convert coordinates for the callback (using bounds of first feature)
    const featureBounds = L.geoJSON(firstFeature).getBounds();
    const coordinateArray = [
      [featureBounds.getSouth(), featureBounds.getWest()],
      [featureBounds.getNorth(), featureBounds.getWest()],
      [featureBounds.getNorth(), featureBounds.getEast()],
      [featureBounds.getSouth(), featureBounds.getEast()]
    ];
    
    // Call the callback to update the coordinates field
    if (onAreaSelectRef.current) {
      onAreaSelectRef.current(coordinateArray, wkt, 'shapefile');
    }
  };

  // Function to process and display shapefile
  const processAndDisplayShapefile = useCallback(async (file) => {
    try {
      console.log('Processing shapefile:', file.name, 'Size:', file.size, 'Type:', file.type);
      
      // Remove any existing shapefile layer
      if (shapefileLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(shapefileLayerRef.current);
        shapefileLayerRef.current = null;
      }
      
      // Check if it's a .zip file containing shapefile components
      if (file.name.toLowerCase().endsWith('.zip')) {
        console.log('Processing ZIP file containing shapefile...');
        
        // For ZIP files, we need to extract and process the .shp file
        const JSZip = await import('jszip');
        const zip = new JSZip.default();
        const zipContents = await zip.loadAsync(file);
        
        const allFiles = Object.keys(zipContents.files);
        console.log('ZIP contents:', allFiles);
        
        // Find the .shp file in the ZIP - allow files in subdirectories but exclude actual directories
        const shpFile = allFiles.find(name => 
          name.toLowerCase().endsWith('.shp') && !name.endsWith('/')
        );
        
        if (!shpFile) {
          console.error('Available files in ZIP:', allFiles);
          throw new Error(`No .shp file found in ZIP archive. Found files: ${allFiles.join(', ')}`);
        }
        
        console.log('Found .shp file:', shpFile);
        
        // Extract the .shp file data
        const shpData = await zipContents.files[shpFile].async('arraybuffer');
        
        // Parse the shapefile using the shapefile library
        const geojson = await shapefile.read(shpData);
        console.log('Parsed shapefile data from ZIP:', geojson);
        console.log('Features found:', geojson.features?.length || 0);
        
        await processGeojsonFeatures(geojson, file.name);
        
      } else if (file.name.toLowerCase().endsWith('.shp')) {
        console.log('Processing .shp file directly...');
        
        // Read the shapefile data
        const arrayBuffer = await file.arrayBuffer();
        
        // Parse the shapefile using the shapefile library
        const geojson = await shapefile.read(arrayBuffer);
        console.log('Parsed shapefile data:', geojson);
        
        await processGeojsonFeatures(geojson, file.name);
        
      } else {
        throw new Error(`Unsupported file type: ${file.name}. Please upload a .shp file or .zip containing shapefile.`);
      }
      
    } catch (error) {
      console.error('Error processing shapefile:', error);
      console.error('Shapefile parsing failed, coordinates not extracted');
      
      // Don't add any visual elements, just clear the reference
      shapefileLayerRef.current = null;
      
      // Call callback with empty data to indicate failure
      if (onAreaSelectRef.current) {
        onAreaSelectRef.current([], '', 'shapefile-error');
      }
    }
  }, []); // Remove dependencies to prevent recreation

  // Handle shapefile upload and display
  useEffect(() => {
    console.log('Shapefile useEffect triggered:', {
      uploadedShapefile: !!uploadedShapefile,
      fileName: uploadedShapefile?.name,
      mapRef: !!mapRef.current,
      shapefileLayerRef: !!shapefileLayerRef.current
    });
    
    if (uploadedShapefile && mapRef.current) {
      console.log('Processing shapefile upload...');
      processAndDisplayShapefile(uploadedShapefile);
    } else if (!uploadedShapefile && shapefileLayerRef.current && mapRef.current) {
      console.log('Removing shapefile layer...');
      // Remove shapefile layer when no file is uploaded
      mapRef.current.removeLayer(shapefileLayerRef.current);
      shapefileLayerRef.current = null;
      
      // Clear coordinates when shapefile is removed
      if (onAreaSelectRef.current) {
        onAreaSelectRef.current([], '', 'shapefile-removal');
      }
    } else if (uploadedShapefile && !mapRef.current) {
      console.warn('Shapefile uploaded but map not ready yet');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedShapefile]); // processAndDisplayShapefile excluded to prevent recreation

  // Default center and zoom
  const defaultCenter = [52.5, 13.4];
  const defaultZoom = 8;

  useEffect(() => {
    console.log('useEffect triggered, mapRef.current:', !!mapRef.current);
    
    // Add a delay to ensure the map is fully rendered before adding controls
    const timer = setTimeout(() => {
      console.log('Timer triggered, checking map...', !!mapRef.current);
      
      if (mapRef.current && !drawnItemsRef.current) {
        const map = mapRef.current;
        console.log('Adding drawing controls to map...');
        
        // Initialize drawn items layer
        drawnItemsRef.current = new L.FeatureGroup();
        map.addLayer(drawnItemsRef.current);
        console.log('Added drawn items layer');

        // Add drawing controls - exactly like Flask implementation
        drawControlRef.current = new L.Control.Draw({
          edit: {
            featureGroup: drawnItemsRef.current
          },
          draw: {
            polygon: true,
            rectangle: true,
            circle: false,
            marker: false,
            polyline: false,
            circlemarker: false
          }
        });
        
        map.addControl(drawControlRef.current);
        console.log('Drawing controls added successfully!');

        // Handle drawn shapes - exactly like Flask implementation
        map.on('draw:created', function(e) {
          let layer = e.layer;
          drawnItemsRef.current.addLayer(layer);
          
          // Clear shapefile when user draws on map
          if (shapefileLayerRef.current && mapRef.current) {
            mapRef.current.removeLayer(shapefileLayerRef.current);
            shapefileLayerRef.current = null;
          }
          
          // Convert to WKT format
          let coordinates = layer.getLatLngs()[0].map(point => 
            `${point.lng} ${point.lat}`
          ).join(', ');
          let wkt = `POLYGON((${coordinates}, ${layer.getLatLngs()[0][0].lng} ${layer.getLatLngs()[0][0].lat}))`;
          
          // Call the callback with both formats
          if (onAreaSelectRef.current) {
            onAreaSelectRef.current(layer.getLatLngs()[0], wkt, 'drawing');
          }
        });

        // Handle edited shapes
        map.on('draw:edited', function(e) {
          const layers = e.layers;
          layers.eachLayer((layer) => {
            if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
              const latlngs = layer.getLatLngs()[0];
              const coordinates = latlngs.map(point => [point.lat, point.lng]);
              
              const wktCoords = latlngs.map(point => 
                `${point.lng} ${point.lat}`
              ).join(', ');
              const wkt = `POLYGON((${wktCoords}, ${latlngs[0].lng} ${latlngs[0].lat}))`;
              
              if (onAreaSelectRef.current) {
                onAreaSelectRef.current(coordinates, wkt, 'drawing');
              }
            }
          });
        });

        // Handle deleted shapes
        map.on('draw:deleted', function(e) {
          if (onAreaSelectRef.current) {
            onAreaSelectRef.current([], '', 'drawing');
          }
        });

        // Try to get user's current location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            function(position) {
              const lat = position.coords.latitude;
              const lng = position.coords.longitude;
              map.setView([lat, lng], 12);
              
              // Add a marker at user's location
              L.marker([lat, lng])
                .addTo(map)
                .bindPopup('Your current location')
                .openPopup();
            },
            function(error) {
              console.log('Geolocation error:', error);
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 600000
            }
          );
        }
      }
    }, 100); // 100ms delay to ensure map is ready

    // Cleanup function
    return () => {
      clearTimeout(timer);
      if (mapRef.current && drawControlRef.current) {
        try {
          mapRef.current.removeControl(drawControlRef.current);
        } catch (e) {
          console.log('Error removing draw control:', e);
        }
      }
    };
  }, []); // Remove onAreaSelect dependency to prevent re-initialization

  return (
    <div className={`map-container ${className}`} style={{ height, position: 'relative', zIndex: 1 }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
        ref={mapRef}
        whenCreated={(mapInstance) => {
          mapRef.current = mapInstance;
          console.log('Map created successfully, will add drawing controls shortly');
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {children}
      </MapContainer>
    </div>
  );
};
