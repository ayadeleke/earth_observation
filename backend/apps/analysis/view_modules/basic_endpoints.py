"""
API endpoints for basic analysis operations.
Contains Django REST Framework views for NDVI, LST, and SAR analysis.
"""

import logging
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema, OpenApiResponse, OpenApiExample
from drf_spectacular.types import OpenApiTypes

from .request_handlers import (
    process_common_request_setup,
    parse_aoi_data,
    extract_common_parameters,
    finalize_analysis_response,
    create_error_response,
    create_health_check_response,
    create_not_implemented_response,
    create_deprecated_response
)
from .ndvi_analysis import process_ndvi_analysis
from .lst_analysis import process_lst_analysis
from .sar_analysis import process_sar_analysis

logger = logging.getLogger(__name__)


@extend_schema(
    summary="Process NDVI Analysis",
    description="Calculate Normalized Difference Vegetation Index (NDVI) for the specified area and time period using Landsat or Sentinel-2 data.",
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'aoi_data': {'type': 'string', 'description': 'GeoJSON string of Area of Interest'},
                'start_date': {'type': 'string', 'format': 'date', 'description': 'Start date (YYYY-MM-DD)'},
                'end_date': {'type': 'string', 'format': 'date', 'description': 'End date (YYYY-MM-DD)'},
                'satellite': {'type': 'string', 'enum': ['landsat', 'sentinel2'], 'default': 'landsat'},
                'cloud_cover': {'type': 'integer', 'minimum': 0, 'maximum': 100, 'default': 20}
            },
            'required': ['aoi_data', 'start_date', 'end_date'],
            'example': {
                'aoi_data': '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-1.5,6.5],[-1.0,6.5],[-1.0,7.0],[-1.5,7.0],[-1.5,6.5]]]},"properties":{}}]}',
                'start_date': '2023-01-01',
                'end_date': '2023-12-31',
                'satellite': 'landsat',
                'cloud_cover': 20
            }
        }
    },
    responses={
        200: OpenApiResponse(
            response=OpenApiTypes.OBJECT,
            description="NDVI analysis results",
            examples=[
                OpenApiExample(
                    'Successful Analysis',
                    value={
                        "success": True,
                        "demo_mode": False,
                        "analysis_type": "NDVI",
                        "satellite": "Landsat (Real Data)",
                        "data": [
                            {
                                "date": "2023-06-15",
                                "ndvi": 0.7245,
                                "lat": 6.75,
                                "lon": -1.25,
                                "cloud_cover": 12.5,
                                "image_id": "LANDSAT/LC08/C02/T1_L2/LC08_193056_20230615",
                                "satellite": "Landsat 8/9"
                            }
                        ],
                        "statistics": {
                            "mean_ndvi": 0.6834,
                            "min_ndvi": 0.4521,
                            "max_ndvi": 0.8234,
                            "std_ndvi": 0.0892,
                            "area_km2": 625.4,
                            "pixel_count": 69505,
                            "date_range": "2023-01-01 to 2023-12-31"
                        },
                        "message": "Real Earth Engine NDVI analysis completed successfully using 48 images",
                        "timestamp": "2024-01-15T10:30:45.123Z"
                    }
                )
            ]
        ),
        400: OpenApiResponse(description="Invalid request parameters"),
        500: OpenApiResponse(description="Server error during analysis")
    }
)
@api_view(["POST"])
@permission_classes([AllowAny])
def process_ndvi(request):
    """Process NDVI analysis with simplified, working approach"""
    try:
        # Common request setup
        data, error_response = process_common_request_setup(request, 'NDVI')
        if error_response:
            return error_response

        # Extract parameters
        params = extract_common_parameters(data, 'NDVI')

        # Parse AOI data
        geometry, aoi_error = parse_aoi_data(params['aoi_data'])
        if aoi_error:
            return create_error_response('NDVI', aoi_error)

        # Process NDVI analysis using modular approach
        logger.info(f"Processing {params['satellite']} NDVI analysis")
        logger.info(f"Cloud masking parameters: use_cloud_masking={params.get('use_cloud_masking', False)}, strict_masking={params.get('strict_masking', False)}")
        analysis_results = process_ndvi_analysis(
            geometry=geometry,
            start_date=params['start_date'],
            end_date=params['end_date'],
            satellite=params['satellite'],
            cloud_cover=params['cloud_cover'],
            use_cloud_masking=params.get('use_cloud_masking', False),
            strict_masking=params.get('strict_masking', False)
        )

        # Add processed geometry to response for frontend map display
        if analysis_results.get('success', False):
            try:
                # Convert Earth Engine geometry to GeoJSON for frontend
                geometry_geojson = geometry.getInfo()
                analysis_results['geometry'] = geometry_geojson
                logger.info("Added processed geometry to NDVI analysis response")
            except Exception as e:
                logger.warning(f"Could not add geometry to response: {str(e)}")

        # Finalize response
        return finalize_analysis_response(request, data, analysis_results, 'NDVI', 'ndvi')

    except Exception as e:
        return create_error_response('NDVI', e)


