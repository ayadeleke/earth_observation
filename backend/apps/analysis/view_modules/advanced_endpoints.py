"""
API endpoints for advanced analysis operations.
Contains Django REST Framework views for comprehensive, trend, and composite analysis.
"""

import logging
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema, OpenApiResponse
from drf_spectacular.types import OpenApiTypes

from .request_handlers import (
    process_common_request_setup,
    parse_aoi_data,
    extract_common_parameters,
    finalize_analysis_response,
    create_error_response
)
from .comprehensive_analysis import (
    process_comprehensive_analysis,
    process_trend_analysis,
    process_composite_analysis
)

logger = logging.getLogger(__name__)


@extend_schema(
    summary="Process Comprehensive Analysis",
    description="Perform comprehensive analysis combining multiple indicators (NDVI, LST, SAR) for the specified area and time period.",
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'aoi_data': {'type': 'string', 'description': 'GeoJSON string of Area of Interest'},
                'start_date': {'type': 'string', 'format': 'date', 'description': 'Start date (YYYY-MM-DD)'},
                'end_date': {'type': 'string', 'format': 'date', 'description': 'End date (YYYY-MM-DD)'},
                'analysis_types': {
                    'type': 'array', 
                    'items': {'type': 'string', 'enum': ['ndvi', 'lst', 'sar']},
                    'default': ['ndvi', 'lst'],
                    'description': 'List of analysis types to include'
                },
                'satellite': {'type': 'string', 'enum': ['landsat', 'sentinel2'], 'default': 'landsat'},
                'cloud_cover': {'type': 'integer', 'minimum': 0, 'maximum': 100, 'default': 20}
            },
            'required': ['aoi_data', 'start_date', 'end_date']
        }
    },
    responses={
        200: OpenApiResponse(response=OpenApiTypes.OBJECT, description="Comprehensive analysis results"),
        400: OpenApiResponse(description="Invalid request parameters"),
        500: OpenApiResponse(description="Server error during analysis")
    }
)
@api_view(["POST"])
@permission_classes([AllowAny])
def process_comprehensive(request):
    """Process comprehensive analysis combining multiple indicators"""
    try:
        # Common request setup
        data, error_response = process_common_request_setup(request, 'Comprehensive')
        if error_response:
            return error_response

        # Extract parameters
        params = extract_common_parameters(data, 'Comprehensive')

        # Parse AOI data
        geometry, aoi_error = parse_aoi_data(params['aoi_data'])
        if aoi_error:
            return create_error_response('Comprehensive', aoi_error)

        # Process comprehensive analysis
        logger.info(f"Processing comprehensive analysis with types: {params['analysis_types']}")
        analysis_results = process_comprehensive_analysis(
            geometry=geometry,
            start_date=params['start_date'],
            end_date=params['end_date'],
            analysis_types=params['analysis_types'],
            satellite=params['satellite'],
            cloud_cover=params['cloud_cover'],
            use_cloud_masking=params['use_cloud_masking', False],
            strict_masking=params['strict_masking', False]
        )

        # Add processed geometry to response for frontend map display
        if analysis_results.get('success', False):
            try:
                # Convert Earth Engine geometry to GeoJSON for frontend
                geometry_geojson = geometry.getInfo()
                analysis_results['geometry'] = geometry_geojson
                logger.info("Added processed geometry to comprehensive analysis response")
            except Exception as e:
                logger.warning(f"Could not add geometry to response: {str(e)}")

        # Finalize response
        return finalize_analysis_response(request, data, analysis_results, 'Comprehensive', 'comprehensive')

    except Exception as e:
        return create_error_response('Comprehensive', e)


