import React from 'react';

interface StatisticsData {
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  count?: number;
  [key: string]: any;
}

interface StatisticsProps {
  data?: StatisticsData;
  analysisType?: string;
}

export const Statistics: React.FC<StatisticsProps> = ({
  data,
  analysisType = 'ndvi'
}) => {
  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          📊 Statistics
        </h3>
        <div className="text-gray-400 text-center py-8">
          <div className="text-lg">No statistics available</div>
          <div className="text-sm mt-2">Statistics will appear after analysis</div>
        </div>
      </div>
    );
  }

  const getUnit = () => {
    switch (analysisType.toLowerCase()) {
      case 'lst': return '°C';
      case 'backscatter':
      case 'sar': return 'dB';
      default: return '';
    }
  };

  const unit = getUnit();

  const formatValue = (value: number | undefined, precision = 3) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toFixed(precision);
  };

  const getColor = () => {
    switch (analysisType.toLowerCase()) {
      case 'lst': return 'text-red-600';
      case 'backscatter':
      case 'sar': return 'text-teal-600';
      default: return 'text-green-600';
    }
  };

  const colorClass = getColor();

  const statisticsItems = [
    {
      label: `Mean ${analysisType.toUpperCase()}`,
      value: formatValue(data.mean),
      unit,
      color: colorClass
    },
    {
      label: 'Std Dev',
      value: formatValue(data.std),
      unit,
      color: 'text-blue-600'
    },
    {
      label: 'Min Value',
      value: formatValue(data.min),
      unit,
      color: 'text-orange-600'
    },
    {
      label: 'Max Value',
      value: formatValue(data.max),
      unit,
      color: 'text-pink-600'
    },
    {
      label: 'Count',
      value: data.count?.toString() || 'N/A',
      unit: 'observations',
      color: 'text-gray-600'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center">
          📊 Statistics
        </h2>
        <div className="text-sm text-gray-600 mt-1">
          Summary statistics for {analysisType.toUpperCase()} analysis
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {statisticsItems.map((item, index) => (
          <div key={index} className="flex justify-between items-center">
            <div className="text-sm text-gray-600">{item.label}</div>
            <div className={`font-semibold ${item.color}`}>
              {item.value} {item.unit && (
                <span className="text-xs text-gray-500 ml-1">{item.unit}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Additional Info */}
      <div className="bg-gray-50 p-4 text-xs text-gray-600">
        <div>
          <strong>Generated:</strong> {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default Statistics;