@extend_schema(
    summary="Process LST Analysis",
    description="Calculate Land Surface Temperature (LST) for the specified area and time period using Landsat thermal bands.",
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'aoi_data': {'type': 'string', 'description': 'GeoJSON string of Area of Interest'},
                'start_date': {'type': 'string', 'format': 'date', 'description': 'Start date (YYYY-MM-DD)'},
                'end_date': {'type': 'string', 'format': 'date', 'description': 'End date (YYYY-MM-DD)'},
                'cloud_cover': {'type': 'integer', 'minimum': 0, 'maximum': 100, 'default': 20}
            },
            'required': ['aoi_data', 'start_date', 'end_date']
        }
    },
    responses={
        200: OpenApiResponse(response=OpenApiTypes.OBJECT, description="LST analysis results"),
        400: OpenApiResponse(description="Invalid request parameters"),
        500: OpenApiResponse(description="Server error during analysis")
    }
)
@api_view(["POST"])
@permission_classes([AllowAny])
def process_lst(request):
    """Process Land Surface Temperature analysis"""
    try:
        # Common request setup
        data, error_response = process_common_request_setup(request, 'LST')
        if error_response:
            return error_response

        # Extract parameters
        params = extract_common_parameters(data, 'LST')

        # Parse AOI data
        geometry, aoi_error = parse_aoi_data(params['aoi_data'])
        if aoi_error:
            return create_error_response('LST', aoi_error)

        # Process LST analysis
        logger.info("Processing LST analysis")
        logger.info(f"Cloud masking parameters: use_cloud_masking={params.get('use_cloud_masking', False)}, strict_masking={params.get('strict_masking', False)}")
        analysis_results = process_lst_analysis(
            geometry=geometry,
            start_date=params['start_date'],
            end_date=params['end_date'],
            cloud_cover=params['cloud_cover'],
            use_cloud_masking=params.get('use_cloud_masking', False),
            strict_masking=params.get('strict_masking', False)
        )

        # Add processed geometry to response for frontend map display
        if analysis_results.get('success', False):
            try:
                # Convert Earth Engine geometry to GeoJSON for frontend
                geometry_geojson = geometry.getInfo()
                analysis_results['geometry'] = geometry_geojson
                logger.info("Added processed geometry to LST analysis response")
            except Exception as e:
                logger.warning(f"Could not add geometry to response: {str(e)}")

        # Finalize response
        return finalize_analysis_response(request, data, analysis_results, 'LST', 'lst')

    except Exception as e:
        return create_error_response('LST', e)


