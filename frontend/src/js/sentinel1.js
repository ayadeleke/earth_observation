// Sentinel-1 SAR Analysis Module

/**
 * Generate Sentinel-1 data table HTML
 */
function generateSentinel1Table(response) {
    if (!response.data || response.data.length === 0) {
        return '';
    }

    return `<div class="row data-table-section">
        <div class="col-12">
            <h5><i class="fas fa-table me-2"></i>Sentinel-1 Data Table</h5>
            ${createDownloadButtons(response.csv_url, response.plot_url)}
            <div class="table-responsive mt-3">
                <table class="table table-striped table-hover" id="sentinel1-table">
                    <thead class="table-dark">
                        <tr>
                            <th>Date</th>
                            <th>Backscatter (dB)</th>
                            <th>Orbit Direction</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${response.data.slice(0, 20).map(row => `
                            <tr>
                                <td>${row.date}</td>
                                <td>${row.backscatter ? row.backscatter.toFixed(2) : 'N/A'}</td>
                                <td>${row.orbit_direction || 'N/A'}</td>
                            </tr>
                        `).join('')}
                        ${response.data.length > 20 ? `
                            <tr>
                                <td colspan="3" class="text-center text-muted">
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
 * Generate Sentinel-1 statistics HTML
 */
function generateSentinel1Stats(stats) {
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
 * Check if response is Sentinel-1 analysis
 */
function isSentinel1Analysis(responseAnalysisType) {
    return responseAnalysisType === 'Sentinel-1' || 
           responseAnalysisType === 'sentinel1' || 
           responseAnalysisType === 'backscatter';
}
