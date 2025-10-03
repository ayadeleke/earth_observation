import React, { useState, useMemo } from 'react';

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
  // DEBUG: Log the actual data structure being received
  React.useEffect(() => {
    if (data && data.length > 0) {
      console.log('🔍 DataTable DEBUG - First data item received:', data[0]);
      console.log('🔍 DataTable DEBUG - originalCloudCover:', data[0].originalCloudCover);
      console.log('🔍 DataTable DEBUG - adjustedCloudCover:', data[0].adjustedCloudCover);
      console.log('🔍 DataTable DEBUG - cloudMaskingApplied:', data[0].cloudMaskingApplied);
      console.log('🔍 DataTable DEBUG - All available fields:', Object.keys(data[0]));
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
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">📋 {analysisType.toUpperCase()} Data Table</h3>
        </div>
        <div className="animate-pulse p-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded mb-2"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">📋 {analysisType.toUpperCase()} Data Table</h3>
        </div>
        <div className="p-8 text-center text-gray-400">
          <div className="text-lg">No data available</div>
          <div className="text-sm mt-2">Data will appear here after analysis</div>
        </div>
      </div>
    );
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (!sortConfig || sortConfig.key !== column) {
      return <span className="text-gray-400">↕️</span>;
    }
    return (
      <span className="text-blue-600">
        {sortConfig.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">📋 {analysisType.toUpperCase()} Data Table</h3>
        <div className="text-sm text-gray-600 mt-1">
          Showing {paginatedData.length} of {data.length} observations
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('date')}
              >
                <div className="flex items-center space-x-1">
                  <span>Date</span>
                  <SortIcon column="date" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('imageId')}
              >
                <div className="flex items-center space-x-1">
                  <span>Image ID</span>
                  <SortIcon column="imageId" />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                DoY
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort(valueColumn.key)}
              >
                <div className="flex items-center space-x-1">
                  <span>{valueColumn.label}</span>
                  <SortIcon column={valueColumn.key} />
                </div>
              </th>
              {(analysisType.toLowerCase() === 'sar' || analysisType.toLowerCase() === 'backscatter') ? (
                <>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('backscatterVH')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Backscatter VH</span>
                      <SortIcon column="backscatterVH" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('vvVhRatio')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>VV/VH Ratio</span>
                      <SortIcon column="vvVhRatio" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Orbit Direction
                  </th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Original Cloud Cover (%)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Adjusted Cloud Cover (%)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cloud Masking Applied
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedData.map((row, index) => {
              const dayOfYear = new Date(row.date).getDate();
              const value = row[valueColumn.key];
              
              return (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-blue-600 font-medium">
                    {new Date(row.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 font-mono">
                    {row.imageId}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {dayOfYear}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold">
                    <span className={`${
                      analysisType === 'ndvi' ? 'text-green-600' :
                      analysisType === 'lst' ? 'text-red-600' :
                      'text-teal-600'
                    }`}>
                      {formatValue(value)}
                    </span>
                  </td>
                  {(analysisType.toLowerCase() === 'sar' || analysisType.toLowerCase() === 'backscatter') ? (
                    <>
                      <td className="px-4 py-3 text-sm font-semibold">
                        <span className="text-cyan-600">
                          {formatValue(row.backscatterVH)} dB
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {formatValue(row.vvVhRatio, 3)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          row.orbitDirection === 'ASCENDING' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {row.orbitDirection || 'N/A'}
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatValue(row.originalCloudCover, 1)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatValue(row.adjustedCloudCover, 1)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          row.cloudMaskingApplied 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
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
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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