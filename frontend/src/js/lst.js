// LST (Land Surface Temperature) Analysis Module

/**
 * Generate LST data table HTML
 */
function generateLSTTable(response) {
    if (!response.data || response.data.length === 0) {
        return '';
    }

    return `<div class="row data-table-section">
        <div class="col-12">
            <h5><i class="fas fa-table me-2"></i>LST Data Table</h5>
            ${createDownloadButtons(response.csv_url, response.plot_url)}
            <div class="table-responsive mt-3">
                <table class="table table-striped table-hover" id="lst-table">
                    <thead class="table-dark">
                        <tr>
                            <th>Date</th>
                            <th>Image ID</th>
                            <th>DoY</th>
                            <th>LST (°C)</th>
                            <th>Temperature Category</th>
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
                                <td>${row.lst ? row.lst.toFixed(2) : 'N/A'}</td>
                                <td>${row.lst_category || 'N/A'}</td>
                                <td>${row.original_cloud_cover !== undefined && row.original_cloud_cover !== 'N/A' ? 
                                    (typeof row.original_cloud_cover === 'number' ? row.original_cloud_cover.toFixed(1) : row.original_cloud_cover) : 'N/A'}</td>
                                <td>${row.effective_cloud_cover !== undefined && row.effective_cloud_cover !== 'N/A' ? 
                                    (typeof row.effective_cloud_cover === 'number' ? row.effective_cloud_cover.toFixed(1) : row.effective_cloud_cover) : 'N/A'}</td>
                                <td><span class="badge ${row.cloud_masking_applied ? 'bg-success' : 'bg-secondary'}">${row.cloud_masking_applied ? 'Yes' : 'No'}</span></td>
                            </tr>
                        `).join('')}
                        ${response.data.length > 20 ? `
                            <tr>
                                <td colspan="8" class="text-center text-muted">
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
 * Generate LST statistics HTML
 */
function generateLSTStats(stats) {
    if (!stats) {
        return '<p class="text-muted">No statistics available</p>';
    }

    let statsHTML = '';
    Object.entries(stats).forEach(([key, value]) => {
        const formattedValue = typeof value === 'number' ? value.toFixed(4) : value;
        statsHTML += `<div class="d-flex justify-content-between mb-1">
            <span>${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span>
            <strong>${formattedValue}</strong>
        </div>`;
    });
    return statsHTML;
}

/**
 * Check if response is LST analysis
 */
function isLSTAnalysis(responseAnalysisType) {
    return responseAnalysisType === 'lst' || responseAnalysisType === 'LST';
}
