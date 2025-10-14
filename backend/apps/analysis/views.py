"""
Minimal views module that imports and exposes all endpoints from micro-modules.
This file acts as the main entry point for all analysis endpoints with caching support.
"""

# Import caching utilities
from .cached_views import CachedAnalysisViewMixin, SmartCacheInvalidator
from apps.core.caching import AnalysisCache

# Import from basic endpoints module (NDVI, LST, SAR)
from .view_modules.basic_endpoints import (
    process_ndvi,
    process_lst,
    process_sentinel
)

# Import from advanced endpoints module (Comprehensive, Trends, Composite)
from .view_modules.advanced_endpoints import (
    process_comprehensive,
    analyze_trends,
    process_composite
)

# Import from database operations module
from .view_modules.database_operations import (
    get_analysis_history,
    get_analysis_result_by_id,
    delete_analysis_by_id
)

# Import simple utility endpoints
import ee
import logging
import os
import tempfile
import zipfile
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.authentication import SessionAuthentication
from drf_spectacular.utils import extend_schema, OpenApiResponse
from drf_spectacular.types import OpenApiTypes

# Import Earth Engine configuration
from apps.earth_engine.ee_config import initialize_earth_engine
from apps.core.permissions import IsOwnerOrReadOnly
from apps.core.auth_decorators import require_authentication, owner_required
from apps.core.models import AnalysisProject
from django.utils import timezone

try:
    import geopandas as gpd
    from shapely.geometry import mapping
    GEOPANDAS_AVAILABLE = True
except ImportError:
    GEOPANDAS_AVAILABLE = False
    gpd = None
    mapping = None

logger = logging.getLogger(__name__)


def filter_for_complete_coverage(collection, geometry):
    """
    Filter collection to only include images that completely cover the ROI

    Args:
        collection: Earth Engine ImageCollection
        geometry: Earth Engine geometry object (ROI)

    Returns:
        ee.ImageCollection: Filtered collection with complete coverage
    """
    try:
        logger.info("Filtering for complete ROI coverage...")

        def check_coverage(image):
            # Get the image footprint
            footprint = image.geometry()

            # Check if the image footprint completely contains the ROI
            # This means the ROI is entirely within the image bounds
            roi_covered = footprint.contains(geometry, ee.ErrorMargin(1))  # 1 meter tolerance

            # Also check intersection area to ensure good coverage
            intersection = footprint.intersection(geometry, ee.ErrorMargin(1))
            intersection_area = intersection.area()
            roi_area = geometry.area()

            # Coverage percentage (should be close to 100% for complete coverage)
            coverage_percent = intersection_area.divide(roi_area).multiply(100)

            # Set properties for debugging
            return image.set({
                'roi_covered': roi_covered,
                'coverage_percent': coverage_percent,
                'intersection_area': intersection_area,
                'roi_area': roi_area
            })

        # Add coverage properties to all images
        collection_with_coverage = collection.map(check_coverage)

        # Filter for images that completely cover the ROI (>99% coverage)
        complete_coverage = collection_with_coverage.filter(
            ee.Filter.And(
                ee.Filter.eq('roi_covered', True),
                ee.Filter.gte('coverage_percent', 99)
            )
        )

        return complete_coverage

    except Exception as e:
        logger.error(f"Error in coverage filtering: {str(e)}")
        return collection  # Return original collection if filtering fails


