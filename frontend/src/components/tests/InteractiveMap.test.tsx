import React from 'react';
import { render, screen } from '@testing-library/react';
import { InteractiveMap } from '../analysis/InteractiveMap';

// Simple mock for leaflet  
jest.mock('leaflet', () => {
  const Control = function(this: any) {
    this.onAdd = jest.fn();
    this.addTo = jest.fn().mockReturnThis();
    this.remove = jest.fn();
    return this;
  };
  
  return {
    map: jest.fn(),
    tileLayer: jest.fn(),
    marker: jest.fn(),
    icon: jest.fn(),
    divIcon: jest.fn(),
    geoJSON: jest.fn(() => ({
      addTo: jest.fn(),
      remove: jest.fn(),
      getBounds: jest.fn(() => ({
        isValid: jest.fn(() => true)
      }))
    })),
    Control,
    DomUtil: {
      create: jest.fn(() => ({ 
        style: { cssText: '' },
        innerHTML: ''
      }))
    }
  };
});

// Simple mock for react-leaflet
jest.mock('react-leaflet', () => {
  const LayersControl = ({ children }: any) => <div data-testid="layers-control">{children}</div>;
  (LayersControl as any).BaseLayer = ({ children }: any) => <div data-testid="base-layer">{children}</div>;
  (LayersControl as any).Overlay = ({ children }: any) => <div data-testid="overlay-layer">{children}</div>;
  
  return {
    MapContainer: ({ children, ...props }: any) => <div data-testid="map-container" {...props}>{children}</div>,
    TileLayer: () => <div data-testid="tile-layer" />,
    LayersControl,
    FeatureGroup: ({ children }: any) => <div data-testid="feature-group">{children}</div>,
    Marker: () => <div data-testid="marker" />,
    Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
    GeoJSON: () => <div data-testid="geojson" />,
    useMap: () => {
      const mockMap: any = {
        setView: jest.fn(),
        fitBounds: jest.fn()
      };
      return mockMap;
    }
  };
});

// Mock the AnalysisMapLayer component
jest.mock('../map/AnalysisMapLayer', () => ({
  AnalysisMapLayer: () => <div data-testid="analysis-layer" />
}));

const defaultProps = {
  analysisType: 'ndvi',
  satellite: 'sentinel2',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  cloudCover: 20
};

describe('InteractiveMap Component', () => {
  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<InteractiveMap {...defaultProps} />);
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('renders map container', () => {
      render(<InteractiveMap {...defaultProps} />);
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('renders layers control', () => {
      render(<InteractiveMap {...defaultProps} />);
      expect(screen.getByTestId('layers-control')).toBeInTheDocument();
    });

    it('renders with geometry', () => {
      const geometry = {
        type: 'Polygon',
        coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
      };
      
      render(<InteractiveMap {...defaultProps} geometry={geometry} />);
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('renders with different analysis types', () => {
      render(<InteractiveMap {...defaultProps} analysisType="lst" />);
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });
});
