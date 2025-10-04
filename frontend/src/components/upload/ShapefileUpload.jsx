import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

export const ShapefileUpload = ({ onFileUpload, onCoordinatesExtracted }) => {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedCoords, setExtractedCoords] = useState(null);

  const calculateBounds = (coordinates) => {
    if (!coordinates || coordinates.length === 0) return null;
    
    let minLat = coordinates[0][0];
    let maxLat = coordinates[0][0];
    let minLng = coordinates[0][1];
    let maxLng = coordinates[0][1];
    
    coordinates.forEach(([lat, lng]) => {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    });
    
    return {
      north: maxLat,
      south: minLat,
      east: maxLng,
      west: minLng
    };
  };

  const processShapefileLocally = useCallback(async (file) => {
    try {
      // Import required libraries dynamically
      const JSZip = await import('jszip');
      const shapefile = await import('shapefile');
      
      // Extract and process the ZIP file
      const zip = new JSZip.default();
      const zipContents = await zip.loadAsync(file);
      
      const allFiles = Object.keys(zipContents.files);
      console.log('ZIP contents:', allFiles);
      
      // Find the .shp file
      const shpFile = allFiles.find(name => 
        name.toLowerCase().endsWith('.shp') && !name.endsWith('/')
      );
      
      if (!shpFile) {
        throw new Error(`No .shp file found in ZIP. Found: ${allFiles.join(', ')}`);
      }
      
      // Extract the .shp file data
      const shpData = await zipContents.files[shpFile].async('arraybuffer');
      
      // Parse the shapefile
      const geojson = await shapefile.read(shpData);
      console.log('Parsed shapefile:', geojson);
      
      if (!geojson.features || geojson.features.length === 0) {
        throw new Error('No features found in shapefile');
      }
      
      // Extract coordinates from the first feature
      const firstFeature = geojson.features[0];
      let coordinates = null;
      let wkt = '';
      
      if (firstFeature.geometry.type === 'Polygon') {
        const coords = firstFeature.geometry.coordinates[0];
        // Convert to lat,lng format for the form
        coordinates = coords.map(coord => [coord[1], coord[0]]); // [lat, lng]
        const wktCoords = coords.map(coord => `${coord[0]} ${coord[1]}`).join(', ');
        wkt = `POLYGON((${wktCoords}))`;
        
        console.log('Polygon processed:', {
          originalCoords: coords.slice(0, 3),
          convertedCoords: coordinates.slice(0, 3),
          wkt: wkt.substring(0, 100) + '...'
        });
      } else if (firstFeature.geometry.type === 'MultiPolygon') {
        const coords = firstFeature.geometry.coordinates[0][0];
        coordinates = coords.map(coord => [coord[1], coord[0]]); // [lat, lng]
        const wktCoords = coords.map(coord => `${coord[0]} ${coord[1]}`).join(', ');
        wkt = `POLYGON((${wktCoords}))`;
        
        console.log('MultiPolygon processed:', {
          originalCoords: coords.slice(0, 3),
          convertedCoords: coordinates.slice(0, 3),
          wkt: wkt.substring(0, 100) + '...'
        });
      } else {
        throw new Error(`Unsupported geometry type: ${firstFeature.geometry.type}. Please use Polygon or MultiPolygon shapefiles.`);
      }
      
      // Store the extracted data
      const coordsData = {
        coordinates,
        wkt,
        bounds: calculateBounds(coordinates),
        geometry: firstFeature.geometry
      };
      
      setExtractedCoords(coordsData);
      
      // Pass coordinates to parent components
      if (onCoordinatesExtracted) {
        onCoordinatesExtracted(coordinates, wkt, 'shapefile', firstFeature.geometry);
      }
      
    } catch (error) {
      console.error('Error processing shapefile:', error);
      throw error;
    }
  }, [onCoordinatesExtracted]);

  const onDrop = useCallback(async (acceptedFiles, rejectedFiles) => {
    console.log('=== File Drop Debug ===');
    console.log('Accepted files:', acceptedFiles);
    console.log('Rejected files:', rejectedFiles);
    
    if (rejectedFiles && rejectedFiles.length > 0) {
      console.log('File rejection reasons:', rejectedFiles.map(f => f.errors));
      alert(`File rejected: ${rejectedFiles[0].errors.map(e => e.message).join(', ')}`);
      return;
    }
    
    if (acceptedFiles.length === 0) {
      console.log('No files accepted');
      return;
    }
    
    setIsProcessing(true);
    
    const file = acceptedFiles[0];
    console.log('Processing file:', file.name, 'Type:', file.type, 'Size:', file.size);
    
    // Check if it's a zip file (preferred method)
    const isZipFile = file.name.toLowerCase().endsWith('.zip');
    
    if (!isZipFile) {
      alert(
        'Please upload a ZIP file containing all shapefile components.\n\n' +
        'Required files in the ZIP:\n' +
        '• .shp (geometry data)\n' +
        '• .shx (shape index)\n' +
        '• .dbf (attribute data)\n' +
        '• .prj (projection info - optional but recommended)\n\n' +
        'Example: myarea.zip containing myarea.shp, myarea.shx, myarea.dbf'
      );
      setIsProcessing(false);
      return;
    }

    try {
      setUploadedFile(file);
      
      // Process the shapefile locally to extract coordinates and display on map
      await processShapefileLocally(file);
      
      // Notify parent components about the upload
      onFileUpload && onFileUpload(file);
      
    } catch (error) {
      console.error('Shapefile processing error:', error);
      alert(`Failed to process shapefile: ${error.message}`);
      setUploadedFile(null);
    } finally {
      setIsProcessing(false);
    }
  }, [onFileUpload, processShapefileLocally]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
      'application/octet-stream': ['.zip']
    },
    multiple: false,
    maxFiles: 1,
    noClick: false,
    noKeyboard: false
  });

  const removeFile = () => {
    setUploadedFile(null);
    setExtractedCoords(null);
    onFileUpload && onFileUpload(null);
    // Clear coordinates from form
    if (onCoordinatesExtracted) {
      onCoordinatesExtracted(null, '', 'clear', null);
    }
  };

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border border-2 border-dashed rounded text-center ${
          isDragActive 
            ? 'border-primary bg-primary bg-opacity-10' 
            : 'border-secondary'
        }`}
        style={{ 
          cursor: 'pointer', 
          transition: 'all 0.3s ease',
          borderRadius: '1rem',
          border: '3px dashed #667eea',
          backgroundColor: '#f8f9fa',
          padding: window.innerWidth < 768 ? '1rem' : '1.5rem',
          minHeight: '120px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}
        onMouseEnter={(e) => {
          if (!isDragActive) {
            e.currentTarget.style.backgroundColor = '#e8f2ff';
            e.currentTarget.style.borderColor = '#4f46e5';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragActive) {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
            e.currentTarget.style.borderColor = '#667eea';
          }
        }}
      >
        <input {...getInputProps()} />
        
        {isProcessing ? (
          <div className="py-4">
            <div className="spinner-border text-primary mx-auto" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2 small text-muted">Processing shapefile...</p>
          </div>
        ) : (
          <div>
            <i className="fas fa-cloud-upload-alt text-muted mb-2" style={{ fontSize: window.innerWidth < 768 ? '1.5rem' : '2rem' }}></i>
            <div>
              {isDragActive ? (
                <p className="text-primary">Drop the ZIP file here...</p>
              ) : (
                <>
                  <p className="mb-2" style={{ fontSize: window.innerWidth < 768 ? '0.85rem' : '1rem' }}>
                    <strong>Click here</strong> to select a shapefile ZIP or drag and drop
                  </p>
                  <p className="small text-muted mb-3">
                    Shapefile will be displayed on map and coordinates extracted
                  </p>
                  <button 
                    type="button" 
                    className="btn btn-outline-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      open();
                    }}
                  >
                    <i className="fas fa-folder-open me-1"></i>Choose ZIP File
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Requirements Information */}
      <div className="mt-3">
        <div className="small text-dark fw-medium mb-2">📋 How It Works:</div>
        <ul className="small text-muted mb-0 ps-3">
          <li><strong>Upload:</strong> ZIP file containing .shp, .shx, .dbf files</li>
          <li><strong>Display:</strong> Area will be shown on the interactive map</li>
          <li><strong>Extract:</strong> Polygon coordinates will be used for analysis</li>
          <li><strong>Support:</strong> Polygon and MultiPolygon geometries only</li>
        </ul>
        <div className="mt-2">
          <small className="text-muted">
            <i className="fas fa-info-circle me-1"></i>
            Single .shp files cannot be uploaded as they require companion files that browsers cannot upload together.
          </small>
        </div>
        
        {/* Debug info for development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-2">
            <small className="text-info">
              <i className="fas fa-bug me-1"></i>
              Debug: Component ready | isDragActive: {isDragActive.toString()} | Click or drag ZIP files
            </small>
          </div>
        )}
      </div>

      {uploadedFile && (
        <div className="mt-3">
          <div className="alert alert-success d-flex justify-content-between align-items-center" style={{ margin: '0.5rem 0' }}>
            <div className="text-truncate" style={{ maxWidth: window.innerWidth < 768 ? '200px' : '300px' }}>
              <i className="fas fa-check-circle me-1"></i>
              <span title={uploadedFile.name} style={{ fontSize: window.innerWidth < 768 ? '0.8rem' : '0.9rem' }}>
                {window.innerWidth < 768 && uploadedFile.name.length > 25 
                  ? uploadedFile.name.substring(0, 25) + '...' 
                  : uploadedFile.name}
              </span>
            </div>
            <button 
              type="button" 
              className="btn btn-sm btn-outline-danger ms-2 flex-shrink-0"
              onClick={removeFile}
              title="Remove shapefile"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      {extractedCoords && (
        <div className="alert alert-success border-success-subtle rounded p-3 mt-3">
          <div className="d-flex align-items-center">
            <i className="fas fa-check-circle text-success me-2" style={{ fontSize: '1.2rem' }}></i>
            <div>
              <h6 className="fw-medium text-success mb-0">Shapefile Loaded Successfully!</h6>
              <p className="small text-success mb-0 mt-1">
                Area displayed on map and coordinates extracted for analysis
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
