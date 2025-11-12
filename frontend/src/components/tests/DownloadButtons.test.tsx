import React from 'react';
import { render, screen } from '@testing-library/react';
import { DownloadButtons } from '../analysis/DownloadButtons';

const mockData = {
  tableData: [
    { date: '2024-01-01', value: 0.5 },
    { date: '2024-01-02', value: 0.6 }
  ]
};

describe('DownloadButtons Component', () => {
  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<DownloadButtons data={mockData} />);
      const elements = screen.getAllByText(/CSV/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('renders CSV download button', () => {
      render(<DownloadButtons data={mockData} />);
      const elements = screen.getAllByText(/CSV/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('renders plot download button', () => {
      render(<DownloadButtons data={mockData} />);
      const elements = screen.getAllByText(/Plot/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('renders with empty data without crashing', () => {
      render(<DownloadButtons data={null} />);
      const elements = screen.getAllByText(/CSV/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('renders without data prop', () => {
      render(<DownloadButtons />);
      const elements = screen.getAllByText(/CSV/i);
      expect(elements.length).toBeGreaterThan(0);
    });
  });
});
