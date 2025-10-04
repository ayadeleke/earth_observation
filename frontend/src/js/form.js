// Form Handling Module

/**
 * Initialize form handlers
 */
function initializeFormHandlers() {
    // Handle date range type switching
    $('input[name="dateRangeType"]').on('change', function() {
        if ($(this).val() === 'years') {
            $('#yearRangePanel').show();
            $('#exactDatesPanel').hide();
        } else {
            $('#yearRangePanel').hide();
            $('#exactDatesPanel').show();
        }
    });

    // Synchronize cloud cover slider and input
    $('#cloudCover').on('input', function() {
        $('#cloudCoverValue').val($(this).val());
    });

    $('#cloudCoverValue').on('input', function() {
        $('#cloudCover').val($(this).val());
    });

    // Handle analysis type changes
    $('#analysisType').on('change', updatePanelVisibility);
    
    // Show/hide cloud cover panel based on satellite selection
    $('#satellite').on('change', function() {
        const analysisType = $('#analysisType').val();
        
        if ($(this).val() === 'landsat' && analysisType !== 'backscatter') {
            $('#cloudCoverPanel').show();
            $('#polarizationPanel').hide();
        } else {
            $('#cloudCoverPanel').hide();
            $('#polarizationPanel').show();
        }
    });

    // Handle shapefile upload
    $('#shapefileInput').on('change', handleShapefileUpload);

    // Handle tab switching
    $('#aoiTabs button').on('click', handleTabSwitching);

    // Main form submission
    $('#analysisForm').on('submit', handleFormSubmission);
    
    // Initialize panel visibility
    updatePanelVisibility();
}

/**
 * Update panel visibility based on analysis type and satellite selection
 */
function updatePanelVisibility() {
    const analysisType = $('#analysisType').val();
    const satellite = $('#satellite').val();
    
    // Update satellite description based on analysis type
    let description = '';
    let satelliteOptions = '';
    
    if (analysisType === 'ndvi') {
        description = 'NDVI analysis using optical bands for vegetation monitoring.';
        satelliteOptions = '<option value="landsat">Landsat (30m resolution)</option><option value="sentinel">Sentinel-2 (10m resolution)</option>';
    } else if (analysisType === 'lst') {
        description = 'Land Surface Temperature analysis using thermal bands (Landsat only).';
        satelliteOptions = '<option value="landsat">Landsat (30m resolution)</option>';
    } else if (analysisType === 'backscatter') {
        description = 'SAR backscatter analysis for surface monitoring (Sentinel-1 only).';
        satelliteOptions = '<option value="sentinel">Sentinel-1 SAR</option>';
    } else if (analysisType === 'comprehensive') {
        description = 'Combined analysis using multiple satellites and sensors.';
        satelliteOptions = '<option value="landsat">Landsat (NDVI + LST)</option><option value="sentinel">Sentinel-1 SAR + Sentinel-2</option>';
    }
    
    $('#satelliteDescription').text(description);
    $('#satellite').html(satelliteOptions);
    
    // Show/hide panels based on current selections
    const currentSatellite = $('#satellite').val();
    
    if (analysisType === 'backscatter' || currentSatellite === 'sentinel') {
        $('#cloudCoverPanel').hide();
        $('#polarizationPanel').show();
    } else {
        $('#cloudCoverPanel').show();
        $('#polarizationPanel').hide();
    }
}

/**
 * Handle shapefile upload
 */
function handleShapefileUpload(e) {
    const file = e.target.files[0];
    if (file) {
        console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type);
        
        // Validate file type
        if (!file.name.toLowerCase().endsWith('.zip')) {
            showError('Please select a ZIP file containing your shapefile components (.shp, .shx, .dbf files). Single .shp files cannot be processed without their companion files.');
            $('#shapefileInput').val('');
            $('#shapefileInfo').hide();
            return;
        }
        
        // Check file size (warn if very large)
        if (file.size > 50 * 1024 * 1024) { // 50MB
            showError('Warning: Large file detected (' + Math.round(file.size / 1024 / 1024) + ' MB). Processing may take longer than usual.');
        }
        
        $('#shapefileName').text(file.name);
        $('#shapefileInfo').show();
        
        // Clear coordinates when shapefile is selected
        $('#coordinates').val('');
        
        // Show processing message
        showError('Shapefile selected. Click "Run Analysis" to process the file.', 'info');
    }
}

/**
 * Handle tab switching
 */
function handleTabSwitching() {
    // Clear the other input when switching tabs
    if ($(this).attr('id') === 'coordinates-tab') {
        $('#shapefileInput').val('');
        $('#shapefileInfo').hide();
    } else if ($(this).attr('id') === 'shapefile-tab') {
        $('#coordinates').val('');
    }
}
