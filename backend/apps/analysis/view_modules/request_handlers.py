"""
Request handling utilities for analysis endpoints.
Handles common request processing, validation, and response formatting.
"""

import json
import logging
from datetime import datetime
from rest_framework import status
from rest_framework.response import Response
from shapely.wkt import loads as wkt_loads
from shapely.geometry import mapping
try:
    from shapely import wkt
    SHAPELY_AVAILABLE = True
except ImportError:
    SHAPELY_AVAILABLE = False
    wkt = None

from apps.earth_engine.ee_config import initialize_earth_engine
from .earth_engine import wkt_to_ee_geometry, geojson_to_ee_geometry, validate_coordinates
from .data_processing import validate_analysis_request, export_to_csv, create_plot
from .database_operations import save_analysis_to_database

logger = logging.getLogger(__name__)


def process_shapefile_upload(shapefile_obj):
    """
    Process uploaded shapefile and extract geometry (Django version)

    Args:
        shapefile_obj: Django file upload object

    Returns:
        tuple: (success: bool, result: str or dict, error_message: str or None)
    """
    if not SHAPELY_AVAILABLE:
        logger.error("Shapely not available for shapefile processing")
        return False, None, "Shapefile upload requires shapely. Please install with: pip install shapely geopandas"

    logger.info(f"Processing shapefile: {shapefile_obj.name}")

    try:
        import os
        import tempfile
        import zipfile
        try:
            import geopandas as gpd
            from shapely.geometry import mapping as geom_mapping
            GEOPANDAS_AVAILABLE = True
        except ImportError:
            logger.error("GeoPandas not available for shapefile processing")
            return False, None, "Shapefile upload requires geopandas. Please install with: pip install geopandas"

        # Create temporary directory for extraction
        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = os.path.join(temp_dir, shapefile_obj.name)

            # Save uploaded file
            with open(zip_path, 'wb') as f:
                for chunk in shapefile_obj.chunks():
                    f.write(chunk)
            logger.info(f"Shapefile saved to: {zip_path}")

            # Extract ZIP file
            try:
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_contents = zip_ref.namelist()
                    logger.info(f"ZIP contents: {zip_contents}")

                    zip_ref.extractall(temp_dir)
                    logger.info(f"ZIP file extracted to: {temp_dir}")

                    # Find all extracted files
                    extracted_files = []
                    for root, dirs, files in os.walk(temp_dir):
                        for file in files:
                            rel_path = os.path.relpath(os.path.join(root, file), temp_dir)
                            extracted_files.append(rel_path)

                    logger.info(f"All extracted files: {extracted_files}")

            except zipfile.BadZipFile:
                return False, None, "Invalid ZIP file. Please upload a valid shapefile ZIP."
            except Exception as e:
                return False, None, f"Error extracting ZIP file: {str(e)}"

            # Find shapefile components
            shp_files = [f for f in extracted_files if f.lower().endswith('.shp')]

            if not shp_files:
                extensions_found = set(os.path.splitext(f)[1].lower() for f in extracted_files)
                return False, None, f"No .shp file found in the uploaded ZIP. Found file extensions: {', '.join(sorted(extensions_found))}"

            if len(shp_files) > 1:
                return False, None, f"Multiple .shp files found: {shp_files}. Please upload a ZIP with only one shapefile."

            shp_file = shp_files[0]
            base_name = os.path.splitext(os.path.basename(shp_file))[0]
            shp_dir = os.path.dirname(shp_file) if os.path.dirname(shp_file) else ""

            logger.info(f"Found shapefile: {shp_file}")

            # Check for required components
            required_extensions = ['.shp', '.shx', '.dbf']
            missing_components = []

            for ext in required_extensions:
                pattern_files = [f for f in extracted_files
                                 if os.path.dirname(f) == shp_dir and
                                 os.path.splitext(os.path.basename(f))[0].lower() == base_name.lower() and
                                 os.path.splitext(f)[1].lower() == ext.lower()]

                if not pattern_files:
                    missing_components.append(ext)

            if missing_components:
                found_files = [f for f in extracted_files
                               if os.path.splitext(os.path.basename(f))[0].lower() == base_name.lower()]
                return False, None, f"Missing required shapefile components: {', '.join(missing_components)}. Found files for '{base_name}': {found_files}"

            # Read shapefile
            shp_path = os.path.join(temp_dir, shp_file)
            logger.info(f"Reading shapefile from: {shp_path}")

            try:
                gdf = gpd.read_file(shp_path)
                logger.info(f"Shapefile loaded successfully. Shape: {gdf.shape}")
                logger.info(f"CRS: {gdf.crs}")

                if gdf.empty:
                    return False, None, "Shapefile is empty (no features found)."

                # Convert to WGS84 if needed
                if gdf.crs != 'EPSG:4326':
                    logger.info(f"Converting CRS from {gdf.crs} to EPSG:4326")
                    gdf = gdf.to_crs('EPSG:4326')

                # Use the first feature if multiple features exist
                if len(gdf) > 1:
                    logger.info(f"Warning: Shapefile contains {len(gdf)} features. Using the first feature.")
                    gdf = gdf.iloc[:1]

                # Get geometry as GeoJSON
                geom = gdf.geometry.iloc[0]
                geojson_geom = geom_mapping(geom)

                logger.info(f"Geometry type: {geom.geom_type}")
                logger.info(f"Geometry bounds: {geom.bounds}")

                # Convert to WKT for consistency
                wkt_str = geom.wkt
                logger.info(f"WKT geometry: {wkt_str[:200]}...")

                # Store both WKT and GeoJSON
                result = {
                    'wkt': wkt_str,
                    'geojson': geojson_geom,
                    'bounds': geom.bounds,
                    'geometry_type': geom.geom_type
                }

                return True, result, None

            except Exception as e:
                return False, None, f"Error reading shapefile: {str(e)}. Please ensure it's a valid shapefile."

    except Exception as e:
        logger.error(f"Error processing shapefile: {str(e)}")
        return False, None, f"Error processing shapefile: {str(e)}"


