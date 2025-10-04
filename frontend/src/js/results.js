// Results Display Module

/**
 * Main function to display analysis results
 */
function displayResults(response) {
    console.log('📊 Displaying results:', response);
    console.log('🗺️ Map URL:', response.map_url);
    console.log('🗺️ Fallback URL:', response.fallback_url);
    
    // Determine analysis type from response or form
    const responseAnalysisType = response.analysis_type || $('#analysisType').val();
    const isComprehensive = responseAnalysisType === 'Comprehensive' || responseAnalysisType === 'comprehensive';
    
    // Show results
    const resultsDiv = $('#results');
    let resultsHTML = '';
    
    if (isComprehensive && response.results) {
        resultsHTML = generateComprehensiveResults(response);
    } else {
        resultsHTML = generateSingleAnalysisResults(response, responseAnalysisType);
    }
    
    resultsDiv.html(resultsHTML);
    $('#resultsCard').show();
    
    // Scroll to results
    $('html, body').animate({
        scrollTop: $('#resultsCard').offset().top - 100
    }, 500);
}

/**
 * Generate comprehensive analysis results HTML
 */
function generateComprehensiveResults(response) {
    let resultsHTML = '<div class="row">';
    
    // Add demo mode alert if any result is in demo mode
    const anyDemoMode = response.results && Object.values(response.results).some(result => result.demo_mode);
    if (anyDemoMode) {
        resultsHTML += `<div class="col-12 mb-3">
            <div class="alert alert-warning alert-dismissible fade show" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Demo Mode:</strong> Some or all analyses are using demo data. Set up Earth Engine for real satellite analysis.
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        </div>`;
    }
    
    if (response.plot_urls && response.plot_urls.length > 0) {
        resultsHTML += '<div class="col-lg-8">';
        resultsHTML += '<h5><i class="fas fa-chart-line me-2"></i>Comprehensive Analysis Results</h5>';
        
        response.plot_urls.forEach((plotUrl, index) => {
            resultsHTML += `<div class="mb-3">
                <img src="${plotUrl}" class="img-fluid rounded shadow-sm" alt="Analysis Plot ${index + 1}" 
                     onload="console.log('🖼️ Image loaded successfully:', this.src)" 
                     onerror="console.error('❌ Image failed to load:', this.src)">
            </div>`;
        });
        
        resultsHTML += '<div class="mt-3">';
        response.plot_urls.forEach((plotUrl, index) => {
            resultsHTML += `<a href="${plotUrl}" class="btn btn-primary btn-sm me-2 mb-2" download>
                <i class="fas fa-image me-1"></i>Download Plot ${index + 1}
            </a>`;
        });
        resultsHTML += '</div></div>';
    }
    
    // Display statistics for each analysis type
    resultsHTML += '<div class="col-lg-4">';
    resultsHTML += '<h5><i class="fas fa-chart-bar me-2"></i>Analysis Statistics</h5>';
    
    Object.keys(response.results).forEach(analysisType => {
        const result = response.results[analysisType];
        if (result.statistics) {
            resultsHTML += `<div class="card mb-3">
                <div class="card-header">
                    <h6 class="mb-0">${analysisType.toUpperCase()} Statistics</h6>
                </div>
                <div class="card-body">`;
            
            Object.entries(result.statistics).forEach(([key, value]) => {
                const formattedValue = typeof value === 'number' ? value.toFixed(4) : value;
                resultsHTML += `<div class="d-flex justify-content-between mb-1">
                    <span>${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span>
                    <strong>${formattedValue}</strong>
                </div>`;
            });
            
            resultsHTML += '</div></div>';
        }
    });
    
    resultsHTML += '</div></div>';
    
    // Add map visualization if available
    if (response.map_url) {
        resultsHTML += generateMapVisualization(response.map_url, response.fallback_url);
    }
    
    return resultsHTML;
}

/**
 * Generate single analysis results HTML
 */
