import React, { useState, useEffect } from 'react';
import { NDVITimeSeries } from './NDVITimeSeries';
import { Statistics } from './Statistics';
import InteractiveMapSimple from '../InteractiveMapSimple';
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
  const [loading, setLoading] = useState(false);

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
    <div className="p-4 space-y-6 bg-gray-50 min-h-screen">
      {/* Analysis Results Header */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">📊 Analysis Results</h1>
            <div className="text-sm text-gray-600 mt-1">
              {currentData.analysisType?.toUpperCase()} Analysis • {currentData.satellite?.toUpperCase()} • 
              {currentData.startDate} to {currentData.endDate}
            </div>
          </div>
          <DownloadButtons 
            data={currentData}
            onDownload={(type: 'csv' | 'plot') => console.log(`Downloading ${type}`)}
          />
        </div>
      </div>
      
      {/* Time Series and Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <NDVITimeSeries 
            data={currentData.timeSeriesData} 
            analysisType={currentData.analysisType}
            loading={loading}
            cloudCover={currentData.cloudCover}
          />
        </div>
        <div>
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
      />
      
      {/* Data Table */}
      <DataTable 
        data={currentData.tableData}
        analysisType={currentData.analysisType}
        loading={loading}
      />
    </div>
  );
};

export default AnalysisDashboard;