import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

export const ShapefileUpload = ({ onFileUpload, onCoordinatesExtracted }) => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedCoords, setExtractedCoords] = useState(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    setIsProcessing(true);
    
    // Check if we have the required shapefile components
    const requiredExtensions = ['.shp', '.shx', '.dbf'];
    const fileExtensions = acceptedFiles.map(file => 
      file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    );
    
    const hasRequiredFiles = requiredExtensions.every(ext => 
      fileExtensions.includes(ext)
    );

    if (!hasRequiredFiles) {
      alert('Please upload all required shapefile components (.shp, .shx, .dbf)');
      setIsProcessing(false);
      return;
    }

    try {
      setUploadedFiles(acceptedFiles);
      
      // Create FormData for upload
      const formData = new FormData();
      acceptedFiles.forEach(file => {
        formData.append('files', file);
      });

      // Upload to backend
      const response = await fetch('/api/upload-shapefile/', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.bounds) {
          setExtractedCoords(result.bounds);
          onCoordinatesExtracted && onCoordinatesExtracted(result.bounds);
        }
        
        onFileUpload && onFileUpload(result);
      } else {
        const error = await response.json();
        alert(`Upload failed: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload shapefile. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [onFileUpload, onCoordinatesExtracted]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/octet-stream': ['.shp', '.shx', '.dbf'],
      'application/x-esri-shapefile': ['.shp'],
      'application/zip': ['.zip']
    },
    multiple: true
  });

  const removeFiles = () => {
    setUploadedFiles([]);
    setExtractedCoords(null);
  };

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border border-2 border-dashed rounded p-4 p-md-6 text-center ${
          isDragActive 
            ? 'border-primary bg-primary bg-opacity-10' 
            : 'border-secondary'
        }`}
        style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
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
            <svg width="48" height="48" className="mx-auto text-muted mb-3" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div>
              {isDragActive ? (
                <p className="text-primary">Drop the shapefile components here...</p>
              ) : (
                <>
                  <p className="fs-6 fw-medium text-dark">Upload Shapefile</p>
                  <p className="small text-muted mt-1">
                    Drag and drop shapefile components (.shp, .shx, .dbf) or click to browse
                  </p>
                  <p className="small text-muted mt-2" style={{ fontSize: '0.75rem' }}>
                    You can also upload a .zip file containing all components
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {uploadedFiles.length > 0 && (
        <div className="bg-light rounded p-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="fw-medium text-dark mb-0">Uploaded Files:</h6>
            <button
              onClick={removeFiles}
              className="btn btn-sm btn-outline-danger"
            >
              Remove All
            </button>
          </div>
          <ul className="list-unstyled mb-0">
            {uploadedFiles.map((file, index) => (
              <li key={index} className="small text-muted d-flex align-items-start mb-1">
                <svg width="16" height="16" className="me-2 text-success flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="flex-grow-1">
                  <div className="text-break">
                    <span className="fw-medium">{file.name.length > 30 ? file.name.substring(0, 30) + '...' : file.name}</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {extractedCoords && (
        <div className="alert alert-success border-success-subtle rounded p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <h4 className="font-medium text-green-800">Shapefile Processed Successfully!</h4>
          </div>
          <p className="text-sm text-green-700 mt-1">
            Area bounds extracted and ready for analysis
          </p>
        </div>
      )}
    </div>
  );
};
