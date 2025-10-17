import React, { useState, useEffect } from 'react';
import { NDVITimeSeries } from './TimeSeries';
import { Statistics } from './Statistics';
import InteractiveMapSimple from './InteractiveMapSimple';
import { DataTable } from './DataTable';
import { DownloadButtons } from './DownloadButtons';

interface AnalysisData {
  timeSeriesData?: any[];
  statistics?: any;
  tableData?: any[];
  mapData?: any;
  geometry?: any;
  analysisType?: string;
  satellite?: string;
  startDate?: string;
  endDate?: string;
  cloudCover?: number;
  enableCloudMasking?: boolean;
  maskingStrictness?: string;
  polarization?: string;
  cloud_masking_settings?: {
    enabled?: boolean;
    strict?: boolean;
    level?: string;
  };
}

interface AnalysisDashboardProps {
  analysisData?: AnalysisData;
  onDataUpdate?: (data: AnalysisData) => void;
}

export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({
  analysisData,
  onDataUpdate
}) => {
  const [currentData, setCurrentData] = useState<AnalysisData | null>(analysisData || null);
  // Removed unused setLoading variable

  useEffect(() => {
    if (analysisData) {

      setCurrentData(analysisData);
    }
  }, [analysisData]);

  if (!currentData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-lg text-gray-600">No analysis data available</div>
          <div className="text-sm text-gray-400 mt-2">Run an analysis to see results here</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid p-2 p-md-4 bg-light min-vh-100">
      {/* Analysis Results Header */}
      <div className="bg-white rounded shadow-sm p-4 mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h1 className="fs-2 fw-bold text-dark">Analysis Results</h1>
            <div className="small text-muted mt-1">
              {currentData.analysisType?.toUpperCase()} Analysis • {currentData.satellite?.toUpperCase()} • 
              {currentData.startDate} to {currentData.endDate}
            </div>
          </div>
          <DownloadButtons 
            data={currentData}
            onDownload={(type: 'csv' | 'plot') => {
              // Handle download action if needed
            }}
          />
        </div>
      </div>
      
      {/* Time Series and Statistics */}
      <div className="row g-3">
        <div className="col-12 col-lg-8">
          <NDVITimeSeries 
            data={currentData.timeSeriesData} 
            analysisType={currentData.analysisType}
            cloudCover={currentData.cloudCover}
          />
        </div>
        <div className="col-12 col-lg-4">
          <Statistics 
            data={currentData.statistics}
            analysisType={currentData.analysisType}
          />
        </div>
      </div>
      
      {/* Interactive Map */}
      <InteractiveMapSimple 
        analysisData={currentData}
        geometry={currentData.geometry}
        analysisType={currentData.analysisType || 'ndvi'}
        satellite={currentData.satellite || 'landsat'}
        startDate={currentData.startDate || ''}
        endDate={currentData.endDate || ''}
        cloudCover={currentData.cloudCover || 20}
        enableCloudMasking={
          currentData.cloud_masking_settings?.enabled ?? 
          currentData.enableCloudMasking ?? 
          currentData.tableData?.[0]?.cloudMaskingApplied ?? 
          false
        }
        maskingStrictness={
          currentData.cloud_masking_settings?.strict ? 'true' : 
          (currentData.maskingStrictness || 'false')
        }
        polarization={currentData.statistics?.selected_polarization || currentData.polarization || 'VV'}
      />
      
      {/* Data Table */}
      <DataTable 
        data={currentData.tableData}
        analysisType={currentData.analysisType}
      />
    </div>
  );
};

export default AnalysisDashboard;