def extract_satellite_info(image_id, properties):
    """Extract detailed satellite mission and sensor information from image properties"""
    try:
        # Get spacecraft and sensor from properties
        spacecraft_id = properties.get('SPACECRAFT_ID', '')
        sensor_id = properties.get('SENSOR_ID', '')

        # Handle Sentinel-2 specifically
        if 'COPERNICUS/S2' in image_id or 'S2A' in image_id or 'S2B' in image_id:
            # Extract Sentinel-2 satellite from image ID
            if 'S2A' in image_id:
                spacecraft_id = 'SENTINEL_2A'
            elif 'S2B' in image_id:
                spacecraft_id = 'SENTINEL_2B'
            else:
                spacecraft_id = 'SENTINEL_2'
            sensor_id = 'MSI'  # MultiSpectral Instrument
            return spacecraft_id, sensor_id

        # Handle Sentinel-1 specifically
        if 'COPERNICUS/S1' in image_id or 'S1A' in image_id or 'S1B' in image_id:
            # Extract Sentinel-1 satellite from image ID
            # Format: COPERNICUS/S1_GRD/S1A_IW_GRDH_1SDV_20230105T052943_...
            if 'S1A' in image_id:
                spacecraft_id = 'SENTINEL_1A'
            elif 'S1B' in image_id:
                spacecraft_id = 'SENTINEL_1B'
            else:
                spacecraft_id = 'SENTINEL_1'
            sensor_id = 'C-SAR'  # C-band Synthetic Aperture Radar
            return spacecraft_id, sensor_id

        # Parse mission from image ID if not in properties (Landsat)
        if not spacecraft_id and '/' in image_id:
            id_parts = image_id.split('/')
            if len(id_parts) >= 4:
                mission_code = id_parts[-1][:4]  # e.g., 'LC09', 'LE07', 'LT05'
                if mission_code.startswith('LC09'):
                    spacecraft_id = 'LANDSAT_9'
                elif mission_code.startswith('LC08'):
                    spacecraft_id = 'LANDSAT_8'
                elif mission_code.startswith('LE07'):
                    spacecraft_id = 'LANDSAT_7'
                elif mission_code.startswith('LT05'):
                    spacecraft_id = 'LANDSAT_5'
                elif mission_code.startswith('LT04'):
                    spacecraft_id = 'LANDSAT_4'

        # Map sensor information
        if not sensor_id:
            if 'LANDSAT_9' in spacecraft_id or 'LANDSAT_8' in spacecraft_id:
                sensor_id = 'OLI_TIRS'
            elif 'LANDSAT_7' in spacecraft_id:
                sensor_id = 'ETM'
            elif 'LANDSAT_5' in spacecraft_id or 'LANDSAT_4' in spacecraft_id:
                sensor_id = 'TM'

        return spacecraft_id or 'landsat', sensor_id or 'N/A'
    except Exception as e:
        logger.warning(f"Error extracting satellite info: {e}")
        return 'landsat', 'N/A'


def process_shapefile_to_coordinates(shapefile_obj):
    """
    Process uploaded shapefile and extract coordinates as WKT

    Args:
        shapefile_obj: Django uploaded file object

    Returns:
        str or None: WKT polygon string or None if failed
    """
    if not GEOPANDAS_AVAILABLE:
        logger.error("GeoPandas not available for shapefile processing")
        return None

    try:
        logger.info(f"Processing shapefile: {shapefile_obj.name}")

        # Create temporary directory for extraction
        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = os.path.join(temp_dir, shapefile_obj.name)

            # Save uploaded file
            with open(zip_path, 'wb+') as destination:
                for chunk in shapefile_obj.chunks():
                    destination.write(chunk)

            # Extract ZIP file
            try:
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)

                    # Find all extracted files
                    extracted_files = []
                    for root, dirs, files in os.walk(temp_dir):
                        for file in files:
                            rel_path = os.path.relpath(os.path.join(root, file), temp_dir)
                            extracted_files.append(rel_path)

            except zipfile.BadZipFile:
                logger.error("Invalid ZIP file")
                return None

            # Find shapefile components
            shp_files = [f for f in extracted_files if f.lower().endswith('.shp')]

            if not shp_files:
                logger.error("No .shp file found in the uploaded ZIP")
                return None

            if len(shp_files) > 1:
                logger.error(f"Multiple .shp files found: {shp_files}")
                return None

            shp_file = shp_files[0]
            shp_path = os.path.join(temp_dir, shp_file)

            # Read shapefile
            try:
                gdf = gpd.read_file(shp_path)

                if gdf.empty:
                    logger.error("Shapefile is empty")
                    return None

                # Convert to WGS84 if needed
                if gdf.crs != 'EPSG:4326':
                    gdf = gdf.to_crs('EPSG:4326')

                # Use the first feature if multiple features exist
                if len(gdf) > 1:
                    gdf = gdf.iloc[:1]

                # Get geometry as WKT
                geom = gdf.geometry.iloc[0]
                wkt = geom.wkt

                logger.info(f"Successfully extracted WKT: {wkt[:100]}...")
                return wkt

            except Exception as e:
                logger.error(f"Error reading shapefile: {str(e)}")
                return None

    except Exception as e:
        logger.error(f"Error processing shapefile: {str(e)}")
        return None