def convert_coordinates_to_geojson(coordinates_data):
    """Convert coordinates data to GeoJSON format - handles multiple input formats"""
    try:
        if not coordinates_data:
            return None

        # If it's already a string, try to parse as WKT first, then as JSON
        if isinstance(coordinates_data, str):
            if coordinates_data.strip() == '':
                return None

            # Try parsing as JSON first (could be stringified GeoJSON)
            try:
                parsed_json = json.loads(coordinates_data)
                if isinstance(parsed_json, dict) and 'type' in parsed_json:
                    # It's already GeoJSON, wrap in FeatureCollection if needed
                    if parsed_json['type'] == 'FeatureCollection':
                        return coordinates_data
                    elif parsed_json['type'] in ['Polygon', 'Point', 'LineString', 'MultiPolygon']:
                        feature_collection = {
                            "type": "FeatureCollection",
                            "features": [
                                {
                                    "type": "Feature",
                                    "geometry": parsed_json,
                                    "properties": {}
                                }
                            ]
                        }
                        return json.dumps(feature_collection)
            except json.JSONDecodeError:
                pass

            # Try parsing as WKT
            try:
                geometry = wkt_loads(coordinates_data)
                geojson_geometry = mapping(geometry)
                feature_collection = {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": geojson_geometry,
                            "properties": {}
                        }
                    ]
                }
                return json.dumps(feature_collection)
            except Exception:
                pass

        # If it's a dict, handle as coordinate arrays or GeoJSON
        elif isinstance(coordinates_data, dict):
            # Check if it's already GeoJSON
            if 'type' in coordinates_data:
                if coordinates_data['type'] == 'FeatureCollection':
                    return json.dumps(coordinates_data)
                elif coordinates_data['type'] in ['Polygon', 'Point', 'LineString', 'MultiPolygon']:
                    feature_collection = {
                        "type": "FeatureCollection",
                        "features": [
                            {
                                "type": "Feature",
                                "geometry": coordinates_data,
                                "properties": {}
                            }
                        ]
                    }
                    return json.dumps(feature_collection)

        # If it's a list, assume it's coordinate pairs for a polygon
        elif isinstance(coordinates_data, list):
            if len(coordinates_data) > 0:
                # Assume it's a polygon coordinate array
                polygon_geometry = {
                    "type": "Polygon",
                    "coordinates": [coordinates_data]
                }
                feature_collection = {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": polygon_geometry,
                            "properties": {}
                        }
                    ]
                }
                return json.dumps(feature_collection)

        logger.warning(f"Unable to convert coordinates data: {type(coordinates_data)} - {coordinates_data}")
        return None

    except Exception as e:
        logger.error(f"Error converting coordinates to GeoJSON: {str(e)}")
        return None


