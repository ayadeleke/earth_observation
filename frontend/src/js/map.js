// Map Module - Leaflet map initialization and controls

let map;
let drawnItems;
let drawControl;

/**
 * Initialize the map
 */
function initializeMap() {
    // Initialize map
    map = L.map('map').setView([40.7128, -74.0060], 10); // Default fallback location
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Try to get user's current location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                map.setView([lat, lng], 12);
                
                // Add a marker at user's location
                L.marker([lat, lng])
                    .addTo(map)
                    .openPopup();
            },
            function(error) {
                console.log('Geolocation error:', error);
                showError('Unable to get your location. Using default view.');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 600000
            }
        );
    } else {
        showError('Geolocation is not supported by this browser. Using default view.');
    }

    setupDrawingControls();
}

/**
 * Setup drawing controls for map
 */
function setupDrawingControls() {
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Add drawing controls
    drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems
        },
        draw: {
            polygon: true,
            rectangle: true,
            circle: false,
            marker: false,
            polyline: false,
            circlemarker: false
        }
    });
    map.addControl(drawControl);

    // Handle drawn shapes
    map.on('draw:created', function(e) {
        let layer = e.layer;
        drawnItems.addLayer(layer);
        
        // Convert to WKT format
        let coordinates = layer.getLatLngs()[0].map(point => 
            `${point.lng} ${point.lat}`
        ).join(', ');
        let wkt = `POLYGON((${coordinates}, ${layer.getLatLngs()[0][0].lng} ${layer.getLatLngs()[0][0].lat}))`;
        $('#coordinates').val(wkt);
    });
}