function generateSingleAnalysisResults(response, responseAnalysisType) {
    const displayName = getAnalysisDisplayName(responseAnalysisType);
    
    let resultsHTML = `<div class="row">`;
    
    // Add demo mode alert if applicable
    if (response.demo_mode) {
        resultsHTML += `<div class="col-12 mb-3">
            <div class="alert alert-info alert-dismissible fade show" role="alert">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Demo Mode:</strong> ${response.demo_reason || 'This is demo data. Set up Earth Engine for real satellite analysis.'}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        </div>`;
    }
    
    resultsHTML += `<div class="col-lg-8">
            <h5><i class="fas fa-chart-line me-2"></i>${displayName}</h5>
            ${response.plot_url ? 
                `<img src="${response.plot_url}" class="img-fluid rounded shadow-sm" alt="${displayName} Plot" 
                      onload="console.log('🖼️ Image loaded successfully:', this.src)" 
                      onerror="console.error('❌ Image failed to load:', this.src)">` : 
                '<p class="text-muted">No plot available</p>'
            }
        </div>
        <div class="col-lg-4">
            <h5><i class="fas fa-chart-bar me-2"></i>Statistics</h5>
            <div class="card">
                <div class="card-body">`;
    
    // Display statistics
    const stats = response.statistics || response.stats;
    if (isNDVIAnalysis(responseAnalysisType)) {
        resultsHTML += generateNDVIStats(stats);
    } else if (isLSTAnalysis(responseAnalysisType)) {
        resultsHTML += generateLSTStats(stats);
    } else if (isSentinel1Analysis(responseAnalysisType)) {
        resultsHTML += generateSentinel1Stats(stats);
    } else {
        resultsHTML += '<p class="text-muted">No statistics available</p>';
    }
    
    resultsHTML += `</div>
            </div>
        </div>
    </div>`;
    
    // Add map visualization if available
    if (response.map_url) {
        resultsHTML += generateMapVisualization(response.map_url, response.fallback_url);
    }
    
    // Add appropriate data table
    if (isNDVIAnalysis(responseAnalysisType) && response.data && response.data.length > 0) {
        resultsHTML += generateNDVITable(response);
    } else if (isLSTAnalysis(responseAnalysisType) && response.data && response.data.length > 0) {
        resultsHTML += generateLSTTable(response);
    } else if (isSentinel1Analysis(responseAnalysisType) && response.data && response.data.length > 0) {
        resultsHTML += generateSentinel1Table(response);
    }
    
    return resultsHTML;
}

/**
 * Generate map visualization HTML
 */
function generateMapVisualization(mapUrl, fallbackUrl) {
    if (!mapUrl) return '';
    
    const fallbackUrlAttr = fallbackUrl ? `data-fallback-url="${fallbackUrl}"` : '';
    
    return `<div class="col-12 mb-4">
        <div class="card">
            <div class="card-header bg-light">
                <h5 class="card-title mb-0">
                    <i class="fas fa-map feature-icon"></i>
                    Interactive Satellite Imagery Map
                </h5>
                <small class="text-muted">First and last images from the analysis period with derived bands</small>
            </div>
            <div class="card-body p-0">
                <div id="map-container">
                    <div id="map-loading" style="text-align: center; padding: 50px;">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading map...</span>
                        </div>
                        <p class="mt-2">Loading interactive map...</p>
                    </div>
                    <iframe id="map-iframe" src="${mapUrl}" 
                            style="width: 100%; height: 600px; border: none; display: none;" 
                            title="Interactive Map Visualization"
                            ${fallbackUrlAttr}
                            onload="handleMapIframeLoad(this)"
                            onerror="handleMapIframeError(this, '${mapUrl}', '${fallbackUrl || ''}')">
                    </iframe>
                    <div id="map-error" style="display: none; text-align: center; padding: 50px;">
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            <strong>Map Loading Issue:</strong> The interactive map failed to load properly.
                            <br><a href="${mapUrl}" target="_blank" class="btn btn-primary btn-sm mt-2">
                                <i class="fas fa-external-link-alt me-1"></i>Open map in new window
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <small class="text-muted">
                    <i class="fas fa-info-circle me-1"></i>
                    Use the layer control to toggle between different visualizations. 
                    Zoom and pan to explore the area in detail.
                    <a href="${mapUrl}" target="_blank" class="ms-2">
                        <i class="fas fa-external-link-alt"></i> Open in new window
                    </a>
                </small>
            </div>
        </div>
    </div>`;
}

/**
 * Handle successful iframe loading
 */