def process_common_request_setup(request, analysis_type):
    """Common setup for all analysis requests"""
    try:
        logger.info(f"Starting {analysis_type} analysis request")

        # Initialize Earth Engine
        initialize_earth_engine()

        # Get request data - handle both JSON and FormData
        if hasattr(request, "data") and request.data:
            data = request.data.copy()  # Make a copy to avoid modifying original
        else:
            # Handle FormData from frontend - check both POST and FILES
            data = {}

            # Add POST data
            if hasattr(request, 'POST') and request.POST:
                for key, value in request.POST.items():
                    if isinstance(value, list) and len(value) == 1:
                        data[key] = value[0]
                    else:
                        data[key] = value

            # Add FILES data
            if hasattr(request, 'FILES') and request.FILES:
                for key, value in request.FILES.items():
                    data[key] = value

            # If still empty, try to get from request.data
            if not data and hasattr(request, 'data'):
                data = dict(request.data)

        logger.info(f"Raw request data keys: {list(data.keys())}")

        # Debug: Log the coordinates data specifically
        if 'coordinates' in data:
            coord_data = data['coordinates']
            logger.info(f"Coordinates data type: {type(coord_data)}")
            logger.info(f"Coordinates data sample: {str(coord_data)[:200]}")

        # Map frontend field names to backend expected names
        field_mapping = {
            # Coordinates
            'coordinates': 'aoi_data',
            # Date parameters
            'startDate': 'start_date',
            'endDate': 'end_date',
            'start_date': 'start_date',
            'end_date': 'end_date',
            'start_year': 'start_year',
            'end_year': 'end_year',
            # Analysis parameters
            'satellite': 'satellite',
            'analysisType': 'analysis_type',
            'analysis_type': 'analysis_type',
            # Cloud parameters
            'cloudCover': 'cloud_cover',
            'cloudCoverValue': 'cloud_cover',
            'enableCloudMasking': 'use_cloud_masking',
            'maskingStrictness': 'strict_masking',
            'cloud_cover': 'cloud_cover',
            'use_cloud_masking': 'use_cloud_masking',
            'strict_masking': 'strict_masking',
            # Other parameters
            'project_id': 'project_id',
            'date_range_type': 'date_range_type',
            'polarization': 'polarization'
        }

        # Apply field mapping with special handling for coordinates
        mapped_data = {}
        for frontend_key, backend_key in field_mapping.items():
            if frontend_key in data:
                if frontend_key == 'coordinates':
                    # Convert coordinates to GeoJSON format
                    coordinates_data = data[frontend_key]
                    geojson_string = convert_coordinates_to_geojson(coordinates_data)
                    if geojson_string:
                        mapped_data[backend_key] = geojson_string
                    else:
                        logger.warning(f"Failed to convert coordinates: {coordinates_data}")
                else:
                    mapped_data[backend_key] = data[frontend_key]

        # Special handling for coordinates -> aoi_data conversion
        coordinates_processed = False

        # Check if shapefile data is provided
        if 'shapefile' in data and data['shapefile']:
            logger.info("Processing shapefile data from request")
            shapefile_data = data['shapefile']
            logger.info(f"Shapefile data type: {type(shapefile_data)}")

            if not SHAPELY_AVAILABLE:
                logger.error("Shapely not available for shapefile processing")
            else:
                try:
                    # Check if it's a file upload (Django InMemoryUploadedFile or similar)
                    if hasattr(shapefile_data, 'read') and hasattr(shapefile_data, 'name'):
                        logger.info(f"Processing uploaded shapefile: {shapefile_data.name}")
                        success, result, error = process_shapefile_upload(shapefile_data)
                        if success and result and 'wkt' in result:
                            wkt_str = result['wkt']
                            logger.info(f"Converting shapefile WKT: {wkt_str[:100]}...")

                            # Convert WKT to GeoJSON format
                            geom = wkt_loads(wkt_str)
                            geojson_geom = mapping(geom)

                            # Create FeatureCollection format expected by backend
                            aoi_geojson = {
                                "type": "FeatureCollection",
                                "features": [{
                                    "type": "Feature",
                                    "geometry": geojson_geom,
                                    "properties": {}
                                }]
                            }
                            mapped_data['aoi_data'] = json.dumps(aoi_geojson)
                            coordinates_processed = True
                            logger.info("Successfully converted shapefile to GeoJSON")
                        else:
                            logger.error(f"Failed to process shapefile upload: {error}")
                    # If shapefile data contains geometry information (already processed)
                    elif isinstance(shapefile_data, dict) and 'wkt' in shapefile_data:
                        wkt_str = shapefile_data['wkt']
                        logger.info(f"Converting shapefile WKT: {wkt_str[:100]}...")

                        # Convert WKT to GeoJSON format
                        geom = wkt_loads(wkt_str)
                        geojson_geom = mapping(geom)

                        # Create FeatureCollection format expected by backend
                        aoi_geojson = {
                            "type": "FeatureCollection",
                            "features": [{
                                "type": "Feature",
                                "geometry": geojson_geom,
                                "properties": {}
                            }]
                        }
                        mapped_data['aoi_data'] = json.dumps(aoi_geojson)
                        coordinates_processed = True
                        logger.info("Successfully converted shapefile WKT to GeoJSON")
                    elif isinstance(shapefile_data, str) and shapefile_data.strip():
                        # Assume it's WKT string directly
                        logger.info(f"Converting shapefile WKT string: {shapefile_data[:100]}...")
                        geom = wkt_loads(shapefile_data)
                        geojson_geom = mapping(geom)

                        aoi_geojson = {
                            "type": "FeatureCollection",
                            "features": [{
                                "type": "Feature",
                                "geometry": geojson_geom,
                                "properties": {}
                            }]
                        }
                        mapped_data['aoi_data'] = json.dumps(aoi_geojson)
                        coordinates_processed = True
                        logger.info("Successfully converted shapefile WKT string to GeoJSON")
                    else:
                        logger.info(f"Shapefile data format not recognized: {type(shapefile_data)}")
                        if isinstance(shapefile_data, dict):
                            logger.info(f"Available keys: {list(shapefile_data.keys())}")
                except Exception as e:
                    logger.error(f"Error processing shapefile data: {e}")
                    import traceback
                    logger.error(f"Traceback: {traceback.format_exc()}")

        # Fall back to coordinates field if shapefile processing didn't work
        if not coordinates_processed and 'coordinates' in data and data['coordinates']:
            coordinates_str = data['coordinates']
            logger.info(f"Converting coordinates: {coordinates_str[:100]}...")

            # Check if it's WKT format or already GeoJSON
            if coordinates_str.strip().startswith('POLYGON') or coordinates_str.strip().startswith('POINT'):
                # Convert WKT to GeoJSON format
                try:
                    from shapely import wkt
                    from shapely.geometry import mapping
                    geom = wkt.loads(coordinates_str)
                    geojson_geom = mapping(geom)

                    # Create FeatureCollection format expected by backend
                    aoi_geojson = {
                        "type": "FeatureCollection",
                        "features": [{
                            "type": "Feature",
                            "geometry": geojson_geom,
                            "properties": {}
                        }]
                    }
                    mapped_data['aoi_data'] = json.dumps(aoi_geojson)
                    logger.info("Successfully converted WKT to GeoJSON")
                except Exception as e:
                    logger.error(f"Error converting WKT to GeoJSON: {e}")
                    # Fallback: create a simple polygon if coordinates look like lat/lon pairs
                    mapped_data['aoi_data'] = coordinates_str
            else:
                # Assume it's already in the right format
                mapped_data['aoi_data'] = coordinates_str

        # Copy any direct matches and additional fields
        for key, value in data.items():
            if key not in field_mapping:
                # Check if it's already a backend field
                if key in ['aoi_data', 'start_date', 'end_date', 'satellite', 'cloud_cover', 'analysis_type']:
                    mapped_data[key] = value
                else:
                    # Keep additional fields like projectId, dateRangeType, etc.
                    mapped_data[key] = value

        # Ensure analysis_type is set
        if 'analysis_type' not in mapped_data:
            mapped_data['analysis_type'] = analysis_type.lower()

        logger.info(f"Mapped data keys: {list(mapped_data.keys())}")
        logger.info(f"Mapped data preview: {{'aoi_data': {'present' if 'aoi_data' in mapped_data else 'missing'}, 'start_date': mapped_data.get('start_date', 'missing'), 'end_date': mapped_data.get('end_date', 'missing')}}")

        # Validate request
        is_valid, validation_message = validate_analysis_request(mapped_data)
        if not is_valid:
            logger.warning(f"Validation failed: {validation_message}")
            return None, Response({
                "success": False,
                "error": validation_message
            }, status=status.HTTP_400_BAD_REQUEST)

        return mapped_data, None

    except Exception as e:
        error_message = f"{analysis_type} request setup error: {str(e)}"
        logger.error(error_message, exc_info=True)
        return None, Response({
            "success": False,
            "error": error_message,
            "timestamp": datetime.now().isoformat()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def parse_aoi_data(aoi_data):
    """Parse AOI data from request - handles both GeoJSON and WKT formats"""
    try:
        if not aoi_data:
            return None, "AOI data is required"

        # If it's a string, try to parse as JSON first (GeoJSON), then as WKT
        if isinstance(aoi_data, str):
            try:
                # Try parsing as JSON (GeoJSON)
                aoi_json = json.loads(aoi_data)
                geometry = geojson_to_ee_geometry(aoi_json)
            except json.JSONDecodeError:
                # Try parsing as WKT
                try:
                    geometry = wkt_to_ee_geometry(aoi_data)
                except ValueError as wkt_error:
                    return None, f"Invalid AOI format - not valid JSON or WKT: {str(wkt_error)}"
        else:
            # It's already a dict (parsed JSON), treat as GeoJSON
            geometry = geojson_to_ee_geometry(aoi_data)

        # Validate coordinates (this should show Ghana path/row 193/056)
        is_valid_coords, coord_message = validate_coordinates(geometry)
        if not is_valid_coords:
            logger.warning(f"Coordinate validation warning: {coord_message}")

        return geometry, None

    except Exception as e:
        error_message = f"AOI parsing error: {str(e)}"
        logger.error(error_message, exc_info=True)
        return None, error_message


def extract_common_parameters(data, analysis_type):
    """Extract common parameters from request data"""
    try:
        # Handle both year-based and date-based ranges
        start_date = data.get('start_date')
        end_date = data.get('end_date')

        # Convert year-based ranges to date ranges if needed
        if data.get('start_year') and data.get('end_year'):
            start_date = f"{data.get('start_year')}-01-01"
            end_date = f"{data.get('end_year')}-12-31"
            logger.info(f"Converted year range {data.get('start_year')}-{data.get('end_year')} to date range {start_date} to {end_date}")

        # Convert boolean parameters properly (handle both boolean and string inputs)
        use_cloud_masking = data.get('use_cloud_masking', False)
        if isinstance(use_cloud_masking, str):
            use_cloud_masking = use_cloud_masking.lower() in ['true', '1', 'yes']

        strict_masking = data.get('strict_masking', False)
        if isinstance(strict_masking, str):
            strict_masking = strict_masking.lower() in ['true', '1', 'yes', 'strict']

        params = {
            'aoi_data': data.get('aoi_data'),
            'start_date': start_date,
            'end_date': end_date,
            'cloud_cover': int(data.get('cloud_cover', 20)),
            'use_cloud_masking': use_cloud_masking,
            'strict_masking': strict_masking
        }

        logger.info(f"Extracted cloud cover parameter: {params['cloud_cover']}%")
        logger.info(f"Extracted cloud masking parameters: use_cloud_masking={params['use_cloud_masking']}, strict_masking={params['strict_masking']}")

        # Add type-specific parameters
        if analysis_type.lower() in ['ndvi', 'comprehensive', 'trends', 'composite']:
            params['satellite'] = data.get('satellite', 'landsat').lower()

        if analysis_type.lower() == 'sar':
            params['orbit_direction'] = data.get('orbit_direction', 'DESCENDING')

        if analysis_type.lower() == 'comprehensive':
            params['analysis_types'] = data.get('analysis_types', ['ndvi', 'lst'])

        if analysis_type.lower() == 'trends':
            params['analysis_type'] = data.get('analysis_type', 'ndvi')
            params['time_window'] = data.get('time_window', 'monthly')

        if analysis_type.lower() == 'composite':
            params['composite_method'] = data.get('composite_method', 'median')

        return params

    except Exception as e:
        logger.error(f"Parameter extraction error: {str(e)}")
        raise


def finalize_analysis_response(request, data, analysis_results, analysis_type, file_prefix):
    """Finalize analysis response with file generation and database saving"""
    try:
        # Add cloud masking parameters to response
        use_cloud_masking = data.get('use_cloud_masking', False)
        strict_masking = data.get('strict_masking', False)

        # Add cloud masking info to response for frontend
        analysis_results['cloud_masking_settings'] = {
            'enabled': use_cloud_masking,
            'strict': strict_masking,
            'level': 'strict' if strict_masking else ('recommended' if use_cloud_masking else 'disabled')
        }

        logger.info(f"Adding cloud masking settings to {analysis_type} response: enabled={use_cloud_masking}, strict={strict_masking}")

        # Save to database
        # Extract project from request data if provided
        project = None
        if data.get('project_id'):
            try:
                from apps.core.models import AnalysisProject
                project = AnalysisProject.objects.get(id=data['project_id'], user=request.user)
            except AnalysisProject.DoesNotExist:
                logger.warning(f"Project {data['project_id']} not found for user {request.user}")
        
        save_result = save_analysis_to_database(
            data,
            analysis_results,
            analysis_type,
            request.user if request.user.is_authenticated else None,
            project
        )
        
        # Handle save result
        if save_result:
            analysis_results['analysis_id'] = save_result['analysis_id']
            if save_result.get('is_duplicate'):
                analysis_results['is_duplicate'] = True
                analysis_results['duplicate_message'] = save_result['message']
                logger.info(f"Returning existing analysis: {save_result['message']}")
            else:
                analysis_results['is_duplicate'] = False
                logger.info(f"Created new analysis: {save_result['message']}")
        else:
            logger.warning("Failed to save analysis to database")

        # Generate CSV and plot files if data exists
        if analysis_results.get('data'):
            try:
                csv_file = export_to_csv(analysis_results['data'], f'{file_prefix}_data', analysis_type)
                plot_file = create_plot(analysis_results['data'], analysis_type, file_prefix)

                if csv_file:
                    analysis_results['csv_url'] = f"/media/{csv_file}"
                if plot_file:
                    analysis_results['plot_url'] = f"/media/{plot_file}"
            except Exception as e:
                logger.warning(f"File generation error: {str(e)}")

        logger.info(f"{analysis_type} analysis completed successfully")
        return Response(analysis_results, status=status.HTTP_200_OK)

    except Exception as e:
        error_message = f"{analysis_type} response finalization error: {str(e)}"
        logger.error(error_message)
        return Response({
            "success": False,
            "error": error_message,
            "timestamp": datetime.now().isoformat()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def create_error_response(analysis_type, error):
    """Create standardized error response"""
    error_message = f"{analysis_type} analysis error: {str(error)}"
    logger.error(error_message)
    return Response({
        "success": False,
        "error": error_message,
        "timestamp": datetime.now().isoformat()
    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def create_health_check_response():
    """Create health check response"""
    try:
        # Test Earth Engine initialization
        initialize_earth_engine()
        ee_status = "connected"
    except Exception as e:
        ee_status = f"error: {str(e)}"

    return Response({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "earth_engine": ee_status,
        "version": "2.0.0 (Modular)"
    }, status=status.HTTP_200_OK)


def create_not_implemented_response(endpoint_name):
    """Create not implemented response for legacy endpoints"""
    return Response({
        "success": False,
        "error": f"{endpoint_name} endpoint not yet implemented in modular version",
        "message": "Use individual analysis endpoints for now"
    }, status=status.HTTP_501_NOT_IMPLEMENTED)


def create_deprecated_response(old_endpoint, new_endpoints):
    """Create deprecated endpoint response"""
    return Response({
        "success": False,
        "error": f"{old_endpoint} endpoint deprecated. Use specific endpoints instead.",
        "available_endpoints": new_endpoints
    }, status=status.HTTP_400_BAD_REQUEST)


def validate_analysis_id(analysis_id):
    """Validate analysis ID parameter"""
    try:
        analysis_id = int(analysis_id)
        if analysis_id <= 0:
            raise ValueError("Analysis ID must be positive")
        return analysis_id, None
    except (ValueError, TypeError) as e:
        return None, f"Invalid analysis ID: {str(e)}"


def log_request_info(request, analysis_type):
    """Log request information for debugging"""
    try:
        user_info = "authenticated" if request.user.is_authenticated else "anonymous"
        logger.info(f"{analysis_type} request from {user_info} user")
        logger.debug(f"Request method: {request.method}")
        logger.debug(f"Request headers: {dict(request.headers)}")
        if hasattr(request, 'data'):
            logger.debug(f"Request data keys: {list(request.data.keys()) if request.data else 'None'}")
    except Exception as e:
        logger.warning(f"Failed to log request info: {str(e)}")


def extract_request_metadata(request):
    """Extract metadata from request for logging/analytics"""
    try:
        metadata = {
            "timestamp": datetime.now().isoformat(),
            "method": request.method,
            "user_authenticated": request.user.is_authenticated,
            "user_agent": request.META.get('HTTP_USER_AGENT', 'Unknown'),
            "remote_addr": request.META.get('REMOTE_ADDR', 'Unknown'),
            "content_type": request.META.get('CONTENT_TYPE', 'Unknown')
        }

        if request.user.is_authenticated:
            metadata["user_id"] = request.user.id
            metadata["username"] = request.user.username

        return metadata
    except Exception as e:
        logger.warning(f"Failed to extract request metadata: {str(e)}")
        return {"timestamp": datetime.now().isoformat(), "error": str(e)}
