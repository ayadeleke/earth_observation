import React, { useState, useMemo } from 'react';
import { ArrowDownWideNarrow } from 'lucide-react';

interface DataRow {
  date: string;
  imageId: string;
  ndviValue?: number;
  lstValue?: number;
  backscatterValue?: number;
  originalCloudCover: number;
  adjustedCloudCover: number;
  cloudMaskingApplied: boolean;
  [key: string]: any;
}

interface DataTableProps {
  data?: DataRow[];
  analysisType?: string;
  loading?: boolean;
}

export const DataTable: React.FC<DataTableProps> = ({
  data,
  analysisType = 'ndvi',
  loading = false
}) => {

  React.useEffect(() => {
    if (data && data.length > 0) {

    }
  }, [data]);

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const sortedData = useMemo(() => {
    if (!data) return [];
    
    let sortableData = [...data];
    if (sortConfig) {
      sortableData.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableData;
  }, [data, sortConfig]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage]);

  const totalPages = Math.ceil((data?.length || 0) / itemsPerPage);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getValueColumn = () => {
    switch (analysisType.toLowerCase()) {
      case 'lst': return { key: 'lstValue', label: 'LST Value', unit: '°C' };
      case 'backscatter':
      case 'sar': return { key: 'backscatterValue', label: 'Backscatter VV', unit: 'dB' };
      default: return { key: 'ndviValue', label: 'NDVI Value', unit: '' };
    }
  };

  const valueColumn = getValueColumn();

  const formatValue = (value: number | undefined, precision = 4) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toFixed(precision);
  };

  if (loading) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white">
          <h3 className="h5 fw-semibold mb-0">📋 {analysisType.toUpperCase()} Data Table</h3>
        </div>
        <div className="card-body">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-light rounded mb-2" style={{ height: '3rem' }}>
              <div className="placeholder-glow">
                <span className="placeholder col-12" style={{ height: '3rem' }}></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white">
          <h3 className="h5 fw-semibold mb-0">📋 {analysisType.toUpperCase()} Data Table</h3>
        </div>
        <div className="card-body text-center py-5">
          <div className="h5 text-muted">No data available</div>
          <div className="small text-muted mt-2">Data will appear here after analysis</div>
        </div>
      </div>
    );
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (!sortConfig || sortConfig.key !== column) {
      return (
    <ArrowDownWideNarrow />
  );
    }
    return (
      <span className="text-primary">
        {sortConfig.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  return (
    <div className="card border-0 shadow-sm mb-2 mt-4">
      <div className="card-header bg-white">
        <h3 className="h5 fw-semibold text-dark mb-1">{analysisType.toUpperCase()} Data Table</h3>
        <div className="small text-muted">
          Showing {paginatedData.length} of {data.length} observations
        </div>
      </div>
      
      <div className="table-responsive">
        <table className="table table-hover mb-0">
          <thead className="table-light">
            <tr>
              <th 
                className="px-3 py-2 text-start small fw-medium text-muted text-uppercase" 
                style={{ cursor: 'pointer' }}
                onClick={() => handleSort('date')}
              >
                <div className="d-flex align-items-center gap-1">
                  <span>Date</span>
                  <SortIcon column="date" />
                </div>
              </th>
              <th 
                className="px-3 py-2 text-start small fw-medium text-muted text-uppercase" 
                style={{ cursor: 'pointer' }}
                onClick={() => handleSort('imageId')}
              >
                <div className="d-flex align-items-center gap-1">
                  <span>Image ID</span>
                  <SortIcon column="imageId" />
                </div>
              </th>
              <th className="px-3 py-2 text-start small fw-medium text-muted text-uppercase">
                DoY
              </th>
              <th 
                className="px-3 py-2 text-start small fw-medium text-muted text-uppercase" 
                style={{ cursor: 'pointer' }}
                onClick={() => handleSort(valueColumn.key)}
              >
                <div className="d-flex align-items-center gap-1">
                  <span>{valueColumn.label}</span>
                  <SortIcon column={valueColumn.key} />
                </div>
              </th>
              {(analysisType.toLowerCase() === 'sar' || analysisType.toLowerCase() === 'backscatter') ? (
                <>
                  <th 
                    className="px-3 py-2 text-start small fw-medium text-muted text-uppercase" 
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleSort('backscatterVH')}
                  >
                    <div className="d-flex align-items-center gap-1">
                      <span>Backscatter VH</span>
                      <SortIcon column="backscatterVH" />
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-start small fw-medium text-muted text-uppercase" 
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleSort('vvVhRatio')}
                  >
                    <div className="d-flex align-items-center gap-1">
                      <span>VV/VH Ratio</span>
                      <SortIcon column="vvVhRatio" />
                    </div>
                  </th>
                  <th className="px-3 py-2 text-start small fw-medium text-muted text-uppercase">
                    Orbit Direction
                  </th>
                </>
              ) : (
                <>
                  <th className="px-3 py-2 text-start small fw-medium text-muted text-uppercase">
                    Original Cloud Cover (%)
                  </th>
                  <th className="px-3 py-2 text-start small fw-medium text-muted text-uppercase">
                    Adjusted Cloud Cover (%)
                  </th>
                  <th className="px-3 py-2 text-start small fw-medium text-muted text-uppercase">
                    Cloud Masking Applied
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, index) => {
              // Calculate day of year (1-366)
              const date = new Date(row.date);
              const start = new Date(date.getFullYear(), 0, 0);
              const diff = date.getTime() - start.getTime();
              const oneDay = 1000 * 60 * 60 * 24;
              const dayOfYear = Math.floor(diff / oneDay);
              
              const value = row[valueColumn.key];
              
              return (
                <tr key={index}>
                  <td className="px-3 py-2 small text-primary fw-medium">
                    {new Date(row.date).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 small text-muted font-monospace">
                    {row.imageId}
                  </td>
                  <td className="px-3 py-2 small text-dark">
                    {dayOfYear}
                  </td>
                  <td className="px-3 py-2 small fw-semibold">
                    <span className={`${
                      analysisType === 'ndvi' ? 'text-success' :
                      analysisType === 'lst' ? 'text-danger' :
                      'text-dark'
                    }`}>
                      {formatValue(value)} {valueColumn.unit}
                    </span>
                  </td>
                  {(analysisType.toLowerCase() === 'sar' || analysisType.toLowerCase() === 'backscatter') ? (
                    <>
                      <td className="px-3 py-2 small fw-semibold">
                        <span className="text-dark">
                          {formatValue(row.backscatterVH)} dB
                        </span>
                      </td>
                      <td className="px-3 py-2 small text-dark">
                        {formatValue(row.vvVhRatio, 3)}
                      </td>
                      <td className="px-3 py-2 small">
                        <span className={`badge ${
                          row.orbitDirection === 'ASCENDING' 
                            ? 'bg-success' 
                            : 'bg-secondary'
                        }`}>
                          {row.orbitDirection || 'N/A'}
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 small text-muted">
                        {formatValue(row.originalCloudCover, 1)}
                      </td>
                      <td className="px-3 py-2 small text-muted">
                        {formatValue(row.adjustedCloudCover, 1)}
                      </td>
                      <td className="px-3 py-2 small">
                        <span className={`badge ${
                          row.cloudMaskingApplied 
                            ? 'bg-success' 
                            : 'bg-light text-dark'
                        }`}>
                          {row.cloudMaskingApplied ? 'Yes' : 'No'}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="card-footer bg-white d-flex justify-content-between align-items-center">
          <div className="small text-muted">
            Page {currentPage} of {totalPages}
          </div>
          <div className="d-flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="btn btn-sm btn-outline-secondary"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="btn btn-sm btn-outline-secondary"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;