@extend_schema(
    summary="Health Check",
    description="Check system health and Earth Engine authentication status.",
    responses={
        200: OpenApiResponse(response=OpenApiTypes.OBJECT, description="System healthy"),
        500: OpenApiResponse(description="System issues detected")
    }
)
@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """Health check endpoint to verify system status"""
    try:
        # Initialize Earth Engine if not already done
        initialize_earth_engine()

        # Test basic EE functionality
        info = ee.String('Earth Engine is working!').getInfo()

        return Response({
            "status": "healthy",
            "earth_engine": "authenticated",
            "message": info,
            "timestamp": timezone.now().isoformat()
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return Response({
            "status": "unhealthy",
            "earth_engine": "error",
            "error": str(e),
            "timestamp": timezone.now().isoformat()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    summary="Get Image Metadata",
    description="Get metadata information for satellite images in the specified area and time period.",
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'aoi_data': {'type': 'string', 'description': 'GeoJSON string of Area of Interest'},
                'start_date': {'type': 'string', 'format': 'date', 'description': 'Start date (YYYY-MM-DD)'},
                'end_date': {'type': 'string', 'format': 'date', 'description': 'End date (YYYY-MM-DD)'},
                'satellite': {'type': 'string', 'enum': ['landsat', 'sentinel2'], 'default': 'landsat'}
            },
            'required': ['aoi_data', 'start_date', 'end_date']
        }
    },
    responses={
        200: OpenApiResponse(response=OpenApiTypes.OBJECT, description="Image metadata retrieved"),
        400: OpenApiResponse(description="Invalid request parameters"),
        500: OpenApiResponse(description="Server error during metadata retrieval")
    }
)
@api_view(["POST"])
@permission_classes([AllowAny])
def get_image_metadata(request):
    """Get metadata for available satellite images compatible with React frontend"""
    try:
        # Import Earth Engine initialization
        from apps.earth_engine.ee_config import initialize_earth_engine, is_initialized
        import ee

        if not is_initialized():
            if not initialize_earth_engine():
                return Response(
                    {"success": False, "error": "Earth Engine not available"},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )

        # Extract request data - handle both JSON and FormData
        if request.content_type and 'multipart/form-data' in request.content_type:
            # Handle shapefile upload (FormData)
            data = request.data
            project_id = data.get('project_id', 'ee-ayotundenew')
            satellite = data.get('satellite', 'landsat')
            analysis_type = data.get('analysis_type', 'ndvi')
            start_date = data.get('start_date')
            end_date = data.get('end_date')
            cloud_cover = int(data.get('cloud_cover', 20))

            # Process shapefile to get coordinates
            shapefile = request.FILES.get('shapefile')
            if not shapefile:
                return Response(
                    {"success": False, "error": "Shapefile is required when using file upload"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Process shapefile to extract geometry
            coordinates = process_shapefile_to_coordinates(shapefile)
            if not coordinates:
                return Response(
                    {"success": False, "error": "Failed to process shapefile"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            # Handle JSON data
            data = request.data
            project_id = data.get('project_id', 'ee-ayotundenew')
            satellite = data.get('satellite', 'landsat')
            analysis_type = data.get('analysis_type', 'ndvi')
            start_date = data.get('start_date')
            end_date = data.get('end_date')

            # Handle cloud cover - ensure it's a number
            try:
                cloud_cover = float(data.get('cloud_cover', 20))
                cloud_cover = min(max(0, cloud_cover), 100)  # Clamp between 0-100
            except (TypeError, ValueError):
                cloud_cover = 20
            logger.info(f"Using cloud cover threshold: {cloud_cover}%")

            coordinates = data.get('coordinates')

        # Validate required parameters
        if not all([start_date, end_date, coordinates]):
            return Response(
                {"success": False, "error": "Missing required parameters: start_date, end_date, coordinates"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Convert coordinates to Earth Engine geometry
        try:
            if isinstance(coordinates, str) and coordinates.startswith('POLYGON'):
                # Parse WKT format: Handle various formats like:
                # POLYGON((-74.0059 40.7128, -74.0059 40.7628, ...))
                # POLYGON ((-74.0059 40.7128, -74.0059 40.7628, ...))
                # POLYGON(((-74.0059 40.7128, -74.0059 40.7628, ...)))

                # Remove POLYGON prefix and normalize
                coords_str = coordinates.upper().replace('POLYGON', '').strip()

                # Remove all parentheses and get the coordinate string
                coords_str = coords_str.strip('()')
                while coords_str.startswith('(') and coords_str.endswith(')'):
                    coords_str = coords_str[1:-1].strip()

                logger.info(f"Cleaned coordinate string: {coords_str[:100]}...")

                # Split by comma to get coordinate pairs
                coord_pairs = [pair.strip() for pair in coords_str.split(',')]
                coords = []

                for pair in coord_pairs:
                    if not pair.strip():
                        continue

                    parts = pair.strip().split()
                    if len(parts) >= 2:
                        try:
                            lng, lat = float(parts[0]), float(parts[1])
                            coords.append([lng, lat])  # EE expects [lng, lat]
                        except ValueError as ve:
                            logger.error(f"Error parsing coordinate pair '{pair}': {ve}")
                            return Response(
                                {"success": False, "error": f"Invalid coordinate pair: {pair}"},
                                status=status.HTTP_400_BAD_REQUEST
                            )
                    else:
                        logger.warning(f"Skipping invalid coordinate pair: {pair}")

                if len(coords) < 3:
                    return Response(
                        {"success": False, "error": f"Invalid polygon: need at least 3 coordinate pairs, got {len(coords)}"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Ensure polygon is closed (first and last points are the same)
                if coords[0] != coords[-1]:
                    coords.append(coords[0])

                logger.info(f"Successfully parsed {len(coords)} coordinate pairs")
                geometry = ee.Geometry.Polygon([coords])

            elif isinstance(coordinates, list):
                # Handle array format from drawn polygons
                try:
                    if len(coordinates) >= 3:  # Need at least 3 points for a polygon
                        # Check if coordinates are already in [lng, lat] pairs
                        if all(isinstance(coord, list) and len(coord) == 2 for coord in coordinates):
                            # Format is already [[lng, lat], [lng, lat], ...]
                            coords = coordinates
                        else:
                            # Format is [lat, lng, lat, lng, ...]
                            coords = []
                            for i in range(0, len(coordinates), 2):
                                if i + 1 < len(coordinates):
                                    coords.append([coordinates[i + 1], coordinates[i]])  # Convert to [lng, lat]

                        # Ensure the polygon is closed
                        if coords[0] != coords[-1]:
                            coords.append(coords[0])

                        geometry = ee.Geometry.Polygon([coords])
                        logger.info(f"Created polygon from {len(coords)} coordinate pairs")
                    else:
                        return Response(
                            {"success": False, "error": "Need at least 3 points to create a polygon"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                except Exception as e:
                    logger.error(f"Error processing coordinate array: {str(e)}")
                    return Response(
                        {"success": False, "error": f"Invalid coordinate array format: {str(e)}"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                return Response(
                    {"success": False, "error": "Invalid coordinates format. Expected WKT POLYGON or coordinate array"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            logger.error(f"Error parsing coordinates: {str(e)}")
            return Response(
                {"success": False, "error": f"Error parsing coordinates: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get collection based on satellite
        if satellite.lower() == 'landsat':
            # Create Landsat collection with all available missions
            start_year = int(start_date.split("-")[0])
            end_year = int(end_date.split("-")[0])
            collections = []

            # Initial cloud cover threshold
            initial_cloud_cover = float(cloud_cover)
            collections = []

            # Helper function to create collection with relaxed cloud cover if needed
            def create_collection(dataset_id, start_year_coll, end_year_coll, collection_name):
                nonlocal cloud_cover
                # First try with original cloud cover
                try:
                    collection = (ee.ImageCollection(dataset_id)
                                  .filterDate(start_date, end_date)
                                  .filterBounds(geometry)
                                  .filter(ee.Filter.lt("CLOUD_COVER", float(cloud_cover))))

                    size = collection.size().getInfo()
                    if size == 0:
                        # Try with relaxed cloud cover
                        relaxed_cloud_cover = min(float(cloud_cover) * 2, 100)
                        logger.info(f"No {collection_name} images found with {cloud_cover}% cloud cover, trying {relaxed_cloud_cover}%")

                        collection = (ee.ImageCollection(dataset_id)
                                      .filterDate(start_date, end_date)
                                      .filterBounds(geometry)
                                      .filter(ee.Filter.lt("CLOUD_COVER", relaxed_cloud_cover)))

                        size = collection.size().getInfo()
                        if size > 0:
                            cloud_cover = relaxed_cloud_cover
                            logger.info(f"Found {size} {collection_name} images with relaxed cloud cover {relaxed_cloud_cover}%")
                    else:
                        logger.info(f"Found {size} {collection_name} images with {cloud_cover}% cloud cover")

                    return collection
                except Exception as e:
                    logger.error(f"Error creating collection for {collection_name}: {e}")
                    return ee.ImageCollection([])

            # Landsat 9 (2021-present, try newest first)
            if end_year >= 2021:
                l9_start = max(start_year, 2021)
                l9 = create_collection(
                    "LANDSAT/LC09/C02/T1_L2",
                    l9_start,
                    end_year,
                    "Landsat 9"
                )
                if l9.size().getInfo() > 0:
                    collections.append(l9)
                    logger.info(f"Added Landsat 9 collection for years {l9_start}-{end_year}")

            # Landsat 8 (2013-present)
            if end_year >= 2013:
                l8_start = max(start_year, 2013)
                l8 = create_collection(
                    "LANDSAT/LC08/C02/T1_L2",
                    l8_start,
                    end_year,
                    "Landsat 8"
                )
                if l8.size().getInfo() > 0:
                    collections.append(l8)
                    logger.info(f"Added Landsat 8 collection for years {l8_start}-{end_year}")

            # Landsat 7 (1999-present)
            if end_year >= 1999:
                l7_start = max(start_year, 1999)
                l7 = create_collection(
                    "LANDSAT/LE07/C02/T1_L2",
                    l7_start,
                    end_year,
                    "Landsat 7"
                )
                if l7.size().getInfo() > 0:
                    collections.append(l7)
                    logger.info(f"Added Landsat 7 collection for years {l7_start}-{end_year}")

            # Landsat 5 (1984-2013)
            if start_year <= 2013:
                l5_end = min(end_year, 2013)
                if start_year <= l5_end:
                    l5 = create_collection(
                        "LANDSAT/LT05/C02/T1_L2",
                        start_year,
                        l5_end,
                        "Landsat 5"
                    )
                    if l5.size().getInfo() > 0:
                        collections.append(l5)
                        logger.info(f"Added Landsat 5 collection for years {start_year}-{l5_end}")

            if cloud_cover > initial_cloud_cover:
                logger.info(f"Using relaxed cloud cover threshold: {cloud_cover}% (original was {initial_cloud_cover}%)")

            if not collections:
                return Response({
                    "success": False,
                    "error": f"No Landsat collections available for the specified date range: {start_date} to {end_date}"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Merge collections
            collection = collections[0]
            for coll in collections[1:]:
                collection = collection.merge(coll)

        elif satellite.lower() == 'sentinel2':
            collection = (
                ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterDate(start_date, end_date)
                .filterBounds(geometry)
                .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", cloud_cover))
            )
        elif satellite.lower() == 'sentinel1':
            # Use both ascending and descending passes for better coverage
            collection = (
                ee.ImageCollection("COPERNICUS/S1_GRD")
                .filterDate(start_date, end_date)
                .filterBounds(geometry)
                .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
                .filter(ee.Filter.eq('instrumentMode', 'IW'))
                # Include both ASCENDING and DESCENDING for more images
                .filter(ee.Filter.inList('orbitProperties_pass', ['ASCENDING', 'DESCENDING']))
            )
        else:
            return Response({
                "success": False,
                "error": f"Unsupported satellite: {satellite}"
            }, status=status.HTTP_400_BAD_REQUEST)

        # Apply complete coverage filtering
        logger.info(f"Total images before coverage filtering: {collection.size().getInfo()}")
        
        # Use more lenient filtering for Sentinel-1 SAR data
        if satellite.lower() == 'sentinel1':
            # For SAR data, use less strict coverage requirements
            def check_sar_coverage(image):
                footprint = image.geometry()
                intersection = footprint.intersection(geometry, ee.ErrorMargin(10))  # 10m tolerance for SAR
                intersection_area = intersection.area()
                roi_area = geometry.area()
                coverage_percent = intersection_area.divide(roi_area).multiply(100)
                return image.set('coverage_percent', coverage_percent)
            
            collection_with_coverage = collection.map(check_sar_coverage)
            # Use 85% coverage threshold for SAR (more lenient)
            collection = collection_with_coverage.filter(ee.Filter.gte('coverage_percent', 85))
        else:
            # Use standard strict filtering for optical satellites
            collection = filter_for_complete_coverage(collection, geometry)
        
        filtered_count = collection.size().getInfo()
        logger.info(f"Images after coverage filtering: {filtered_count}")
        
        # If no images with good coverage, fall back to original collection for Sentinel-1
        if filtered_count == 0 and satellite.lower() == 'sentinel1':
            logger.warning("No Sentinel-1 images with good coverage, using all available images")
            collection = (
                ee.ImageCollection("COPERNICUS/S1_GRD")
                .filterDate(start_date, end_date)
                .filterBounds(geometry)
                .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
                .filter(ee.Filter.eq('instrumentMode', 'IW'))
                .filter(ee.Filter.inList('orbitProperties_pass', ['ASCENDING', 'DESCENDING']))
            )
            filtered_count = collection.size().getInfo()
            logger.info(f"Fallback: Using {filtered_count} unfiltered Sentinel-1 images")

        # Sort by cloud cover and date
        collection = collection.sort('CLOUD_COVER').sort('system:time_start')
        image_count = collection.size().getInfo()

        if image_count == 0:
            return Response({
                'success': True,
                'images': [],
                'recommended_selections': [],
                'message': f'No {satellite} images found for the specified criteria'
            })

        # Get all images after filtering (no limit to show all available images)
        image_list = collection.getInfo()

        # Process images for frontend display
        images = []
        for idx, img in enumerate(image_list.get('features', [])):
            properties = img.get('properties', {})
            image_id = img.get('id', f'image_{idx}')

            # Get image date and cloud cover
            if satellite.lower() == 'landsat':
                date_str = properties.get('DATE_ACQUIRED', 'Unknown')
                cloud_cover_val = properties.get('CLOUD_COVER', 0)
            elif satellite.lower() == 'sentinel2':
                # Sentinel-2 date extraction from image ID
                # Format: COPERNICUS/S2_SR_HARMONIZED/20230105T100319_20230105T101207_T31NEH
                if '/' in image_id:
                    id_parts = image_id.split('/')
                    if len(id_parts) >= 3:
                        date_part = id_parts[-1][:8]  # Extract YYYYMMDD from the timestamp
                        if len(date_part) == 8 and date_part.isdigit():
                            date_str = f"{date_part[:4]}-{date_part[4:6]}-{date_part[6:8]}"
                        else:
                            date_str = 'Unknown'
                    else:
                        date_str = 'Unknown'
                else:
                    # Fallback: use system time
                    system_time = properties.get('system:time_start')
                    if system_time:
                        import datetime
                        date_obj = datetime.datetime.fromtimestamp(system_time / 1000)
                        date_str = date_obj.strftime('%Y-%m-%d')
                    else:
                        date_str = 'Unknown'
                cloud_cover_val = properties.get('CLOUDY_PIXEL_PERCENTAGE', 0)
            elif satellite.lower() == 'sentinel1':
                # Sentinel-1 date extraction from image ID
                # Format: COPERNICUS/S1_GRD/S1A_IW_GRDH_1SDV_20230105T052943_20230105T053008_046634_059F8D_0123
                if '/' in image_id:
                    id_parts = image_id.split('/')
                    if len(id_parts) >= 3:
                        # Extract date from S1 image ID (after second underscore)
                        s1_id = id_parts[-1]
                        if '_' in s1_id:
                            parts = s1_id.split('_')
                            if len(parts) >= 5:
                                date_part = parts[4][:8]  # Extract YYYYMMDD from timestamp
                                if len(date_part) == 8 and date_part.isdigit():
                                    date_str = f"{date_part[:4]}-{date_part[4:6]}-{date_part[6:8]}"
                                else:
                                    date_str = 'Unknown'
                            else:
                                date_str = 'Unknown'
                        else:
                            date_str = 'Unknown'
                    else:
                        date_str = 'Unknown'
                else:
                    # Fallback: use system time
                    system_time = properties.get('system:time_start')
                    if system_time:
                        import datetime
                        date_obj = datetime.datetime.fromtimestamp(system_time / 1000)
                        date_str = date_obj.strftime('%Y-%m-%d')
                    else:
                        date_str = 'Unknown'
                cloud_cover_val = 0  # Sentinel-1 SAR doesn't have cloud cover
            else:
                date_str = 'Unknown'
                cloud_cover_val = 0

            # Extract detailed satellite and sensor information
            spacecraft_id, sensor_id = extract_satellite_info(image_id, properties)

            images.append({
                'index': idx,
                'id': image_id,
                'date': date_str,
                'cloud_cover': round(float(cloud_cover_val), 2),
                'satellite': spacecraft_id,
                'sensor': sensor_id,
                'thumbnail': f'https://earthengine.googleapis.com/v1alpha/projects/{project_id}/thumbnails/{image_id}'
            })

        # Generate recommended selections (first 3 images with lowest cloud cover)
        recommended_indices = [i for i in range(min(3, len(images)))]

        return Response({
            'success': True,
            'images': images,
            'recommended_selections': recommended_indices,
            'total_count': image_count,
            'displayed_count': len(images),
            'satellite': satellite,
            'analysis_type': analysis_type,
            'date_range': f"{start_date} to {end_date}"
        })

    except Exception as e:
        logger.error(f"Error getting image metadata: {str(e)}")
        return Response(
            {"success": False, "error": f"Metadata retrieval error: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@extend_schema(
    summary="Get Analysis History",
    description="Retrieve history of all analysis requests and results.",
    responses={
        200: OpenApiResponse(response=OpenApiTypes.OBJECT, description="Analysis history retrieved"),
        500: OpenApiResponse(description="Server error during retrieval")
    }
)
@api_view(["GET"])
@authentication_classes([JWTAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated])
def get_analysis_history_endpoint(request):
    """Get analysis history for authenticated user"""
    try:
        # Get analysis history for the current user only
        user = request.user
        result = get_analysis_history(user_id=user.id)
        if result.get('success', False):
            return Response(result, status=status.HTTP_200_OK)
        else:
            return Response(result, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        logger.error(f"Error getting analysis history for user {request.user.id}: {str(e)}")
        return Response({
            'status': 'error',
            'message': f"Failed to retrieve analysis history: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    summary="Get Analysis Result",
    description="Retrieve a specific analysis result by ID.",
    responses={
        200: OpenApiResponse(response=OpenApiTypes.OBJECT, description="Analysis result retrieved"),
        404: OpenApiResponse(description="Analysis result not found"),
        500: OpenApiResponse(description="Server error during retrieval")
    }
)
@api_view(["GET"])
@authentication_classes([JWTAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated])
def get_analysis_result_endpoint(request, analysis_id):
    """Get analysis result for authenticated user"""
    try:
        # Verify user owns this analysis result
        user = request.user
        result = get_analysis_result_by_id(analysis_id, user_id=user.id)
        if result.get('success', False):
            return Response(result, status=status.HTTP_200_OK)
        else:
            return Response(result, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error getting analysis result {analysis_id} for user {request.user.id}: {str(e)}")
        return Response({
            'status': 'error',
            'message': f"Failed to retrieve analysis result: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    summary="Delete Analysis Result",
    description="Delete a specific analysis result by ID.",
    responses={
        200: OpenApiResponse(response=OpenApiTypes.OBJECT, description="Analysis result deleted"),
        404: OpenApiResponse(description="Analysis result not found"),
        500: OpenApiResponse(description="Server error during deletion")
    }
)
@api_view(["DELETE"])
@authentication_classes([JWTAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated])
def delete_analysis_result_endpoint(request, analysis_id):
    """Delete analysis result for authenticated user"""
    try:
        # Verify user owns this analysis result before deletion
        user = request.user
        result = delete_analysis_by_id(analysis_id, user_id=user.id)
        if result.get('success', False):
            return Response(result, status=status.HTTP_200_OK)
        else:
            return Response(result, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error deleting analysis result {analysis_id} for user {request.user.id}: {str(e)}")
        return Response({
            'status': 'error',
            'message': f"Failed to delete analysis result: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
