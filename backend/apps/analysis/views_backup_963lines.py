"""
Refactored Analysis views for the GeoAnalysis Django application.
Main endpoints that use modular analysis components.
"""

import logging
import json
import ee
import sys
from datetime import datetime
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from django.conf import settings
from django.utils import timezone
from drf_spectacular.utils import extend_schema, OpenApiResponse, OpenApiExample
from drf_spectacular.types import OpenApiTypes

# Import database models for persistence
from .models import AnalysisRequest, AnalysisResult
from django.core.files.storage import default_storage

# Import Earth Engine configuration
from apps.earth_engine.ee_config import initialize_earth_engine

# Import modular analysis components
from .view_modules.earth_engine import wkt_to_ee_geometry, validate_coordinates, get_landsat_collection
from .view_modules.ndvi_analysis import process_ndvi_analysis, process_landsat_ndvi_analysis
from .view_modules.lst_analysis import process_lst_analysis
from .view_modules.sar_analysis import process_sar_analysis
from .view_modules.comprehensive_analysis import (
    process_comprehensive_analysis,
    process_trend_analysis,
    process_composite_analysis
)
from .view_modules.data_processing import (
    validate_analysis_request, 
    export_to_csv, 
    create_plot, 
    format_response_data,
    calculate_statistics
)

# Import utility functions
from .utils import (
    integrate_advanced_statistics, 
    generate_plot_file, 
    generate_csv_file, 
    generate_image_id, 
    estimate_cloud_cover, 
    get_actual_cloud_cover_from_gee
)

logger = logging.getLogger(__name__)


