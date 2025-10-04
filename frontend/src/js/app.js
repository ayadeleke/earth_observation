// Main Application Module

/**
 * Handle form submission
 */
function handleFormSubmission(e) {
    e.preventDefault();
    console.log('📝 Form submitted at:', new Date().toISOString());
    
    const coordinates = $('#coordinates').val();
    const shapefileInput = $('#shapefileInput')[0];
    const dateRangeType = $('input[name="dateRangeType"]:checked').val();
    const analysisType = $('#analysisType').val();
    const satellite = $('#satellite').val();
    const projectId = $('#projectId').val();
    const cloudCover = $('#cloudCover').val();
    const polarization = $('#polarization').val();
    
    // Cloud masking parameters
    const enableCloudMasking = $('#enableCloudMasking').is(':checked');
    const maskingStrictness = $('#maskingStrictness').val();
    
    // Get date parameters based on selection type
    let startYear, endYear, startDate, endDate;
    if (dateRangeType === 'years') {
        startYear = $('#startYear').val();
        endYear = $('#endYear').val();
    } else {
        startDate = $('#startDate').val();
        endDate = $('#endDate').val();
    }
    
    console.log('📋 Form data:', {
        coordinates: coordinates ? coordinates.substring(0, 50) + '...' : '(empty)',
        hasShapefile: shapefileInput.files.length > 0,
        dateRangeType, startYear, endYear, startDate, endDate, 
        satellite, projectId, cloudCover, polarization,
        enableCloudMasking, maskingStrictness
    });
    
    // Validation
    if (!validateFormInputs(coordinates, shapefileInput, projectId, dateRangeType, startYear, endYear, startDate, endDate)) {
        return;
    }
    
    // Clear previous errors and results
    $('#errorDiv').empty();
    $('#errorMessage').hide();
    $('#results').empty();
    $('#resultsCard').hide();
    
    // Show loading state
    const submitBtn = $(this).find('button[type="submit"]');
    const originalText = submitBtn.html();
    submitBtn.html('<i class="fas fa-spinner fa-spin me-2"></i>Processing...')
             .prop('disabled', true);
    
    // Process the request
    processAnalysisRequest({
        coordinates, shapefileInput, dateRangeType, analysisType, satellite, 
        projectId, cloudCover, polarization, startYear, endYear, startDate, endDate,
        enableCloudMasking, maskingStrictness
    }, submitBtn, originalText);
}

/**
 * Validate form inputs
 */
function validateFormInputs(coordinates, shapefileInput, projectId, dateRangeType, startYear, endYear, startDate, endDate) {
    // Check if we have either coordinates or shapefile
    const hasCoordinates = coordinates.trim();
    const hasShapefile = shapefileInput.files.length > 0;
    
    if (!hasCoordinates && !hasShapefile) {
        showError('Please provide an area of interest by either:<br>• Entering coordinates in the coordinates field<br>• Drawing an area on the map<br>• Uploading a shapefile');
        return false;
    }
    
    if (!projectId.trim()) {
        showError('Please enter your Earth Engine project ID.');
        return false;
    }
    
    // Validate date ranges
    if (dateRangeType === 'years') {
        if (parseInt(startYear) > parseInt(endYear)) {
            showError('Start year must be less than or equal to end year.');
            return false;
        }
    } else {
        if (new Date(startDate) > new Date(endDate)) {
            showError('Start date must be less than or equal to end date.');
            return false;
        }
    }
    
    return true;
}

/**
 * Process analysis request
 */