@extend_schema(
    summary="Process Trend Analysis",
    description="Analyze trends over time for a specified indicator (NDVI, LST) using multiple time periods.",
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'aoi_data': {'type': 'string', 'description': 'GeoJSON string of Area of Interest'},
                'start_date': {'type': 'string', 'format': 'date', 'description': 'Start date (YYYY-MM-DD)'},
                'end_date': {'type': 'string', 'format': 'date', 'description': 'End date (YYYY-MM-DD)'},
                'analysis_type': {'type': 'string', 'enum': ['ndvi', 'lst'], 'default': 'ndvi'},
                'satellite': {'type': 'string', 'enum': ['landsat', 'sentinel2'], 'default': 'landsat'},
                'cloud_cover': {'type': 'integer', 'minimum': 0, 'maximum': 100, 'default': 20},
                'time_window': {'type': 'string', 'enum': ['monthly', 'quarterly', 'yearly'], 'default': 'monthly'}
            },
            'required': ['aoi_data', 'start_date', 'end_date']
        }
    },
    responses={
        200: OpenApiResponse(response=OpenApiTypes.OBJECT, description="Trend analysis results"),
        400: OpenApiResponse(description="Invalid request parameters"),
        500: OpenApiResponse(description="Server error during analysis")
    }
)
@api_view(["POST"])
@permission_classes([AllowAny])
def analyze_trends(request):
    """Process trend analysis over time"""
    try:
        # Common request setup
        data, error_response = process_common_request_setup(request, 'Trends')
        if error_response:
            return error_response

        # Extract parameters
        params = extract_common_parameters(data, 'Trends')

        # Parse AOI data
        geometry, aoi_error = parse_aoi_data(params['aoi_data'])
        if aoi_error:
            return create_error_response('Trends', aoi_error)

        # Process trend analysis
        logger.info(f"Processing {params['analysis_type']} trend analysis with {params['time_window']} periods")
        analysis_results = process_trend_analysis(
            geometry=geometry,
            start_date=params['start_date'],
            end_date=params['end_date'],
            analysis_type=params['analysis_type'],
            satellite=params['satellite'],
            cloud_cover=params['cloud_cover'],
            time_window=params['time_window']
        )

        # Add processed geometry to response for frontend map display
        if analysis_results.get('success', False):
            try:
                # Convert Earth Engine geometry to GeoJSON for frontend
                geometry_geojson = geometry.getInfo()
                analysis_results['geometry'] = geometry_geojson
                logger.info("Added processed geometry to trend analysis response")
            except Exception as e:
                logger.warning(f"Could not add geometry to response: {str(e)}")

        # Finalize response
        return finalize_analysis_response(request, data, analysis_results, 'Trends', f"{params['analysis_type']}_trends")

    except Exception as e:
        return create_error_response('Trends', e)


@extend_schema(
    summary="Process Composite Analysis",
    description="Create composite images using multiple time periods and calculate various indices.",
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'aoi_data': {'type': 'string', 'description': 'GeoJSON string of Area of Interest'},
                'start_date': {'type': 'string', 'format': 'date', 'description': 'Start date (YYYY-MM-DD)'},
                'end_date': {'type': 'string', 'format': 'date', 'description': 'End date (YYYY-MM-DD)'},
                'satellite': {'type': 'string', 'enum': ['landsat', 'sentinel2'], 'default': 'landsat'},
                'cloud_cover': {'type': 'integer', 'minimum': 0, 'maximum': 100, 'default': 20},
                'composite_method': {'type': 'string', 'enum': ['median', 'mean', 'max', 'min'], 'default': 'median'}
            },
            'required': ['aoi_data', 'start_date', 'end_date']
        }
    },
    responses={
        200: OpenApiResponse(response=OpenApiTypes.OBJECT, description="Composite analysis results"),
        400: OpenApiResponse(description="Invalid request parameters"),
        500: OpenApiResponse(description="Server error during analysis")
    }
)
@api_view(["POST"])
@permission_classes([AllowAny])
def process_composite(request):
    """Process composite analysis"""
    try:
        # Common request setup
        data, error_response = process_common_request_setup(request, 'Composite')
        if error_response:
            return error_response

        # Extract parameters
        params = extract_common_parameters(data, 'Composite')

        # Parse AOI data
        geometry, aoi_error = parse_aoi_data(params['aoi_data'])
        if aoi_error:
            return create_error_response('Composite', aoi_error)

        # Process composite analysis
        logger.info(f"Processing {params['composite_method']} composite analysis using {params['satellite']}")
        analysis_results = process_composite_analysis(
            geometry=geometry,
            start_date=params['start_date'],
            end_date=params['end_date'],
            satellite=params['satellite'],
            cloud_cover=params['cloud_cover'],
            composite_method=params['composite_method']
        )

        # Add processed geometry to response for frontend map display
        if analysis_results.get('success', False):
            try:
                # Convert Earth Engine geometry to GeoJSON for frontend
                geometry_geojson = geometry.getInfo()
                analysis_results['geometry'] = geometry_geojson
                logger.info("Added processed geometry to composite analysis response")
            except Exception as e:
                logger.warning(f"Could not add geometry to response: {str(e)}")

        # Finalize response (no data files for composite - just statistics)
        logger.info("Composite analysis completed successfully")
        return finalize_analysis_response(request, data, analysis_results, 'Composite', 'composite')

    except Exception as e:
        return create_error_response('Composite', e)