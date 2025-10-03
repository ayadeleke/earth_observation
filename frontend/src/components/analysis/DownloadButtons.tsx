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
    
    // Convert data to CSV format
    const headers = ['Date', 'Image ID', 'Value', 'Original Cloud Cover', 'Adjusted Cloud Cover', 'Cloud Masking Applied'];
    const csvContent = [
      headers.join(','),
      ...data.tableData.map((row: any) => [
        row.date,
        row.imageId,
        row.ndviValue || row.lstValue || row.backscatterValue || 'N/A',
        row.originalCloudCover,
        row.adjustedCloudCover,
        row.cloudMaskingApplied ? 'Yes' : 'No'
      ].join(','))
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
      const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';
      
      const response = await fetch(`${API_BASE_URL}/visualization/generate_time_series_plot/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysis_type: data.analysisType || 'ndvi',
          time_series_data: data.timeSeriesData,
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
    <div className="flex space-x-2">
      <button
        onClick={() => handleDownload('csv')}
        disabled={!data?.tableData || downloading === 'csv'}
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {downloading === 'csv' ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Downloading...
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download CSV Data
          </>
        )}
      </button>
      
      <button
        onClick={() => handleDownload('plot')}
        disabled={(!data?.timeSeriesData || data?.timeSeriesData?.length === 0) || downloading === 'plot'}
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {downloading === 'plot' ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Downloading...
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Download Plot
          </>
        )}
      </button>
    </div>
  );
};

export default DownloadButtons;