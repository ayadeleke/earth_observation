import React, { useState } from 'react';

interface DownloadButtonsProps {
  data?: any;
  onDownload?: (type: 'csv' | 'plot') => void;
}

export const DownloadButtons: React.FC<DownloadButtonsProps> = ({
  data,
  onDownload
}) => {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (type: 'csv' | 'plot') => {
    if (!data) return;
    
    setDownloading(type);
    try {
      if (onDownload) {
        onDownload(type);
      }
      
      // Simulate download process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Here you would implement actual download logic
      if (type === 'csv') {
        downloadCSV();
      } else if (type === 'plot') {
        downloadPlot();
      }
    } catch (error) {
      console.error(`Error downloading ${type}:`, error);
    } finally {
      setDownloading(null);
    }
  };

  const downloadCSV = () => {
    if (!data?.tableData) return;
    
    // Check if this is SAR analysis to determine which headers to include
    const isSAR = data.analysisType?.toLowerCase() === 'sar' || data.analysisType?.toLowerCase() === 'backscatter';
    
    // Convert data to CSV format with conditional headers
    const headers = isSAR 
      ? ['Date', 'Image ID', 'VV Backscatter (dB)', 'VH Backscatter (dB)', 'VV/VH Ratio', 'Orbit Direction']
      : ['Date', 'Image ID', 'Value', 'Original Cloud Cover', 'Adjusted Cloud Cover', 'Cloud Masking Applied'];
      
    const csvContent = [
      headers.join(','),
      ...data.tableData.map((row: any) => {
        if (isSAR) {
          return [
            row.date,
            row.imageId,
            row.backscatterVV || row.backscatterValue || 'N/A',
            row.backscatterVH || 'N/A',
            row.vvVhRatio || 'N/A',
            row.orbitDirection || 'N/A'
          ].join(',');
        } else {
          return [
            row.date,
            row.imageId,
            row.ndviValue || row.lstValue || row.backscatterValue || 'N/A',
            row.originalCloudCover,
            row.adjustedCloudCover,
            row.cloudMaskingApplied ? 'Yes' : 'No'
          ].join(',');
        }
      })
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.analysisType || 'analysis'}_data_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const downloadPlot = async () => {
    if (!data?.timeSeriesData) return;
    
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
      
      // Transform analysis type for backend compatibility
      let backendAnalysisType = data.analysisType || 'ndvi';
      if (backendAnalysisType === 'sar') {
        backendAnalysisType = 'backscatter'; // Backend expects 'backscatter' for SAR
      }
      
      // Ensure data has the correct field names expected by backend
      const processedTimeSeriesData = data.timeSeriesData.map((point: any) => {
        const processedPoint = { ...point };
        
        // For SAR/backscatter analysis, ensure 'backscatter' field exists
        if (backendAnalysisType === 'backscatter') {
          if (point.backscatter === undefined && point.value !== undefined) {
            processedPoint.backscatter = point.value;
          }
        }
        // For NDVI analysis, ensure 'ndvi' field exists  
        else if (backendAnalysisType === 'ndvi') {
          if (point.ndvi === undefined && point.value !== undefined) {
            processedPoint.ndvi = point.value;
          }
        }
        // For LST analysis, ensure 'lst' field exists
        else if (backendAnalysisType === 'lst') {
          if (point.lst === undefined && point.value !== undefined) {
            processedPoint.lst = point.value;
          }
        }
        
        return processedPoint;
      });
      
      console.log('=== Plot Download Debug ===');
      console.log('Original analysis type:', data.analysisType);
      console.log('Backend analysis type:', backendAnalysisType);
      console.log('Original time series data:', data.timeSeriesData?.slice(0, 2));
      console.log('Processed time series data:', processedTimeSeriesData?.slice(0, 2));
      
      const response = await fetch(`${API_BASE_URL}/visualization/generate_time_series_plot/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysis_type: backendAnalysisType,
          time_series_data: processedTimeSeriesData,
          title: `${(data.analysisType || 'ndvi').toUpperCase()} Time Series Analysis`,
          satellite: data.satellite || 'landsat',
          start_date: data.startDate || '',
          end_date: data.endDate || ''
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate plot');
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.analysisType || 'analysis'}_time_series_plot_${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error downloading plot:', error);
      alert('Failed to download plot. Please try again.');
    }
  };

  return (
    <div className="d-flex flex-column flex-sm-row gap-2">
      <button
        onClick={() => handleDownload('csv')}
        disabled={!data?.tableData || downloading === 'csv'}
        className="btn btn-success d-inline-flex align-items-center justify-content-center px-3 py-2 btn-sm"
      >
        {downloading === 'csv' ? (
          <>
            <div className="spinner-border spinner-border-sm me-2" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="d-none d-sm-inline">Downloading...</span>
            <span className="d-sm-none">CSV...</span>
          </>
        ) : (
          <>
            <svg width="16" height="16" className="me-1 me-sm-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="d-none d-sm-inline">Download CSV Data</span>
            <span className="d-sm-none">CSV Data</span>
          </>
        )}
      </button>
      
      <button
        onClick={() => handleDownload('plot')}
        disabled={(!data?.timeSeriesData || data?.timeSeriesData?.length === 0) || downloading === 'plot'}
        className="btn btn-primary d-inline-flex align-items-center justify-content-center px-3 py-2 btn-sm"
      >
        {downloading === 'plot' ? (
          <>
            <div className="spinner-border spinner-border-sm me-2" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="d-none d-sm-inline">Downloading...</span>
            <span className="d-sm-none">Plot...</span>
          </>
        ) : (
          <>
            <svg width="16" height="16" className="me-1 me-sm-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            <span className="d-none d-sm-inline">Download Plot</span>
            <span className="d-sm-none">Plot</span>
          </>
        )}
      </button>
    </div>
  );
};

export default DownloadButtons;