@extend_schema(
    summary="Process SAR Analysis", 
    description="Process Synthetic Aperture Radar (SAR) analysis using Sentinel-1 data.",
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'aoi_data': {'type': 'string', 'description': 'GeoJSON string of Area of Interest'},
                'start_date': {'type': 'string', 'format': 'date', 'description': 'Start date (YYYY-MM-DD)'},
                'end_date': {'type': 'string', 'format': 'date', 'description': 'End date (YYYY-MM-DD)'},
                'orbit_direction': {'type': 'string', 'enum': ['ASCENDING', 'DESCENDING'], 'default': 'DESCENDING'}
            },
            'required': ['aoi_data', 'start_date', 'end_date']
        }
    },
    responses={
        200: OpenApiResponse(response=OpenApiTypes.OBJECT, description="SAR analysis results"),
        400: OpenApiResponse(description="Invalid request parameters"),
        500: OpenApiResponse(description="Server error during analysis")
    }
)
@api_view(["POST"])
@permission_classes([AllowAny])
def process_sentinel(request):
    """Process SAR analysis using Sentinel-1 data"""
    try:
        # Common request setup
        data, error_response = process_common_request_setup(request, 'SAR')
        if error_response:
            return error_response

        # Extract parameters
        params = extract_common_parameters(data, 'SAR')

        # Parse AOI data
        geometry, aoi_error = parse_aoi_data(params['aoi_data'])
        if aoi_error:
            return create_error_response('SAR', aoi_error)

        # Process SAR analysis
        logger.info("Processing SAR analysis")
        analysis_results = process_sar_analysis(
            geometry=geometry,
            start_date=params['start_date'],
            end_date=params['end_date'],
            orbit_direction=params['orbit_direction']
        )

        # Add processed geometry to response for frontend map display
        if analysis_results.get('success', False):
            try:
                # Convert Earth Engine geometry to GeoJSON for frontend
                geometry_geojson = geometry.getInfo()
                analysis_results['geometry'] = geometry_geojson
                logger.info("Added processed geometry to SAR analysis response")
            except Exception as e:
                logger.warning(f"Could not add geometry to response: {str(e)}")

        # Finalize response
        return finalize_analysis_response(request, data, analysis_results, 'SAR', 'sar')

    except Exception as e:
        return create_error_response('SAR', e)


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """Health check endpoint"""
    return create_health_check_response()


# Legacy compatibility endpoints
@api_view(["POST"])
@permission_classes([AllowAny])
def process_lst_request(request):
    """Legacy LST endpoint - redirects to process_lst"""
    return process_lst(request)


@api_view(["GET"])
@permission_classes([AllowAny])
def process_analysis_generic(request, analysis_type):
    """Generic analysis endpoint for backward compatibility"""
    return create_deprecated_response(
        "Generic analysis endpoint",
        [
            "/api/analysis/process_ndvi/",
            "/api/analysis/process_lst/", 
            "/api/analysis/process_sentinel/"
        ]
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def get_image_metadata(request):
    """Get metadata for satellite images"""
    return create_not_implemented_response("Image metadata")


# Additional utility endpoints that could be implemented
@api_view(["GET"])
@permission_classes([AllowAny])
def list_available_satellites(request):
    """List available satellites and their capabilities"""
    return {
        "satellites": {
            "landsat": {
                "description": "Landsat 8/9 Collection 2",
                "bands": ["SR_B1", "SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B6", "SR_B7", "ST_B10"],
                "indices": ["NDVI", "LST", "NDWI", "NDBI", "EVI"],
                "resolution": "30m",
                "temporal_coverage": "2013-present"
            },
            "sentinel2": {
                "description": "Sentinel-2 MSI Harmonized",
                "bands": ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B8A", "B9", "B11", "B12"],
                "indices": ["NDVI", "NDWI", "NDBI", "EVI"],
                "resolution": "10m",
                "temporal_coverage": "2015-present"
            },
            "sentinel1": {
                "description": "Sentinel-1 SAR GRD",
                "polarizations": ["VV", "VH"],
                "indices": ["VV/VH ratio", "Backscatter"],
                "resolution": "10m",
                "temporal_coverage": "2014-present"
            }
        }
    }