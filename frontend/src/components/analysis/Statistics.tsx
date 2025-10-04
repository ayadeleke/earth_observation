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
      <div className="bg-white rounded shadow-sm p-4">
        <h3 className="fs-5 fw-semibold mb-3 d-flex align-items-center">
          📊 Statistics
        </h3>
        <div className="text-muted text-center py-5">
          <div className="fs-5">No statistics available</div>
          <div className="small mt-2">Statistics will appear after analysis</div>
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
      case 'lst': return 'text-danger';
      case 'backscatter':
      case 'sar': return 'text-info';
      default: return 'text-success';
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
      color: 'text-primary'
    },
    {
      label: 'Min Value',
      value: formatValue(data.min),
      unit,
      color: 'text-warning'
    },
    {
      label: 'Max Value',
      value: formatValue(data.max),
      unit,
      color: 'text-secondary'
    },
    {
      label: 'Count',
      value: data.count?.toString() || 'N/A',
      unit: 'observations',
      color: 'text-muted'
    }
  ];

  return (
    <div className="bg-white rounded shadow-sm overflow-hidden">
      <div className="border-bottom p-4">
        <h2 className="fs-5 fw-semibold text-dark d-flex align-items-center">
          📊 Statistics
        </h2>
        <div className="small text-muted mt-1">
          Summary statistics for {analysisType.toUpperCase()} analysis
        </div>
      </div>
      
      <div className="p-4">
        {statisticsItems.map((item, index) => (
          <div key={index} className="d-flex justify-content-between align-items-center mb-3">
            <div className="small text-muted">{item.label}</div>
            <div className={`fw-semibold ${item.color}`}>
              {item.value} {item.unit && (
                <span className="small text-muted ms-1">{item.unit}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Additional Info */}
      <div className="bg-light p-3">
        <div className="small text-muted">
          <strong>Generated:</strong> {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default Statistics;