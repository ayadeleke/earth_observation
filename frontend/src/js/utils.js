// Earth Observation Analysis - Utility Functions

/**
 * Show error/info messages to user
 */
function showError(message, type = 'warning') {
    let alertClass = 'alert-warning';
    let iconClass = 'fas fa-exclamation-triangle';
    
    if (type === 'info') {
        alertClass = 'alert-info';
        iconClass = 'fas fa-info-circle';
    } else if (type === 'danger') {
        alertClass = 'alert-danger';
        iconClass = 'fas fa-exclamation-triangle';
    } else if (type === 'success') {
        alertClass = 'alert-success';
        iconClass = 'fas fa-check-circle';
    }
    
    $('#errorDiv').html(
        `<div class="alert ${alertClass} alert-dismissible fade show" role="alert">
            <i class="${iconClass} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>`
    );
}

/**
 * Download table data as CSV
 */
function downloadTableAsCSV(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) {
        showError('Table not found for CSV download', 'danger');
        return;
    }
    
    let csv = [];
    const rows = table.querySelectorAll('tr');
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cols = row.querySelectorAll('td, th');
        let csvRow = [];
        
        // Skip rows that are just "showing X of Y records" messages
        if (row.querySelector('td[colspan]') && row.textContent.includes('Showing first')) {
            continue;
        }
        
        for (let j = 0; j < cols.length; j++) {
            let cellText = cols[j].textContent.trim();
            // Handle cells that might contain commas
            if (cellText.includes(',')) {
                cellText = '"' + cellText + '"';
            }
            csvRow.push(cellText);
        }
        
        if (csvRow.length > 0) {
            csv.push(csvRow.join(','));
        }
    }
    
    // Create and download the CSV file
    const csvContent = csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showError('CSV file downloaded successfully!', 'success');
    } else {
        showError('CSV download not supported in this browser', 'danger');
    }
}

/**
 * Get analysis display name
 */
function getAnalysisDisplayName(analysisType) {
    const displayNames = {
        'ndvi': 'NDVI Time Series',
        'lst': 'Land Surface Temperature',
        'LST': 'Land Surface Temperature',
        'Sentinel-1': 'Sentinel-1 SAR Backscatter',
        'sentinel1': 'Sentinel-1 SAR Backscatter',
        'backscatter': 'SAR Backscatter'
    };
    return displayNames[analysisType] || 'Analysis Results';
}

/**
 * Create download buttons HTML
 */
function createDownloadButtons(csvUrl, plotUrl) {
    console.log('🔗 Creating download buttons:', { csvUrl, plotUrl });
    return `<div class="download-buttons">
        ${csvUrl ? `<a href="${csvUrl}" class="btn btn-success btn-sm" download>
            <i class="fas fa-download me-1"></i>Download CSV Data
        </a>` : ''}
        ${plotUrl ? `<a href="${plotUrl}" class="btn btn-primary btn-sm" download>
            <i class="fas fa-image me-1"></i>Download Plot
        </a>` : ''}
    </div>`;
}
