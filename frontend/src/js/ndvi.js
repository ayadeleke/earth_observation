// NDVI Analysis Module

/**
 * Generate NDVI data table HTML
 */
function generateNDVITable(response) {
    if (!response.data || response.data.length === 0) {
        return '';
    }

    return `<div class="row data-table-section">
        <div class="col-12">
            <h5><i class="fas fa-table me-2"></i>NDVI Data Table</h5>
            ${createDownloadButtons(response.csv_url, response.plot_url)}
            <div class="table-responsive mt-3">
                <table class="table table-striped table-hover" id="ndvi-table">
                    <thead class="table-dark">
                        <tr>
                            <th>Date</th>
                            <th>Image ID</th>
                            <th>DoY</th>
                            <th>NDVI Value</th>
                            <th>Original Cloud Cover (%)</th>
                            <th>Adjusted Cloud Cover (%)</th>
                            <th>Cloud Masking Applied</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${response.data.slice(0, 20).map(row => `
                            <tr>
                                <td>${row.date}</td>
                                <td><small class="text-muted font-monospace">${row.image_id || 'N/A'}</small></td>
                                <td>${row.doy || 'N/A'}</td>
                                <td>${row.ndvi ? row.ndvi.toFixed(4) : 'N/A'}</td>
                                <td>${row.original_cloud_cover !== undefined && row.original_cloud_cover !== 'N/A' ? 
                                    (typeof row.original_cloud_cover === 'number' ? row.original_cloud_cover.toFixed(1) : row.original_cloud_cover) : 'N/A'}</td>
                                <td>${row.effective_cloud_cover !== undefined && row.effective_cloud_cover !== 'N/A' ? 
                                    (typeof row.effective_cloud_cover === 'number' ? row.effective_cloud_cover.toFixed(1) : row.effective_cloud_cover) : 'N/A'}</td>
                                <td><span class="badge ${row.cloud_masking_applied ? 'bg-success' : 'bg-secondary'}">${row.cloud_masking_applied ? 'Yes' : 'No'}</span></td>
                            </tr>
                        `).join('')}
                        ${response.data.length > 20 ? `
                            <tr>
                                <td colspan="7" class="text-center text-muted">
                                    <i class="fas fa-ellipsis-h me-2"></i>
                                    Showing first 20 of ${response.data.length} records. 
                                    <strong>Full dataset available in CSV download above.</strong>
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;
}

/**
 * Generate NDVI statistics HTML
 */
function generateNDVIStats(stats) {
    if (!stats) {
        return '<p class="text-muted">No statistics available</p>';
    }

    return `<div class="row">
        <div class="col-6">
            <small class="text-muted">Mean NDVI</small>
            <div class="fw-bold">${stats.mean_ndvi?.toFixed(3) || 'N/A'}</div>
        </div>
        <div class="col-6">
            <small class="text-muted">Std Dev</small>
            <div class="fw-bold">${stats.std_ndvi?.toFixed(3) || 'N/A'}</div>
        </div>
        <div class="col-6 mt-2">
            <small class="text-muted">Min NDVI</small>
            <div class="fw-bold">${stats.min_ndvi?.toFixed(3) || 'N/A'}</div>
        </div>
        <div class="col-6 mt-2">
            <small class="text-muted">Max NDVI</small>
            <div class="fw-bold">${stats.max_ndvi?.toFixed(3) || 'N/A'}</div>
        </div>
        <div class="col-12 mt-2">
            <small class="text-muted">Observations</small>
            <div class="fw-bold">${stats.total_observations || 'N/A'}</div>
        </div>
        <div class="col-12 mt-2">
            <small class="text-muted">Date Range</small>
            <div class="fw-bold text-break" style="font-size: 0.85em;">${stats.date_range || 'N/A'}</div>
        </div>
    </div>`;
}

/**
 * Check if response is NDVI analysis
 */
function isNDVIAnalysis(responseAnalysisType) {
    return responseAnalysisType === 'ndvi' || 
           responseAnalysisType === 'NDVI' ||
           responseAnalysisType === 'NDVI (Sentinel-2)' ||
           (responseAnalysisType && responseAnalysisType.includes('NDVI')) ||
           !responseAnalysisType;
}
