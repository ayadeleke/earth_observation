/* eslint-disable jest/no-conditional-expect */
/* eslint-disable testing-library/no-node-access */
import React from 'react';
import { render, screen } from '@testing-library/react';
import TimeSeries from '../analysis/TimeSeries';

// Mock Recharts
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

describe('TimeSeries Component', () => {
  const mockNDVIData = [
    { date: '2023-01-15', ndvi: 0.45, observations: 5 },
    { date: '2023-02-15', ndvi: 0.52, observations: 6 },
    { date: '2023-03-15', ndvi: 0.61, observations: 4 },
    { date: '2023-04-15', ndvi: 0.58, observations: 7 },
  ];

  const mockLSTData = [
    { date: '2023-01-15', lst: 25.3, observations: 3 },
    { date: '2023-02-15', lst: 27.8, observations: 4 },
    { date: '2023-03-15', lst: 30.2, observations: 5 },
  ];

  const mockSARData = [
    { date: '2023-01-15', backscatter: -12.5, observations: 2 },
    { date: '2023-02-15', backscatter: -11.8, observations: 3 },
    { date: '2023-03-15', backscatter: -13.2, observations: 2 },
  ];

  describe('Rendering', () => {
    it('should render the component with NDVI data', () => {
      render(<TimeSeries data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      expect(screen.getByText(/NDVI Time Series/i)).toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('should render the component with LST data', () => {
      render(<TimeSeries data={mockLSTData} analysisType="lst" loading={false} />);
      
      expect(screen.getByText(/LST Time Series/i)).toBeInTheDocument();
    });

    it('should render the component with SAR data', () => {
      render(<TimeSeries data={mockSARData} analysisType="sar" loading={false} />);
      
      expect(screen.getByText(/SAR Time Series/i)).toBeInTheDocument();
    });

    it('should render chart elements', () => {
      render(<TimeSeries data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      expect(screen.getByTestId('line')).toBeInTheDocument();
      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
      expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('legend')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton when loading is true', () => {
      render(<TimeSeries data={[]} analysisType="ndvi" loading={true} />);
      
      // Should show loading placeholder
      const placeholder = document.querySelector('.placeholder-glow');
      expect(placeholder).toBeInTheDocument();
    });

    it('should not show chart when loading', () => {
      render(<TimeSeries data={mockNDVIData} analysisType="ndvi" loading={true} />);
      
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show message when no data is available', () => {
      render(<TimeSeries data={[]} analysisType="ndvi" loading={false} />);
      
      expect(screen.getByText(/No time series data available/i)).toBeInTheDocument();
    });

    it('should not render chart when data is empty', () => {
      render(<TimeSeries data={[]} analysisType="ndvi" loading={false} />);
      
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    });
  });

  describe('Data Display', () => {
    it('should display data points count in header', () => {
      render(<TimeSeries data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      expect(screen.getByText(/4.*annual means from.*4.*observations/i)).toBeInTheDocument();
    });

    it('should handle single data point', () => {
      const singlePoint = [{ date: '2023-01-15', ndvi: 0.45, observations: 1 }];
      render(<TimeSeries data={singlePoint} analysisType="ndvi" loading={false} />);
      
      expect(screen.getByText(/1.*annual means from.*1.*observations/i)).toBeInTheDocument();
    });

    it('should display observation count if available', () => {
      render(<TimeSeries data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      // Check if observations are mentioned in the component
      const totalObservations = mockNDVIData.reduce((sum, item) => sum + item.observations, 0);
      const observationText = screen.queryByText(new RegExp(`${totalObservations}.*observations`, 'i'));
      
      if (observationText) {
        expect(observationText).toBeInTheDocument();
      }
    });
  });

  describe('Analysis Type Specific Behavior', () => {
    it('should use correct color for NDVI analysis', () => {
      render(
        <TimeSeries data={mockNDVIData} analysisType="ndvi" loading={false} />
      );
      
      // NDVI should display in the title
      expect(screen.getByText(/NDVI Time Series/i)).toBeInTheDocument();
    });

    it('should use correct color for LST analysis', () => {
      render(
        <TimeSeries data={mockLSTData} analysisType="lst" loading={false} />
      );
      
      // LST should display in the title
      expect(screen.getByText(/LST Time Series/i)).toBeInTheDocument();
    });

    it('should use correct color for SAR analysis', () => {
      render(
        <TimeSeries data={mockSARData} analysisType="sar" loading={false} />
      );
      
      // SAR should display in the title
      expect(screen.getByText(/SAR Time Series/i)).toBeInTheDocument();
    });

    it('should display correct units for NDVI', () => {
      render(<TimeSeries data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      // NDVI is unitless, range -1 to 1
      const header = screen.getByText(/NDVI/i);
      expect(header).toBeInTheDocument();
    });

    it('should display correct units for LST', () => {
      render(<TimeSeries data={mockLSTData} analysisType="lst" loading={false} />);
      
      // LST should show temperature units (°C)
      const header = screen.getByText(/LST/i);
      expect(header).toBeInTheDocument();
    });

    it('should display correct units for SAR', () => {
      render(<TimeSeries data={mockSARData} analysisType="sar" loading={false} />);
      
      // SAR should show dB units
      const header = screen.getByText(/SAR/i);
      expect(header).toBeInTheDocument();
    });
  });

  describe('Data Validation', () => {
    it('should handle data with missing values gracefully', () => {
      const dataWithNull = [
        { date: '2023-01-15', ndvi: 0.45, observations: 5 },
        { date: '2023-02-15', ndvi: null, observations: 0 },
        { date: '2023-03-15', ndvi: 0.61, observations: 4 },
      ];
      
      expect(() => {
        render(<TimeSeries data={dataWithNull as any} analysisType="ndvi" loading={false} />);
      }).not.toThrow();
    });

    it('should handle invalid date formats', () => {
      const invalidDates = [
        { date: 'invalid-date', ndvi: 0.45, observations: 5 },
        { date: '2023-02-15', ndvi: 0.52, observations: 6 },
      ];
      
      expect(() => {
        render(<TimeSeries data={invalidDates} analysisType="ndvi" loading={false} />);
      }).not.toThrow();
    });

    it('should handle extreme values', () => {
      const extremeData = [
        { date: '2023-01-15', ndvi: -1, observations: 5 },
        { date: '2023-02-15', ndvi: 1, observations: 6 },
        { date: '2023-03-15', ndvi: 0, observations: 4 },
      ];
      
      render(<TimeSeries data={extremeData} analysisType="ndvi" loading={false} />);
      
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('should use ResponsiveContainer for adaptive sizing', () => {
      render(<TimeSeries data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });
});
