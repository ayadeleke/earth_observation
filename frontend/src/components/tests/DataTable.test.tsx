/* eslint-disable testing-library/no-node-access */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DataTable from '../analysis/DataTable';

describe('DataTable Component', () => {
  const mockNDVIData = [
    {
      date: '2023-01-15',
      imageId: 'LANDSAT_8_C2_L2_SR_123',
      ndviValue: 0.45,
      originalCloudCover: 15.2,
      adjustedCloudCover: 10.5,
      cloudMaskingApplied: true,
    },
    {
      date: '2023-02-15',
      imageId: 'LANDSAT_8_C2_L2_SR_124',
      ndviValue: 0.52,
      originalCloudCover: 8.3,
      adjustedCloudCover: 5.1,
      cloudMaskingApplied: true,
    },
    {
      date: '2023-03-15',
      imageId: 'LANDSAT_8_C2_L2_SR_125',
      ndviValue: 0.61,
      originalCloudCover: 22.7,
      adjustedCloudCover: 18.9,
      cloudMaskingApplied: false,
    },
  ];

  const mockLSTData = [
    {
      date: '2023-01-15',
      imageId: 'LANDSAT_8_C2_L2_SR_123',
      lstValue: 25.3,
      originalCloudCover: 15.2,
      adjustedCloudCover: 10.5,
      cloudMaskingApplied: true,
    },
    {
      date: '2023-02-15',
      imageId: 'LANDSAT_8_C2_L2_SR_124',
      lstValue: 27.8,
      originalCloudCover: 8.3,
      adjustedCloudCover: 5.1,
      cloudMaskingApplied: true,
    },
  ];

  const mockSARData = [
    {
      date: '2023-01-15',
      imageId: 'SENTINEL1_A_IW_GRD_123',
      backscatterValue: -12.5,
      backscatterVH: -18.3,
      vvVhRatio: 0.68,
      orbitDirection: 'ASCENDING',
      originalCloudCover: 0,
      adjustedCloudCover: 0,
      cloudMaskingApplied: false,
    },
    {
      date: '2023-02-15',
      imageId: 'SENTINEL1_A_IW_GRD_124',
      backscatterValue: -11.8,
      backscatterVH: -17.9,
      vvVhRatio: 0.66,
      orbitDirection: 'DESCENDING',
      originalCloudCover: 0,
      adjustedCloudCover: 0,
      cloudMaskingApplied: false,
    },
  ];

  describe('Rendering', () => {
    it('should render the table with NDVI data', () => {
      render(<DataTable data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      expect(screen.getByText(/NDVI Individual Observations/i)).toBeInTheDocument();
      expect(screen.getByText(/Image ID/i)).toBeInTheDocument();
      expect(screen.getByText(/NDVI Value/i)).toBeInTheDocument();
    });

    it('should render the table with LST data', () => {
      render(<DataTable data={mockLSTData} analysisType="lst" loading={false} />);
      
      expect(screen.getByText(/LST Individual Observations/i)).toBeInTheDocument();
      expect(screen.getByText(/LST Value/i)).toBeInTheDocument();
    });

    it('should render the table with SAR data', () => {
      render(<DataTable data={mockSARData} analysisType="sar" loading={false} />);
      
      expect(screen.getByText(/SAR Individual Observations/i)).toBeInTheDocument();
      expect(screen.getByText(/Backscatter VV/i)).toBeInTheDocument();
      expect(screen.getByText(/Backscatter VH/i)).toBeInTheDocument();
      expect(screen.getByText(/Orbit Direction/i)).toBeInTheDocument();
    });

    it('should display correct number of data rows', () => {
      render(<DataTable data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      const rows = screen.getAllByRole('row');
      // +1 for header row
      expect(rows).toHaveLength(mockNDVIData.length + 1);
    });

    it('should show data count in header', () => {
      render(<DataTable data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      expect(screen.getByText(/3.*of.*3/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading skeletons when loading is true', () => {
      render(<DataTable data={[]} analysisType="ndvi" loading={true} />);
      
      // Should show placeholder rows
      const placeholder = document.querySelector('.placeholder-glow');
      expect(placeholder).toBeInTheDocument();
    });

    it('should not show data table when loading', () => {
      render(<DataTable data={mockNDVIData} analysisType="ndvi" loading={true} />);
      
      expect(screen.queryByText(mockNDVIData[0].imageId)).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show message when no data is available', () => {
      render(<DataTable data={[]} analysisType="ndvi" loading={false} />);
      
      expect(screen.getByText(/No data available/i)).toBeInTheDocument();
    });

    it('should display helper text in empty state', () => {
      render(<DataTable data={[]} analysisType="ndvi" loading={false} />);
      
      expect(screen.getByText(/Data will appear here after analysis/i)).toBeInTheDocument();
    });
  });

  describe('Sorting Functionality', () => {
    it('should have sortable column headers', () => {
      render(<DataTable data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      const dateHeader = screen.getByText('Date');
      expect(dateHeader).toBeInTheDocument();
      
      // Column headers should be clickable for sorting
      const headerCells = screen.getAllByRole('columnheader');
      expect(headerCells.length).toBeGreaterThan(0);
    });

    it('should sort data when column header is clicked', () => {
      render(<DataTable data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      const dateHeader = screen.getByText('Date');
      fireEvent.click(dateHeader);
      
      // Verify sort indicator appears
      const sortIcon = screen.getByText('↑') || screen.getByText('↓');
      expect(sortIcon).toBeInTheDocument();
    });

    it('should toggle sort direction on repeated clicks', () => {
      render(<DataTable data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      const dateHeader = screen.getByText('Date');
      
      // First click - ascending
      fireEvent.click(dateHeader);
      expect(screen.getByText('↑')).toBeInTheDocument();
      
      // Second click - descending
      fireEvent.click(dateHeader);
      expect(screen.getByText('↓')).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    const largeMockData = Array.from({ length: 25 }, (_, i) => ({
      date: `2023-${String(i + 1).padStart(2, '0')}-15`,
      imageId: `LANDSAT_8_C2_L2_SR_${100 + i}`,
      ndviValue: 0.3 + (i * 0.01),
      originalCloudCover: 10 + i,
      adjustedCloudCover: 5 + i,
      cloudMaskingApplied: i % 2 === 0,
    }));

    it('should show pagination controls for large datasets', () => {
      render(<DataTable data={largeMockData} analysisType="ndvi" loading={false} />);
      
      expect(screen.getByText(/Page.*of/i)).toBeInTheDocument();
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    it('should display first 10 items by default', () => {
      render(<DataTable data={largeMockData} analysisType="ndvi" loading={false} />);
      
      const rows = screen.getAllByRole('row');
      // 10 data rows + 1 header row
      expect(rows).toHaveLength(11);
    });

    it('should disable Previous button on first page', () => {
      render(<DataTable data={largeMockData} analysisType="ndvi" loading={false} />);
      
      const previousButton = screen.getByText('Previous');
      expect(previousButton).toBeDisabled();
    });

    it('should navigate to next page when Next button is clicked', () => {
      render(<DataTable data={largeMockData} analysisType="ndvi" loading={false} />);
      
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      
      expect(screen.getByText(/Page 2 of/i)).toBeInTheDocument();
    });

    it('should disable Next button on last page', () => {
      render(<DataTable data={largeMockData} analysisType="ndvi" loading={false} />);
      
      // Navigate to last page
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton); // Page 2
      fireEvent.click(nextButton); // Page 3
      
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Data Formatting', () => {
    it('should format NDVI values to 4 decimal places', () => {
      render(<DataTable data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      expect(screen.getByText('0.4500')).toBeInTheDocument();
      expect(screen.getByText('0.5200')).toBeInTheDocument();
    });

    it('should format cloud cover to 1 decimal place', () => {
      render(<DataTable data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      expect(screen.getByText('15.2')).toBeInTheDocument();
      expect(screen.getByText('8.3')).toBeInTheDocument();
    });

    it('should display dates in localized format', () => {
      render(<DataTable data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      // Check if dates are displayed (format is day/month/year based on test output)
      const dateCells = screen.getAllByText(/15\/01\/2023|15\/02\/2023|15\/03\/2023/);
      expect(dateCells.length).toBeGreaterThan(0);
    });

    it('should display N/A for missing values', () => {
      const dataWithMissing = [
        {
          date: '2023-01-15',
          imageId: 'LANDSAT_8_C2_L2_SR_123',
          ndviValue: undefined,
          originalCloudCover: 15.2,
          adjustedCloudCover: 10.5,
          cloudMaskingApplied: true,
        },
      ];
      
      render(<DataTable data={dataWithMissing} analysisType="ndvi" loading={false} />);
      
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });

  describe('SAR-Specific Features', () => {
    it('should display orbit direction badges for SAR data', () => {
      render(<DataTable data={mockSARData} analysisType="sar" loading={false} />);
      
      expect(screen.getByText('ASCENDING')).toBeInTheDocument();
      expect(screen.getByText('DESCENDING')).toBeInTheDocument();
    });

    it('should style ASCENDING orbit with success badge', () => {
      render(<DataTable data={mockSARData} analysisType="sar" loading={false} />);
      
      const ascendingBadge = screen.getByText('ASCENDING');
      expect(ascendingBadge).toHaveClass('bg-success');
    });

    it('should display VV/VH ratio with correct precision', () => {
      render(<DataTable data={mockSARData} analysisType="sar" loading={false} />);
      
      expect(screen.getByText('0.680')).toBeInTheDocument();
      expect(screen.getByText('0.660')).toBeInTheDocument();
    });
  });

  describe('NDVI-Specific Features', () => {
    it('should display cloud masking status', () => {
      render(<DataTable data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      const yesBadges = screen.getAllByText('Yes');
      const noBadges = screen.getAllByText('No');
      
      expect(yesBadges.length).toBe(2); // 2 with cloud masking applied
      expect(noBadges.length).toBe(1);  // 1 without
    });

    it('should style Yes cloud masking with success badge', () => {
      render(<DataTable data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      const yesBadges = screen.getAllByText('Yes');
      yesBadges.forEach(badge => {
        expect(badge).toHaveClass('bg-success');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      render(<DataTable data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should have table headers', () => {
      render(<DataTable data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      const headers = screen.getAllByRole('columnheader');
      expect(headers.length).toBeGreaterThan(0);
    });

    it('should have proper row structure', () => {
      render(<DataTable data={mockNDVIData} analysisType="ndvi" loading={false} />);
      
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(1); // At least header + 1 data row
    });
  });
});
