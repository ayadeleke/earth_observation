import React from 'react';
import { render, screen } from '@testing-library/react';
import { ShapefileUpload } from '../upload/ShapefileUpload';

// Mock react-dropzone with a simple div
jest.mock('react-dropzone', () => ({
  useDropzone: () => ({
    getRootProps: () => ({ 'data-testid': 'dropzone' }),
    getInputProps: () => ({ 'data-testid': 'dropzone-input' }),
    isDragActive: false
  })
}));

describe('ShapefileUpload Component', () => {
  const mockOnFileUpload = jest.fn();
  const mockOnCoordinatesExtracted = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(
        <ShapefileUpload
          onFileUpload={mockOnFileUpload}
          onCoordinatesExtracted={mockOnCoordinatesExtracted}
        />
      );
      
      const elements = screen.getAllByText(/Upload|Shapefile|drag|drop/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('renders dropzone area', () => {
      render(
        <ShapefileUpload
          onFileUpload={mockOnFileUpload}
          onCoordinatesExtracted={mockOnCoordinatesExtracted}
        />
      );
      
      expect(screen.getByTestId('dropzone')).toBeInTheDocument();
    });

    it('renders file input', () => {
      render(
        <ShapefileUpload
          onFileUpload={mockOnFileUpload}
          onCoordinatesExtracted={mockOnCoordinatesExtracted}
        />
      );
      
      expect(screen.getByTestId('dropzone-input')).toBeInTheDocument();
    });

    it('renders upload instructions', () => {
      render(
        <ShapefileUpload
          onFileUpload={mockOnFileUpload}
          onCoordinatesExtracted={mockOnCoordinatesExtracted}
        />
      );
      
      // Should have some upload-related text
      const elements = screen.getAllByText(/Upload|Shapefile|drag|drop|ZIP/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('renders component structure', () => {
      render(
        <ShapefileUpload
          onFileUpload={mockOnFileUpload}
          onCoordinatesExtracted={mockOnCoordinatesExtracted}
        />
      );
      
      // Component should render successfully
      expect(screen.getByTestId('dropzone')).toBeInTheDocument();
    });
  });
});