function processAnalysisRequest(formData, submitBtn, originalText) {
    // Store the request data for potential retry after authentication
    window.lastRequestData = { formData, submitBtn, originalText };
    window.retryLastRequest = () => {
        processAnalysisRequest(formData, submitBtn, originalText);
    };
    
    // Determine the endpoint based on analysis type
    let endpoint = '/process';
    if (formData.analysisType === 'lst') {
        endpoint = '/process_lst';
    } else if (formData.analysisType === 'backscatter') {
        endpoint = '/process_sentinel1';
    } else if (formData.analysisType === 'comprehensive') {
        endpoint = '/process_comprehensive';
    }
    
    // Setup request data
    let requestData;
    let requestOptions = {
        url: endpoint,
        method: 'POST',
        success: function(response) {
            console.log('✅ Process endpoint succeeded:', response);
            if (response.error) {
                showError(response.error);
                return;
            }
            displayResults(response);
        },
        error: function(xhr, status, error) {
            console.log('❌ Process endpoint failed:', xhr.status, xhr.responseText);
            
            // Check if this is an authentication error
            if (xhr.status === 401 || xhr.status === 500) {
                try {
                    const errorResponse = JSON.parse(xhr.responseText);
                    if (errorResponse.auth_required && errorResponse.instructions) {
                        // Handle authentication using the auth handler
                        eeAuth.handleAuthResponse(errorResponse);
                        return;
                    }
                } catch (e) {
                    console.log('Error parsing auth response:', e);
                }
            }
            
            console.log('Trying demo mode...');
            tryDemoMode(formData, requestData);
        },
        complete: function() {
            // Reset button state
            submitBtn.html(originalText).prop('disabled', false);
        }
    };
    
    requestData = setupRequestData(formData);
    
    if (formData.shapefileInput.files.length > 0) {
        requestOptions.data = requestData;
        requestOptions.processData = false;
        requestOptions.contentType = false;
    } else {
        requestOptions.contentType = 'application/json';
        requestOptions.data = JSON.stringify(requestData);
    }

    // Execute the AJAX request
    $.ajax(requestOptions);
}

/**
 * Setup request data based on form inputs
 */
function setupRequestData(formData) {
    const hasShapefile = formData.shapefileInput.files.length > 0;
    let requestData;
    
    if (hasShapefile) {
        // Use FormData for file upload
        requestData = new FormData();
        requestData.append('shapefile', formData.shapefileInput.files[0]);
        
        // Add date parameters based on type
        if (formData.dateRangeType === 'years') {
            requestData.append('start_year', formData.startYear);
            requestData.append('end_year', formData.endYear);
            requestData.append('date_range_type', 'years');
        } else {
            requestData.append('start_date', formData.startDate);
            requestData.append('end_date', formData.endDate);
            requestData.append('date_range_type', 'dates');
        }
        
        requestData.append('analysis_type', formData.analysisType);
        requestData.append('satellite', formData.satellite);
        requestData.append('project_id', formData.projectId);
        
        if (formData.satellite === 'landsat' && (formData.analysisType === 'ndvi' || formData.analysisType === 'lst' || formData.analysisType === 'comprehensive')) {
            requestData.append('cloud_cover', formData.cloudCover);
            // Add cloud masking parameters
            requestData.append('use_cloud_masking', formData.enableCloudMasking);
            requestData.append('strict_masking', formData.maskingStrictness === 'strict');
        }
        if ((formData.satellite === 'sentinel' && formData.analysisType === 'backscatter') || formData.analysisType === 'comprehensive') {
            requestData.append('polarization', formData.polarization);
        }
    } else {
        // Use JSON for coordinates
        requestData = {
            coordinates: formData.coordinates,
            analysis_type: formData.analysisType,
            satellite: formData.satellite,
            project_id: formData.projectId,
            date_range_type: formData.dateRangeType
        };
        
        // Add date parameters based on type
        if (formData.dateRangeType === 'years') {
            requestData.start_year = parseInt(formData.startYear);
            requestData.end_year = parseInt(formData.endYear);
        } else {
            requestData.start_date = formData.startDate;
            requestData.end_date = formData.endDate;
        }
        
        // Add cloud cover for Landsat analyses
        if (formData.satellite === 'landsat' && (formData.analysisType === 'ndvi' || formData.analysisType === 'lst' || formData.analysisType === 'comprehensive')) {
            requestData.cloud_cover = parseInt(formData.cloudCover);
            // Add cloud masking parameters
            requestData.use_cloud_masking = formData.enableCloudMasking;
            requestData.strict_masking = formData.maskingStrictness === 'strict';
        }
        
        // Add polarization for SAR analyses
        if ((formData.satellite === 'sentinel' && formData.analysisType === 'backscatter') || formData.analysisType === 'comprehensive') {
            requestData.polarization = formData.polarization;
        }
        
        // For comprehensive analysis, specify which analyses to include
        if (formData.analysisType === 'comprehensive') {
            requestData.analysis_types = ['ndvi', 'lst', 'sentinel1'];
        }
    }
    
    return requestData;
}

