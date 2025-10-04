import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface TimeSeriesDataPoint {
  date: string;
  ndvi?: number;
  lst?: number;
  backscatter?: number;
  count?: number;
}

interface NDVITimeSeriesProps {
  data?: TimeSeriesDataPoint[];
  analysisType?: string;
  loading?: boolean;
  cloudCover?: number;
}

export const NDVITimeSeries: React.FC<NDVITimeSeriesProps> = ({
  data,
  analysisType = 'ndvi',
  loading = false,
  cloudCover
}) => {

  if (loading) {
    return (
      <div className="bg-white rounded shadow-sm p-4">
        <div className="placeholder-glow">
          <div className="placeholder bg-secondary w-25 mb-3" style={{ height: '1rem' }}></div>
          <div className="placeholder bg-secondary w-100" style={{ height: '16rem' }}></div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded shadow-sm p-4">
        <h2 className="fs-5 fw-semibold mb-3">
          📈 {analysisType.toUpperCase()} Time Series
        </h2>
        <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: '16rem' }}>
          <div className="text-center">
            <div className="fs-5">No time series data available</div>
            <div className="small mt-2">Data will appear here after analysis</div>
          </div>
        </div>
      </div>
    );
  }

  const getDataKey = () => {
    switch (analysisType.toLowerCase()) {
      case 'lst': return 'lst';
      case 'backscatter':
      case 'sar': return 'backscatter';
      default: return 'ndvi';
    }
  };

  const getColor = () => {
    switch (analysisType.toLowerCase()) {
      case 'lst': return '#FF6B6B';
      case 'backscatter':
      case 'sar': return '#4ECDC4';
      default: return '#4CAF50';
    }
  };

  const getYAxisLabel = () => {
    switch (analysisType.toLowerCase()) {
      case 'lst': return 'Temperature (°C)';
      case 'backscatter':
      case 'sar': return 'Backscatter (dB)';
      default: return 'NDVI Value';
    }
  };

  const dataKey = getDataKey();
  const color = getColor();
  const yAxisLabel = getYAxisLabel();

  // Format data for chart
  const chartData = data.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit'
    })
  }));

  // Calculate date range for subtitle
  const dateRange = data.length > 0 
    ? `${data[0].date} to ${data[data.length - 1].date}`
    : '';

  const totalObservations = data.reduce((sum, item) => sum + (item.count || 1), 0);

  return (
    <div className="bg-white rounded shadow-sm overflow-hidden">
      <div className="border-bottom p-3 p-md-4">
        <h2 className="fs-6 fs-md-5 fw-semibold text-dark mb-2">
          📈 {analysisType.toUpperCase()} Time Series (Annual Means)
        </h2>
        <div className="small text-muted lh-sm">
          <div>{dateRange}</div>
          <div>Cloud Cover &lt;{cloudCover || 'N/A'}% • {data.length} annual means from {totalObservations} observations</div>
        </div>
      </div>
      
      <div className="p-2 p-md-4">
        <ResponsiveContainer width="100%" height={window.innerWidth < 768 ? 300 : 400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: window.innerWidth < 768 ? 10 : 12 }}
              angle={window.innerWidth < 768 ? -30 : -45}
              textAnchor="end"
              height={window.innerWidth < 768 ? 50 : 60}
              interval={window.innerWidth < 768 ? 'preserveStartEnd' : 0}
            />
            <YAxis 
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: window.innerWidth < 768 ? '11px' : '12px' } }}
              tick={{ fontSize: window.innerWidth < 768 ? 10 : 12 }}
              domain={(() => {
                if (!data || data.length === 0) return [-1, 1];
                const values = data.map(item => item[dataKey]).filter((v): v is number => typeof v === 'number' && !isNaN(v));
                if (values.length === 0) return [-1, 1];
                const min = Math.min(...values);
                const max = Math.max(...values);
                const minTick = Math.floor(min * 5) / 5; // Round down to nearest 0.2
                const maxTick = Math.ceil(max * 5) / 5;  // Round up to nearest 0.2
                return [minTick, maxTick];
              })()}
              ticks={(() => {
                if (!data || data.length === 0) return undefined;
                const values = data.map(item => item[dataKey]).filter((v): v is number => typeof v === 'number' && !isNaN(v));
                if (values.length === 0) return undefined;
                const min = Math.min(...values);
                const max = Math.max(...values);
                const minTick = Math.floor(min * 5) / 5; // Round down to nearest 0.2
                const maxTick = Math.ceil(max * 5) / 5;  // Round up to nearest 0.2
                const ticks = [];
                for (let i = minTick; i <= maxTick; i += 0.2) {
                  ticks.push(Math.round(i * 5) / 5); // Ensure proper rounding
                }
                return ticks;
              })()}
            />
            <Tooltip 
              formatter={(value: any, name) => [
                `${value?.toFixed(3)}`, 
                `Mean ${yAxisLabel}`
              ]}
              labelFormatter={(label) => `Year: ${label}`}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
            <Legend />
            <Line 
              type="linear" 
              dataKey={dataKey} 
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 2, r: 6 }}
              activeDot={{ r: 8, stroke: color, strokeWidth: 2 }}
              name={`Mean ${analysisType.toUpperCase()}`}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="bg-light px-3 px-md-4 py-2 py-md-3">
        <div className="small text-muted text-center text-md-start">
          📊 {window.innerWidth < 768 ? 'Tap points for values' : 'Hover over points for detailed values • Zoom and pan enabled'}
        </div>
      </div>
    </div>
  );
};

export default NDVITimeSeries;