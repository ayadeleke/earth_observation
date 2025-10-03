"""
Minimal views module that imports and exposes all endpoints from micro-modules.
This file acts as the main entry point for all analysis endpoints.
"""

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
    get_analysis_result,
    delete_analysis_result
)

# Import simple utility endpoints
import logging
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema, OpenApiResponse
from drf_spectacular.types import OpenApiTypes

# Import Earth Engine configuration
from apps.earth_engine.ee_config import initialize_earth_engine

logger = logging.getLogger(__name__)


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
        import ee
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
    """Get metadata for available satellite images"""
    try:
        from .view_modules.request_handlers import (
            process_common_request_setup,
            parse_aoi_data,
            extract_common_parameters,
            create_error_response
        )
        from .view_modules.earth_engine import get_landsat_collection, get_sentinel2_collection
        
        # Common request setup
        data, error_response = process_common_request_setup(request, 'Metadata')
        if error_response:
            return error_response

        # Extract parameters
        params = extract_common_parameters(data, 'Metadata')

        # Parse AOI data
        geometry, aoi_error = parse_aoi_data(params['aoi_data'])
        if aoi_error:
            return create_error_response('Metadata', aoi_error)

        # Get collection based on satellite
        if params['satellite'] == 'landsat':
            collection = get_landsat_collection(geometry, params['start_date'], params['end_date'], params['cloud_cover'])
        else:
            collection = get_sentinel2_collection(geometry, params['start_date'], params['end_date'], params['cloud_cover'])

        # Get metadata
        image_count = collection.size().getInfo()
        
        if image_count > 0:
            # Get info about the most recent image
            recent_image = collection.first()
            image_info = recent_image.getInfo()
            
            metadata = {
                'image_count': image_count,
                'satellite': params['satellite'],
                'date_range': f"{params['start_date']} to {params['end_date']}",
                'recent_image': {
                    'id': image_info.get('id', 'Unknown'),
                    'date': image_info.get('properties', {}).get('DATE_ACQUIRED', 'Unknown'),
                    'cloud_cover': image_info.get('properties', {}).get('CLOUD_COVER', 'Unknown')
                }
            }
        else:
            metadata = {
                'image_count': 0,
                'satellite': params['satellite'],
                'date_range': f"{params['start_date']} to {params['end_date']}",
                'message': 'No images found for the specified criteria'
            }

        return Response({
            'status': 'success',
            'metadata': metadata
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return create_error_response('Metadata', e)