/**
 * Try demo mode as fallback
 */
function tryDemoMode(formData, requestData) {
    let demoOptions = {
        url: '/demo',
        method: 'POST',
        success: function(response) {
            if (response.error) {
                showError(response.error);
                return;
            }
            
            // Show demo mode message
            if (response.demo_mode) {
                $('#errorDiv').append(`
                    <div class="alert alert-warning alert-dismissible fade show mt-2" role="alert">
                        <i class="fas fa-info-circle me-2"></i>
                        <strong>Demo Mode:</strong> ${response.message}
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                `);
            }
            
            displayResults(response);
        },
        error: function(xhr, status, error) {
            showError('Both Earth Engine and demo mode failed. Please check your setup.');
        }
    };
    
    // Use the same request data and settings as the main request
    if (formData.shapefileInput.files.length > 0) {
        demoOptions.data = requestData;
        demoOptions.processData = false;
        demoOptions.contentType = false;
    } else {
        demoOptions.data = JSON.stringify(requestData);
        demoOptions.contentType = 'application/json';
    }
    
    $.ajax(demoOptions);
}

/**
 * Check Earth Engine status on page load
 */
function checkEarthEngineStatus() {
    console.log('🔍 Checking Earth Engine status...');
    
    // First check authentication status
    eeAuth.getAuthStatus().then(authStatus => {
        console.log('🔐 Authentication status:', authStatus);
        
        if (authStatus.authenticated) {
            $('#errorDiv').append(`
                <div class="alert alert-success mt-3">
                    <h5><i class="fas fa-check-circle me-2"></i>Earth Engine Ready</h5>
                    <p class="mb-0">Successfully authenticated with Google Earth Engine. Ready to process satellite data!</p>
                </div>
            `);
        } else {
            // Show setup instructions
            $('#errorDiv').append(`
                <div class="alert alert-info mt-3">
                    <h5><i class="fas fa-info-circle me-2"></i>Earth Engine Setup</h5>
                    <p class="mb-2">To use this application with real satellite data:</p>
                    <ol class="mb-2">
                        <li>Sign up for Google Earth Engine at: <a href="https://developers.google.com/earth-engine/guides/access" target="_blank" class="text-decoration-none">https://developers.google.com/earth-engine/guides/access</a></li>
                        <li>Create a Google Cloud Project with Earth Engine enabled</li>
                        <li>Enter your project ID in the form below - authentication will happen automatically</li>
                    </ol>
                    <div class="alert alert-warning mt-2">
                        <i class="fas fa-play-circle me-2"></i>
                        <strong>Demo Mode Available:</strong> If Earth Engine setup fails, the app will automatically fall back to demo mode with simulated data.
                    </div>
                    <p class="mb-0"><small class="text-muted">Note: Earth Engine registration may take 1-2 days for approval.</small></p>
                </div>
            `);
        }
    });
    
    $.get('/check_ee', function(data) {
        if (data.error) {
            console.log('⚠️ Earth Engine not available:', data.error);
        } else {
            console.log('✅ Earth Engine status check completed');
        }
    }).fail(function() {
        // Connection error - not critical for functionality
        console.log('❌ Unable to check Earth Engine status on page load');
    });
}

/**
 * Initialize the entire application
 */
function initializeApp() {
    console.log('🔍 Earth Observation Analysis App - Modular version v3.0');
    
    // Show initialization message in the UI
    showError('🔍 Earth Observation Analysis App - Modular version v3.0<br>Initializing application components...', 'info');
    
    // Initialize modules
    initializeMap();
    initializeFormHandlers();
    checkEarthEngineStatus();
    
    console.log('✅ Application initialized successfully');
    
    // Update UI with success message
    setTimeout(() => {
        showError('✅ Application initialized successfully!<br>Ready to process satellite data analysis.', 'success');
    }, 1000);
}