function handleMapIframeLoad(iframe) {
    console.log('✅ Map iframe loaded successfully');
    
    // Hide loading indicator and show iframe
    const loadingDiv = document.getElementById('map-loading');
    if (loadingDiv) loadingDiv.style.display = 'none';
    
    iframe.style.display = 'block';
    
    // Check if iframe content is accessible and valid after a delay
    setTimeout(() => {
        try {
            // Try to access iframe document (may fail due to CORS)
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (iframeDoc) {
                console.log('📄 Iframe document accessible');
                
                // Check if the document has meaningful content
                const bodyContent = iframeDoc.body ? iframeDoc.body.innerHTML : '';
                if (bodyContent.length < 100) {
                    console.log('⚠️ Iframe content seems empty, trying fallback');
                    tryFallbackMap(iframe);
                } else if (bodyContent.includes('jupyter-widgets') || bodyContent.includes('require.js')) {
                    console.log('ℹ️ Iframe contains Jupyter widgets, monitoring for loading issues');
                    // Monitor for loading issues with Jupyter widgets
                    setTimeout(() => {
                        checkJupyterWidgetLoading(iframe);
                    }, 5000);
                }
            }
        } catch (e) {
            console.log('ℹ️ Cannot access iframe content (normal for cross-origin)');
            // This is normal for cross-origin iframes, consider it successful
            // But still monitor for potential issues
            setTimeout(() => {
                checkIframeStillWorking(iframe);
            }, 3000);
        }
    }, 2000);
}

/**
 * Check if Jupyter widgets loaded properly
 */
function checkJupyterWidgetLoading(iframe) {
    try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc) {
            // Look for error indicators or missing content
            const errorElements = iframeDoc.querySelectorAll('.widget-error, .error');
            const widgetElements = iframeDoc.querySelectorAll('.widget-area, .jupyter-widgets');
            
            if (errorElements.length > 0 || widgetElements.length === 0) {
                console.log('⚠️ Jupyter widgets failed to load, trying fallback');
                tryFallbackMap(iframe);
            }
        }
    } catch (e) {
        // Can't access due to CORS, assume it's working
        console.log('ℹ️ Cannot check Jupyter widget status due to CORS');
    }
}

/**
 * Check if iframe is still working after initial load
 */
function checkIframeStillWorking(iframe) {
    try {
        // Basic check to see if iframe is still responding
        if (iframe.contentWindow) {
            console.log('✅ Iframe appears to be working');
        } else {
            console.log('⚠️ Iframe may have issues, trying fallback');
            tryFallbackMap(iframe);
        }
    } catch (e) {
        console.log('ℹ️ Cannot check iframe status, assuming it works');
    }
}

/**
 * Try to load fallback map
 */
function tryFallbackMap(iframe) {
    const fallbackUrl = iframe.getAttribute('data-fallback-url');
    if (fallbackUrl && fallbackUrl !== 'null' && fallbackUrl !== '') {
        console.log('🔄 Switching to fallback map:', fallbackUrl);
        iframe.src = fallbackUrl;
        
        // Add a note about using fallback
        const container = document.getElementById('map-container');
        if (container && !container.querySelector('.fallback-notice')) {
            const notice = document.createElement('div');
            notice.className = 'fallback-notice alert alert-info p-2 mb-2';
            notice.innerHTML = '<small><i class="fas fa-info-circle me-1"></i>Using simplified map view for better compatibility</small>';
            container.insertBefore(notice, iframe);
        }
    } else {
        console.log('❌ No fallback URL available');
        handleMapIframeError(iframe, iframe.src, '');
    }
}

/**
 * Handle iframe loading errors
 */
function handleMapIframeError(iframe, mapUrl, fallbackUrl) {
    console.error('❌ Map iframe failed to load:', mapUrl);
    
    // Try fallback first if available
    if (fallbackUrl && fallbackUrl !== '' && fallbackUrl !== 'null' && iframe.src !== fallbackUrl) {
        console.log('🔄 Trying fallback map due to error:', fallbackUrl);
        iframe.src = fallbackUrl;
        return;
    }
    
    // Hide loading and iframe, show error message
    const loadingDiv = document.getElementById('map-loading');
    if (loadingDiv) loadingDiv.style.display = 'none';
    
    if (iframe) iframe.style.display = 'none';
    
    const errorDiv = document.getElementById('map-error');
    if (errorDiv) {
        errorDiv.style.display = 'block';
        
        // Update the error message with the correct URL
        errorDiv.innerHTML = `
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Map Loading Issue:</strong> The interactive map failed to load in the embedded view.
                <br><small class="text-muted">This can happen due to browser security restrictions or JavaScript dependencies.</small>
                <br><a href="${mapUrl}" target="_blank" class="btn btn-primary btn-sm mt-2">
                    <i class="fas fa-external-link-alt me-1"></i>Open map in new window
                </a>
            </div>
        `;
    }
}