def save_analysis_to_database(request_data, analysis_results, analysis_type, user=None):
    """Save analysis request and results to database."""
    try:
        # Create AnalysisRequest record
        analysis_request = AnalysisRequest.objects.create(
            user=user,
            analysis_type=analysis_type,
            parameters=request_data,
            status='completed',
            created_at=timezone.now()
        )

        # Create AnalysisResult record
        AnalysisResult.objects.create(
            request=analysis_request,
            results=analysis_results,
            created_at=timezone.now()
        )

        logger.info(f"Saved {analysis_type} analysis to database with ID {analysis_request.id}")
        return analysis_request.id

    except Exception as e:
        logger.error(f"Database save error: {str(e)}")
        return None


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
        logger.info("Starting NDVI analysis request")
        
        # Initialize Earth Engine
        initialize_earth_engine()
        
        # Get request data
        data = request.data
        logger.info(f"Request data: {data}")

        # Validate request
        is_valid, validation_message = validate_analysis_request(data)
        if not is_valid:
            return Response({
                "success": False,
                "error": validation_message
            }, status=status.HTTP_400_BAD_REQUEST)

        # Extract parameters
        aoi_data = data.get('aoi_data')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        satellite = data.get('satellite', 'landsat').lower()
        cloud_cover = int(data.get('cloud_cover', 20))

        # Parse AOI data
        if isinstance(aoi_data, str):
            aoi_json = json.loads(aoi_data)
        else:
            aoi_json = aoi_data

        # Convert to Earth Engine geometry
        geometry = wkt_to_ee_geometry(aoi_json)
        
        # Validate coordinates for Ghana (this should show path/row 193/056)
        is_valid_coords, coord_message = validate_coordinates(geometry)
        if not is_valid_coords:
            logger.warning(f"Coordinate validation warning: {coord_message}")

        # Process NDVI analysis using modular approach
        logger.info(f"Processing {satellite} NDVI analysis")
        analysis_results = process_ndvi_analysis(
            geometry=geometry,
            start_date=start_date,
            end_date=end_date,
            satellite=satellite,
            cloud_cover=cloud_cover
        )

        # Save to database
        save_analysis_to_database(data, analysis_results, 'NDVI', request.user if request.user.is_authenticated else None)

        # Generate CSV and plot files
        csv_file = None
        plot_file = None
        
        if analysis_results.get('data'):
            try:
                csv_file = export_to_csv(analysis_results['data'], 'ndvi_data', 'NDVI')
                plot_file = create_plot(analysis_results['data'], 'NDVI', 'ndvi')
            except Exception as e:
                logger.warning(f"File generation error: {str(e)}")

        # Add file URLs to response
        if csv_file:
            analysis_results['csv_url'] = f"/media/{csv_file}"
        if plot_file:
            analysis_results['plot_url'] = f"/media/{plot_file}"

        logger.info("NDVI analysis completed successfully")
        return Response(analysis_results, status=status.HTTP_200_OK)

    except Exception as e:
        error_message = f"NDVI analysis error: {str(e)}"
        logger.error(error_message)
        return Response({
            "success": False,
            "error": error_message,
            "timestamp": datetime.now().isoformat()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        logger.info("Starting LST analysis request")
        
        # Initialize Earth Engine
        initialize_earth_engine()
        
        # Get request data
        data = request.data

        # Validate request
        is_valid, validation_message = validate_analysis_request(data)
        if not is_valid:
            return Response({
                "success": False,
                "error": validation_message
            }, status=status.HTTP_400_BAD_REQUEST)

        # Extract parameters
        aoi_data = data.get('aoi_data')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        cloud_cover = int(data.get('cloud_cover', 20))

        # Parse AOI data
        if isinstance(aoi_data, str):
            aoi_json = json.loads(aoi_data)
        else:
            aoi_json = aoi_data

        # Convert to Earth Engine geometry
        geometry = wkt_to_ee_geometry(aoi_json)

        # Process LST analysis
        logger.info("Processing LST analysis")
        analysis_results = process_lst_analysis(
            geometry=geometry,
            start_date=start_date,
            end_date=end_date,
            cloud_cover=cloud_cover
        )

        # Save to database
        save_analysis_to_database(data, analysis_results, 'LST', request.user if request.user.is_authenticated else None)

        # Generate CSV and plot files
        if analysis_results.get('data'):
            try:
                csv_file = export_to_csv(analysis_results['data'], 'lst_data', 'LST')
                plot_file = create_plot(analysis_results['data'], 'LST', 'lst')
                
                if csv_file:
                    analysis_results['csv_url'] = f"/media/{csv_file}"
                if plot_file:
                    analysis_results['plot_url'] = f"/media/{plot_file}"
            except Exception as e:
                logger.warning(f"File generation error: {str(e)}")

        logger.info("LST analysis completed successfully")
        return Response(analysis_results, status=status.HTTP_200_OK)

    except Exception as e:
        error_message = f"LST analysis error: {str(e)}"
        logger.error(error_message)
        return Response({
            "success": False,
            "error": error_message,
            "timestamp": datetime.now().isoformat()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        logger.info("Starting SAR analysis request")
        
        # Initialize Earth Engine
        initialize_earth_engine()
        
        # Get request data
        data = request.data

        # Validate request
        data['analysis_type'] = 'sar'  # Add for validation
        is_valid, validation_message = validate_analysis_request(data)
        if not is_valid:
            return Response({
                "success": False,
                "error": validation_message
            }, status=status.HTTP_400_BAD_REQUEST)

        # Extract parameters
        aoi_data = data.get('aoi_data')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        orbit_direction = data.get('orbit_direction', 'DESCENDING')

        # Parse AOI data
        if isinstance(aoi_data, str):
            aoi_json = json.loads(aoi_data)
        else:
            aoi_json = aoi_data

        # Convert to Earth Engine geometry
        geometry = wkt_to_ee_geometry(aoi_json)

        # Process SAR analysis
        logger.info("Processing SAR analysis")
        analysis_results = process_sar_analysis(
            geometry=geometry,
            start_date=start_date,
            end_date=end_date,
            orbit_direction=orbit_direction
        )

        # Save to database
        save_analysis_to_database(data, analysis_results, 'SAR', request.user if request.user.is_authenticated else None)

        # Generate CSV and plot files
        if analysis_results.get('data'):
            try:
                csv_file = export_to_csv(analysis_results['data'], 'sar_data', 'SAR')
                plot_file = create_plot(analysis_results['data'], 'SAR', 'sar')
                
                if csv_file:
                    analysis_results['csv_url'] = f"/media/{csv_file}"
                if plot_file:
                    analysis_results['plot_url'] = f"/media/{plot_file}"
            except Exception as e:
                logger.warning(f"File generation error: {str(e)}")

        logger.info("SAR analysis completed successfully")
        return Response(analysis_results, status=status.HTTP_200_OK)

    except Exception as e:
        error_message = f"SAR analysis error: {str(e)}"
        logger.error(error_message)
        return Response({
            "success": False,
            "error": error_message,
            "timestamp": datetime.now().isoformat()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """Health check endpoint"""
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


# Legacy compatibility endpoints - redirect to new implementations
@api_view(["POST"])
@permission_classes([AllowAny])
def process_lst_request(request):
    """Legacy LST endpoint - redirects to process_lst"""
    return process_lst(request)


@api_view(["GET"])
@permission_classes([AllowAny])
def process_analysis_generic(request, analysis_type):
    """Generic analysis endpoint for backward compatibility"""
    return Response({
        "success": False,
        "error": f"Generic analysis endpoint deprecated. Use specific endpoints: /process_ndvi/, /process_lst/, /process_sentinel/",
        "analysis_type": analysis_type,
        "available_endpoints": [
            "/api/analysis/process_ndvi/",
            "/api/analysis/process_lst/", 
            "/api/analysis/process_sentinel/"
        ]
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([AllowAny])
def process_comprehensive(request):
    """Comprehensive analysis combining multiple satellite data sources"""
    try:
        logger.info("Starting comprehensive analysis request")
        
        # Initialize Earth Engine
        initialize_earth_engine()
        
        # Get request data
        data = request.data

        # Validate request
        is_valid, validation_message = validate_analysis_request(data)
        if not is_valid:
            return Response({
                "success": False,
                "error": validation_message
            }, status=status.HTTP_400_BAD_REQUEST)

        # Extract parameters
        aoi_data = data.get('aoi_data')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        analysis_types = data.get('analysis_types', ['ndvi', 'lst'])
        cloud_cover = int(data.get('cloud_cover', 20))

        # Parse AOI data
        if isinstance(aoi_data, str):
            aoi_json = json.loads(aoi_data)
        else:
            aoi_json = aoi_data

        # Convert to Earth Engine geometry
        geometry = wkt_to_ee_geometry(aoi_json)

        # Process multiple analysis types
        results = {}
        
        if 'ndvi' in analysis_types:
            try:
                results['ndvi'] = process_ndvi_analysis(geometry, start_date, end_date, 'landsat', cloud_cover)
            except Exception as e:
                logger.error(f"NDVI analysis failed: {str(e)}")
                results['ndvi'] = {"success": False, "error": str(e)}

        if 'lst' in analysis_types:
            try:
                results['lst'] = process_lst_analysis(geometry, start_date, end_date, cloud_cover)
            except Exception as e:
                logger.error(f"LST analysis failed: {str(e)}")
                results['lst'] = {"success": False, "error": str(e)}

        if 'sar' in analysis_types:
            try:
                results['sar'] = process_sar_analysis(geometry, start_date, end_date)
            except Exception as e:
                logger.error(f"SAR analysis failed: {str(e)}")
                results['sar'] = {"success": False, "error": str(e)}

        # Save comprehensive results to database
        save_analysis_to_database(data, results, 'COMPREHENSIVE', request.user if request.user.is_authenticated else None)

        logger.info("Comprehensive analysis completed successfully")
        return Response({
            "success": True,
            "demo_mode": False,
            "analysis_type": "COMPREHENSIVE",
            "results": results,
            "timestamp": datetime.now().isoformat()
        }, status=status.HTTP_200_OK)

    except Exception as e:
        error_message = f"Comprehensive analysis error: {str(e)}"
        logger.error(error_message)
        return Response({
            "success": False,
            "error": error_message,
            "timestamp": datetime.now().isoformat()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
@permission_classes([AllowAny])
def get_image_metadata(request):
    """Get metadata for satellite images"""
    return Response({
        "success": False,
        "error": "Image metadata endpoint not yet implemented in modular version",
        "message": "Use individual analysis endpoints for now"
    }, status=status.HTTP_501_NOT_IMPLEMENTED)


@api_view(["POST"])
@permission_classes([AllowAny])
def analyze_trends(request):
    """Analyze temporal trends in satellite data"""
    return Response({
        "success": False,
        "error": "Trends analysis endpoint not yet implemented in modular version",
        "message": "Use individual analysis endpoints for now"
    }, status=status.HTTP_501_NOT_IMPLEMENTED)


@api_view(["GET"])
@permission_classes([AllowAny])
def get_analysis_history(request):
    """Get analysis history from database"""
    try:
        # Get recent analysis requests
        recent_analyses = AnalysisRequest.objects.order_by('-created_at')[:10]
        
        history = []
        for analysis in recent_analyses:
            history.append({
                "id": analysis.id,
                "analysis_type": analysis.analysis_type,
                "status": analysis.status,
                "created_at": analysis.created_at.isoformat(),
                "parameters": analysis.parameters
            })
        
        return Response({
            "success": True,
            "history": history,
            "timestamp": datetime.now().isoformat()
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            "success": False,
            "error": f"Error retrieving history: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([AllowAny])
def get_analysis_result(request, analysis_id):
    """Get specific analysis result by ID"""
    try:
        analysis_request = AnalysisRequest.objects.get(id=analysis_id)
        result = AnalysisResult.objects.get(request=analysis_request)
        
        return Response({
            "success": True,
            "analysis_request": {
                "id": analysis_request.id,
                "analysis_type": analysis_request.analysis_type,
                "status": analysis_request.status,
                "created_at": analysis_request.created_at.isoformat(),
                "parameters": analysis_request.parameters
            },
            "results": result.results,
            "timestamp": datetime.now().isoformat()
        }, status=status.HTTP_200_OK)

    except AnalysisRequest.DoesNotExist:
        return Response({
            "success": False,
            "error": f"Analysis request {analysis_id} not found"
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            "success": False,
            "error": f"Error retrieving result: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["DELETE"])
@permission_classes([AllowAny])
def delete_analysis(request, analysis_id):
    """Delete analysis by ID"""
    try:
        analysis_request = AnalysisRequest.objects.get(id=analysis_id)
        analysis_request.delete()
        
        return Response({
            "success": True,
            "message": f"Analysis {analysis_id} deleted successfully",
            "timestamp": datetime.now().isoformat()
        }, status=status.HTTP_200_OK)

    except AnalysisRequest.DoesNotExist:
        return Response({
            "success": False,
            "error": f"Analysis request {analysis_id} not found"
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            "success": False,
            "error": f"Error deleting analysis: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        logger.info("Starting comprehensive analysis request")
        
        # Initialize Earth Engine
        initialize_earth_engine()
        
        # Get request data
        data = request.data

        # Validate request
        data['analysis_type'] = 'comprehensive'  # Add for validation
        is_valid, validation_message = validate_analysis_request(data)
        if not is_valid:
            return Response({
                "success": False,
                "error": validation_message
            }, status=status.HTTP_400_BAD_REQUEST)

        # Extract parameters
        aoi_data = data.get('aoi_data')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        analysis_types = data.get('analysis_types', ['ndvi', 'lst'])
        satellite = data.get('satellite', 'landsat').lower()
        cloud_cover = int(data.get('cloud_cover', 20))

        # Parse AOI data
        if isinstance(aoi_data, str):
            aoi_json = json.loads(aoi_data)
        else:
            aoi_json = aoi_data

        # Convert to Earth Engine geometry
        geometry = wkt_to_ee_geometry(aoi_json)

        # Process comprehensive analysis
        logger.info(f"Processing comprehensive analysis with types: {analysis_types}")
        analysis_results = process_comprehensive_analysis(
            geometry=geometry,
            start_date=start_date,
            end_date=end_date,
            analysis_types=analysis_types,
            satellite=satellite,
            cloud_cover=cloud_cover
        )

        # Save to database
        save_analysis_to_database(data, analysis_results, 'Comprehensive', request.user if request.user.is_authenticated else None)

        # Generate CSV and plot files
        if analysis_results.get('data'):
            try:
                csv_file = export_to_csv(analysis_results['data'], 'comprehensive_data', 'Comprehensive')
                plot_file = create_plot(analysis_results['data'], 'Comprehensive', 'comprehensive')
                
                if csv_file:
                    analysis_results['csv_url'] = f"/media/{csv_file}"
                if plot_file:
                    analysis_results['plot_url'] = f"/media/{plot_file}"
            except Exception as e:
                logger.warning(f"File generation error: {str(e)}")

        logger.info("Comprehensive analysis completed successfully")
        return Response(analysis_results, status=status.HTTP_200_OK)

    except Exception as e:
        error_message = f"Comprehensive analysis error: {str(e)}"
        logger.error(error_message)
        return Response({
            "success": False,
            "error": error_message,
            "timestamp": datetime.now().isoformat()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        logger.info("Starting trend analysis request")
        
        # Initialize Earth Engine
        initialize_earth_engine()
        
        # Get request data
        data = request.data

        # Validate request
        data['analysis_type'] = data.get('analysis_type', 'ndvi')  # Use provided or default
        is_valid, validation_message = validate_analysis_request(data)
        if not is_valid:
            return Response({
                "success": False,
                "error": validation_message
            }, status=status.HTTP_400_BAD_REQUEST)

        # Extract parameters
        aoi_data = data.get('aoi_data')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        analysis_type = data.get('analysis_type', 'ndvi')
        satellite = data.get('satellite', 'landsat').lower()
        cloud_cover = int(data.get('cloud_cover', 20))
        time_window = data.get('time_window', 'monthly')

        # Parse AOI data
        if isinstance(aoi_data, str):
            aoi_json = json.loads(aoi_data)
        else:
            aoi_json = aoi_data

        # Convert to Earth Engine geometry
        geometry = wkt_to_ee_geometry(aoi_json)

        # Process trend analysis
        logger.info(f"Processing {analysis_type} trend analysis with {time_window} periods")
        analysis_results = process_trend_analysis(
            geometry=geometry,
            start_date=start_date,
            end_date=end_date,
            analysis_type=analysis_type,
            satellite=satellite,
            cloud_cover=cloud_cover,
            time_window=time_window
        )

        # Save to database
        save_analysis_to_database(data, analysis_results, 'Trends', request.user if request.user.is_authenticated else None)

        # Generate CSV and plot files
        if analysis_results.get('data'):
            try:
                csv_file = export_to_csv(analysis_results['data'], f'{analysis_type}_trends_data', 'Trends')
                plot_file = create_plot(analysis_results['data'], 'Trends', f'{analysis_type}_trends')
                
                if csv_file:
                    analysis_results['csv_url'] = f"/media/{csv_file}"
                if plot_file:
                    analysis_results['plot_url'] = f"/media/{plot_file}"
            except Exception as e:
                logger.warning(f"File generation error: {str(e)}")

        logger.info("Trend analysis completed successfully")
        return Response(analysis_results, status=status.HTTP_200_OK)

    except Exception as e:
        error_message = f"Trend analysis error: {str(e)}"
        logger.error(error_message)
        return Response({
            "success": False,
            "error": error_message,
            "timestamp": datetime.now().isoformat()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        logger.info("Starting composite analysis request")
        
        # Initialize Earth Engine
        initialize_earth_engine()
        
        # Get request data
        data = request.data

        # Validate request
        data['analysis_type'] = 'composite'  # Add for validation
        is_valid, validation_message = validate_analysis_request(data)
        if not is_valid:
            return Response({
                "success": False,
                "error": validation_message
            }, status=status.HTTP_400_BAD_REQUEST)

        # Extract parameters
        aoi_data = data.get('aoi_data')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        satellite = data.get('satellite', 'landsat').lower()
        cloud_cover = int(data.get('cloud_cover', 20))
        composite_method = data.get('composite_method', 'median')

        # Parse AOI data
        if isinstance(aoi_data, str):
            aoi_json = json.loads(aoi_data)
        else:
            aoi_json = aoi_data

        # Convert to Earth Engine geometry
        geometry = wkt_to_ee_geometry(aoi_json)

        # Process composite analysis
        logger.info(f"Processing {composite_method} composite analysis using {satellite}")
        analysis_results = process_composite_analysis(
            geometry=geometry,
            start_date=start_date,
            end_date=end_date,
            satellite=satellite,
            cloud_cover=cloud_cover,
            composite_method=composite_method
        )

        # Save to database
        save_analysis_to_database(data, analysis_results, 'Composite', request.user if request.user.is_authenticated else None)

        logger.info("Composite analysis completed successfully")
        return Response(analysis_results, status=status.HTTP_200_OK)

    except Exception as e:
        error_message = f"Composite analysis error: {str(e)}"
        logger.error(error_message)
        return Response({
            "success": False,
            "error": error_message,
            "timestamp": datetime.now().isoformat()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)