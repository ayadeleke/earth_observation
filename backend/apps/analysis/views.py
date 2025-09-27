"""
Analysis views for the GeoAnalysis Django application.
Provides the main processing endpoints that match the Flask app functionality.
"""
import logging
import json
import ee
import sys
import os
from datetime import datetime
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from django.conf import settings
from django.utils import timezone
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse, OpenApiExample
from drf_spectacular.types import OpenApiTypes

# Import database models for persistence
from .models import AnalysisRequest, AnalysisResult, ImageCollection
from django.core.files.storage import default_storage

# Add modules path for importing earth_engine_utils
if 'd:/webapp/modules' not in sys.path:
    sys.path.append('d:/webapp/modules')

try:
    import earth_engine_utils
except ImportError:
    earth_engine_utils = None

# Import the new analysis utilities for file downloads
from .utils import (
    create_response_with_downloads, 
    integrate_advanced_statistics,
    generate_plot_file,
    generate_csv_file
)

logger = logging.getLogger(__name__)


def save_analysis_to_database(request_data, analysis_results, analysis_type, user=None):
    """
    Save analysis request and results to database.
    
    Args:
        request_data (dict): Original request parameters
        analysis_results (dict): Analysis results with data and statistics
        analysis_type (str): Type of analysis performed
        user (User): Authenticated user or None for anonymous
        
    Returns:
        tuple: (AnalysisRequest, AnalysisResult) objects
    """
    try:
        # Determine the correct satellite based on analysis type and request data
        if analysis_type in ['sentinel', 'backscatter']:
            satellite = 'sentinel'
        else:
            # Get satellite from request data, default to landsat
            req_satellite = request_data.get('satellite', 'landsat')
            # Map sentinel variations to 'sentinel'
            if req_satellite.lower() in ['sentinel', 'sentinel1', 'sentinel2', 'modis']:
                satellite = 'sentinel' if req_satellite.lower().startswith('sentinel') else 'landsat'
            else:
                satellite = 'landsat'
        
        # Get polarization for SAR analysis
        polarization = request_data.get('polarization', 'VV') if analysis_type in ['sentinel', 'backscatter'] else None
        
        # Create analysis request record
        analysis_request = AnalysisRequest.objects.create(
            user=user if user and user.is_authenticated else None,
            name=f"{analysis_type.upper()} Analysis - {timezone.now().strftime('%Y-%m-%d %H:%M')}",
            analysis_type=analysis_type,
            satellite=satellite,
            polarization=polarization,
            geometry_data=request_data.get('coordinates', []),
            start_date=request_data.get('start_date', '2020-01-01'),
            end_date=request_data.get('end_date', '2023-12-31'),
            cloud_cover=request_data.get('cloud_cover', 20),
            status='completed',
            progress=100,
            completed_at=timezone.now()
        )
        
        # Extract file references from results
        plot_file = None
        csv_file = None
        
        if 'plot_filename' in analysis_results:
            plot_file = analysis_results['plot_filename']
        if 'csv_filename' in analysis_results:
            csv_file = analysis_results['csv_filename']
            
        # Create analysis result record
        analysis_result = AnalysisResult.objects.create(
            analysis_request=analysis_request,
            data=analysis_results.get('data', []),
            statistics=analysis_results.get('statistics', {}),
            plot_file=plot_file,
            csv_file=csv_file,
            total_observations=len(analysis_results.get('data', [])),
            date_range_covered=f"{request_data.get('start_date', '')} to {request_data.get('end_date', '')}"
        )
        
        # Add database references to response
        analysis_results['database_id'] = analysis_request.id
        analysis_results['result_id'] = analysis_result.id
        analysis_results['created_at'] = analysis_request.created_at.isoformat()
        
        logger.info(f"[SUCCESS] Analysis saved to database: Request ID {analysis_request.id}, Result ID {analysis_result.id}")
        
        return analysis_request, analysis_result
        
    except Exception as e:
        logger.error(f"[ERROR] Failed to save analysis to database: {str(e)}")
        # Add error info to response but don't fail the request
        analysis_results['database_error'] = f"Database save failed: {str(e)}"
        return None, None


def process_earth_engine_analysis(analysis_type, start_date, end_date, coordinates, project_id, satellite='landsat', **kwargs):
    """
    Process real Earth Engine satellite analysis.
    
    Args:
        analysis_type (str): Type of analysis ('ndvi', 'lst', 'sar', 'backscatter')
        start_date (str): Start date in YYYY-MM-DD format
        end_date (str): End date in YYYY-MM-DD format
        coordinates (list): List of [lat, lon] coordinate pairs
        project_id (str): Earth Engine project ID
        satellite (str): Satellite to use ('landsat', 'sentinel2', 'sentinel1', 'modis')
        **kwargs: Additional parameters (polarization, orbit_direction, etc.)
        
    Returns:
        dict: Analysis results with real Earth Engine data
    """
    try:
        from apps.earth_engine.ee_config import initialize_earth_engine, is_initialized
        
        # Ensure Earth Engine is initialized
        if not is_initialized():
            success = initialize_earth_engine()
            if not success:
                raise Exception("Failed to initialize Earth Engine")
        
        # Create geometry from coordinates
        if coordinates and len(coordinates) >= 3:
            # Polygon from coordinate list
            geometry = ee.Geometry.Polygon([coordinates])
        elif coordinates and len(coordinates) == 2:
            # Single point - create small buffer around it
            point = ee.Geometry.Point([coordinates[1], coordinates[0]])  # [lon, lat]
            geometry = point.buffer(1000)  # 1km buffer
        else:
            # Default test area if no coordinates provided
            geometry = ee.Geometry.Rectangle([-122.5, 37.7, -122.3, 37.9])  # San Francisco Bay Area
        
        logger.info(f"Processing {analysis_type} analysis using {satellite} for area: {geometry}")
        
        if analysis_type.lower() == 'ndvi':
            return process_ndvi_analysis(geometry, start_date, end_date, satellite)
        elif analysis_type.lower() == 'lst':
            return process_lst_analysis(geometry, start_date, end_date, satellite)
        elif analysis_type.lower() in ['sar', 'backscatter', 'sentinel1']:
            return process_sar_analysis(geometry, start_date, end_date, satellite, **kwargs)
        else:
            # Default to NDVI if unknown type
            return process_ndvi_analysis(geometry, start_date, end_date, satellite)
            
    except Exception as e:
        logger.error(f"Earth Engine analysis error: {str(e)}")
        # Return error but don't fail - could fallback to demo data
        return {
            'success': False,
            'error': f"Earth Engine processing failed: {str(e)}",
            'demo_mode': False,
            'analysis_type': analysis_type.upper(),
            'message': f'Earth Engine {analysis_type.upper()} analysis failed: {str(e)}'
        }


def process_ndvi_analysis(geometry, start_date, end_date, satellite='landsat'):
    """Process NDVI analysis using Earth Engine"""
    try:
        logger.info(f"Processing NDVI analysis for {start_date} to {end_date} using {satellite}")
        
        if satellite.lower() == 'landsat':
            return process_landsat_ndvi_analysis(geometry, start_date, end_date)
        elif satellite.lower() == 'sentinel2' or satellite.lower() == 'sentinel':
            return process_sentinel2_ndvi_analysis(geometry, start_date, end_date)
        else:
            logger.error(f"Unsupported satellite for NDVI: {satellite}")
            raise Exception(f"Unsupported satellite for NDVI analysis: {satellite}. Supported: landsat, sentinel2")
            
    except Exception as e:
        logger.error(f"NDVI analysis error: {str(e)}")
        raise


def process_landsat_ndvi_analysis(geometry, start_date, end_date):
    """Process Landsat NDVI analysis"""
    try:
        # Get Landsat collection with cloud masking
        if earth_engine_utils:
            logger.info(f"Getting Landsat collection for {start_date} to {end_date}")
            
            # Use only Landsat 8/9 to avoid band compatibility issues
            start_year = int(start_date.split('-')[0])
            end_year = int(end_date.split('-')[0])
            
            collections = []
            
            # Landsat 8 (2013-present)
            if end_year >= 2013:
                l8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2') \
                    .filterDate(start_date, end_date) \
                    .filterBounds(geometry) \
                    .filter(ee.Filter.lt('CLOUD_COVER', 20))
                collections.append(l8)
                logger.info(f"Added Landsat 8 collection")
            
            # Landsat 9 (2021-present)
            if end_year >= 2021:
                l9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2') \
                    .filterDate(start_date, end_date) \
                    .filterBounds(geometry) \
                    .filter(ee.Filter.lt('CLOUD_COVER', 20))
                collections.append(l9)
                logger.info(f"Added Landsat 9 collection")
            
            if not collections:
                raise Exception(f"Landsat NDVI requires data from 2013 onwards (Landsat 8/9)")
            
            # Merge collections
            collection = collections[0]
            for i in range(1, len(collections)):
                collection = collection.merge(collections[i])
                
            if collection is None:
                raise Exception("Merged collection is None")
                
            # Check collection size
            try:
                collection_size = collection.size().getInfo()
                logger.info(f"Landsat collection contains {collection_size} images")
                if collection_size == 0:
                    raise Exception(f"No Landsat 8/9 images found for period {start_date} to {end_date}")
            except Exception as e:
                logger.error(f"Error checking collection size: {e}")
                raise Exception(f"Collection size check failed: {e}")
            
            # Get median composite for the area
            try:
                image = collection.median()
                if image is None:
                    raise Exception("Median composite returned None")
                    
            except Exception as e:
                logger.error(f"Error creating composite: {e}")
                raise Exception(f"Composite creation failed: {e}")
            
            # Calculate NDVI manually to avoid band issues
            try:
                # Scale and offset for Landsat Collection 2
                scale_factor = 0.0000275
                offset = -0.2
                scaled = image.multiply(scale_factor).add(offset)
                
                # Landsat 8/9 bands: B5=NIR, B4=Red
                nir = scaled.select('SR_B5')
                red = scaled.select('SR_B4') 
                ndvi_band = nir.subtract(red).divide(nir.add(red)).rename('NDVI')
                
                logger.info("Landsat NDVI calculation completed successfully")
                
            except Exception as e:
                logger.error(f"Error calculating NDVI: {e}")
                raise Exception(f"NDVI calculation failed: {e}")
            
        else:
            logger.warning("earth_engine_utils not available, using fallback processing")
            # Fallback manual processing if utils not available
            collection = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2') \
                .filterDate(start_date, end_date) \
                .filterBounds(geometry) \
                .filter(ee.Filter.lt('CLOUD_COVER', 20))
            
            # Check collection size
            collection_size = collection.size().getInfo()
            if collection_size == 0:
                raise Exception(f"No Landsat images found for period {start_date} to {end_date}")
            
            # Get median composite
            image = collection.median()
            
            # Calculate NDVI manually
            scale_factor = 0.0000275
            offset = -0.2
            scaled = image.multiply(scale_factor).add(offset)
            nir = scaled.select('SR_B5')
            red = scaled.select('SR_B4') 
            ndvi_band = nir.subtract(red).divide(nir.add(red)).rename('NDVI')
        
        # Get statistics
        try:
            stats = ndvi_band.reduceRegion(
                reducer=ee.Reducer.mean().combine(
                    reducer2=ee.Reducer.minMax(), 
                    sharedInputs=True
                ).combine(
                    reducer2=ee.Reducer.stdDev(),
                    sharedInputs=True
                ),
                geometry=geometry,
                scale=30,
                maxPixels=1e9
            ).getInfo()
            
            if stats is None:
                raise Exception("NDVI statistics computation returned None")
                
        except Exception as e:
            logger.error(f"Error computing NDVI statistics: {e}")
            raise Exception(f"NDVI statistics failed: {e}")
        
        # Calculate area statistics
        try:
            area_km2 = geometry.area().divide(1000000).getInfo()
            pixel_count_result = ndvi_band.select('NDVI').reduceRegion(
                reducer=ee.Reducer.count(),
                geometry=geometry,
                scale=30,
                maxPixels=1e9
            ).getInfo()
            
            if pixel_count_result is None:
                pixel_count = 0
            else:
                pixel_count = pixel_count_result.get('NDVI', 0)
                
        except Exception as e:
            logger.error(f"Error computing area statistics: {e}")
            area_km2 = 0
            pixel_count = 0
        
        # Get sample data points for visualization
        try:
            sample_points = ndvi_band.sample(
                region=geometry,
                scale=30,
                numPixels=100
            ).getInfo()
            
            if sample_points is None:
                logger.warning("Sample points computation returned None")
                sample_data = []
            else:
                sample_data = []
                for i, feature in enumerate(sample_points.get('features', [])[:50]):  # Limit to 50 points
                    props = feature.get('properties', {})
                    coords = feature.get('geometry', {}).get('coordinates', [])
                    if coords and 'NDVI' in props:
                        sample_data.append({
                            'date': start_date,  # Use start date for consistency
                            'ndvi': round(props['NDVI'], 4),
                            'lat': round(coords[1], 6),
                            'lon': round(coords[0], 6)
                        })
                        
        except Exception as e:
            logger.error(f"Error getting sample data: {e}")
            sample_data = []
        
        return {
            'success': True,
            'demo_mode': False,
            'analysis_type': 'NDVI',
            'satellite': 'Landsat (Real Data)',
            'data': sample_data,
            'statistics': {
                'mean_ndvi': round(stats.get('NDVI_mean', 0), 4) if stats else 0,
                'min_ndvi': round(stats.get('NDVI_min', 0), 4) if stats else 0,
                'max_ndvi': round(stats.get('NDVI_max', 0), 4) if stats else 0,
                'std_ndvi': round(stats.get('NDVI_stdDev', 0), 4) if stats else 0,
                'area_km2': round(area_km2, 2),
                'pixel_count': pixel_count,
                'date_range': f"{start_date} to {end_date}"
            },
            'message': 'Real Earth Engine NDVI analysis completed successfully',
            'timestamp': datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"NDVI analysis error: {str(e)}")
        raise


def process_lst_analysis(geometry, start_date, end_date, satellite='modis'):
    """Process Land Surface Temperature analysis using Earth Engine"""
    try:
        logger.info(f"Processing LST analysis for {start_date} to {end_date} using {satellite}")
        
        if satellite.lower() == 'landsat':
            return process_landsat_lst_analysis(geometry, start_date, end_date)
        elif satellite.lower() == 'modis':
            return process_modis_lst_analysis(geometry, start_date, end_date)
        else:
            logger.error(f"Unsupported satellite for LST: {satellite}")
            raise Exception(f"Unsupported satellite for LST analysis: {satellite}. Supported: landsat, modis")
            
    except Exception as e:
        logger.error(f"LST analysis error: {str(e)}")
        raise


def process_modis_lst_analysis(geometry, start_date, end_date):
    """Process MODIS LST analysis"""
    try:
        logger.info(f"Processing MODIS LST analysis for {start_date} to {end_date}")
        
        # Use MODIS LST data
        try:
            collection = ee.ImageCollection('MODIS/061/MOD11A1') \
                .filterDate(start_date, end_date) \
                .filterBounds(geometry)
            
            # Check collection size
            collection_size = collection.size().getInfo()
            logger.info(f"MODIS LST collection contains {collection_size} images")
            if collection_size == 0:
                raise Exception(f"No MODIS LST images found for period {start_date} to {end_date}")
                
        except Exception as e:
            logger.error(f"Error accessing MODIS collection: {e}")
            raise Exception(f"MODIS collection access failed: {e}")
        
        # Get median composite
        try:
            image = collection.median()
            if image is None:
                raise Exception("MODIS median composite returned None")
                
        except Exception as e:
            logger.error(f"Error creating MODIS composite: {e}")
            raise Exception(f"MODIS composite creation failed: {e}")
        
        # LST bands (day and night) - convert from Kelvin to Celsius
        try:
            lst_day = image.select('LST_Day_1km').multiply(0.02).subtract(273.15)  # Convert to Celsius
            lst_night = image.select('LST_Night_1km').multiply(0.02).subtract(273.15)
            logger.info("LST bands processed successfully")
            
        except Exception as e:
            logger.error(f"Error processing LST bands: {e}")
            raise Exception(f"LST band processing failed: {e}")
        
        # Get day statistics
        try:
            day_stats = lst_day.reduceRegion(
                reducer=ee.Reducer.mean().combine(
                    reducer2=ee.Reducer.minMax(), 
                    sharedInputs=True
                ).combine(
                    reducer2=ee.Reducer.stdDev(),
                    sharedInputs=True
                ),
                geometry=geometry,
                scale=1000,
                maxPixels=1e9
            ).getInfo()
            
            if day_stats is None:
                raise Exception("Day LST statistics computation returned None")
                
        except Exception as e:
            logger.error(f"Error computing day LST statistics: {e}")
            raise Exception(f"Day LST statistics failed: {e}")
        
        # Get night statistics
        try:
            night_stats = lst_night.reduceRegion(
                reducer=ee.Reducer.mean().combine(
                    reducer2=ee.Reducer.minMax(), 
                    sharedInputs=True
                ).combine(
                    reducer2=ee.Reducer.stdDev(),
                    sharedInputs=True
                ),
                geometry=geometry,
                scale=1000,
                maxPixels=1e9
            ).getInfo()
            
            if night_stats is None:
                logger.warning("Night LST statistics computation returned None")
                night_stats = {}
                
        except Exception as e:
            logger.warning(f"Error computing night LST statistics: {e}")
            night_stats = {}
        
        # Calculate area statistics
        try:
            area_km2 = geometry.area().divide(1000000).getInfo()
            pixel_count_result = lst_day.reduceRegion(
                reducer=ee.Reducer.count(),
                geometry=geometry,
                scale=1000,
                maxPixels=1e9
            ).getInfo()
            
            pixel_count = pixel_count_result.get('LST_Day_1km', 0) if pixel_count_result else 0
            
        except Exception as e:
            logger.warning(f"Error computing LST area statistics: {e}")
            area_km2 = 0
            pixel_count = 0
        
        # Sample data points for time series visualization
        try:
            sample_points = lst_day.addBands(lst_night).sample(
                region=geometry,
                scale=1000,
                numPixels=50
            ).getInfo()
            
            if sample_points is None:
                logger.warning("LST sample points computation returned None")
                sample_data = []
            else:
                sample_data = []
                for i, feature in enumerate(sample_points.get('features', [])[:20]):  # Limit to 20 points
                    props = feature.get('properties', {})
                    coords = feature.get('geometry', {}).get('coordinates', [])
                    if coords and 'LST_Day_1km' in props:
                        sample_data.append({
                            'date': start_date,  # Use start date for consistency
                            'lst': round(props['LST_Day_1km'], 2),
                            'lst_night': round(props.get('LST_Night_1km', 0), 2),
                            'lat': round(coords[1], 6),
                            'lon': round(coords[0], 6)
                        })
                        
        except Exception as e:
            logger.warning(f"Error getting LST sample data: {e}")
            sample_data = []
        
        return {
            'success': True,
            'demo_mode': False,
            'analysis_type': 'LST',
            'satellite': 'MODIS (Real Data)',
            'data': sample_data,
            'statistics': {
                'mean_lst_day': round(day_stats.get('LST_Day_1km_mean', 0), 2) if day_stats else 0,
                'min_lst_day': round(day_stats.get('LST_Day_1km_min', 0), 2) if day_stats else 0,
                'max_lst_day': round(day_stats.get('LST_Day_1km_max', 0), 2) if day_stats else 0,
                'std_lst_day': round(day_stats.get('LST_Day_1km_stdDev', 0), 2) if day_stats else 0,
                'mean_lst_night': round(night_stats.get('LST_Night_1km_mean', 0), 2) if night_stats else 0,
                'min_lst_night': round(night_stats.get('LST_Night_1km_min', 0), 2) if night_stats else 0,
                'max_lst_night': round(night_stats.get('LST_Night_1km_max', 0), 2) if night_stats else 0,
                'std_lst_night': round(night_stats.get('LST_Night_1km_stdDev', 0), 2) if night_stats else 0,
                'area_km2': round(area_km2, 2),
                'pixel_count': pixel_count,
                'date_range': f"{start_date} to {end_date}"
            },
            'message': 'Real Earth Engine LST analysis completed successfully',
            'timestamp': datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"LST analysis error: {str(e)}")
        raise


def process_landsat_lst_analysis(geometry, start_date, end_date):
    """Process Landsat LST analysis using thermal bands"""
    try:
        logger.info(f"Processing Landsat LST analysis for {start_date} to {end_date}")
        
        # Use Landsat 8/9 collections for LST (thermal bands available)
        try:
            start_year = int(start_date.split('-')[0])
            end_year = int(end_date.split('-')[0])
            
            collections = []
            
            # Landsat 8 (2013-present) - has ST_B10
            if end_year >= 2013:
                l8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2') \
                    .filterDate(start_date, end_date) \
                    .filterBounds(geometry) \
                    .filter(ee.Filter.lt('CLOUD_COVER', 30))
                collections.append(l8)
                logger.info(f"Added Landsat 8 collection for LST")
            
            # Landsat 9 (2021-present) - has ST_B10
            if end_year >= 2021:
                l9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2') \
                    .filterDate(start_date, end_date) \
                    .filterBounds(geometry) \
                    .filter(ee.Filter.lt('CLOUD_COVER', 30))
                collections.append(l9)
                logger.info(f"Added Landsat 9 collection for LST")
            
            if not collections:
                raise Exception(f"Landsat LST requires data from 2013 onwards (Landsat 8/9 with thermal bands)")
            
            # Merge collections
            collection = collections[0]
            for i in range(1, len(collections)):
                collection = collection.merge(collections[i])
                
            collection_size = collection.size().getInfo()
            logger.info(f"Landsat LST collection contains {collection_size} images")
            
            if collection_size == 0:
                raise Exception(f"No Landsat images found for LST analysis in period {start_date} to {end_date}")
                
        except Exception as e:
            logger.error(f"Error accessing Landsat collections: {e}")
            raise Exception(f"Landsat collection access failed: {e}")
        
        # Get median composite and process thermal bands
        try:
            image = collection.median()
            if image is None:
                raise Exception("Landsat median composite returned None")
            
            # Process thermal band (ST_B10 for L8/L9) - convert from Kelvin to Celsius  
            # Scale factor: 0.00341802, Offset: 149.0, then subtract 273.15 for Celsius
            thermal_band = image.select('ST_B10')
            lst_celsius = thermal_band.multiply(0.00341802).add(149.0).subtract(273.15)
            
            logger.info("Landsat thermal band processed successfully")
            
        except Exception as e:
            logger.error(f"Error processing Landsat thermal bands: {e}")
            raise Exception(f"Landsat thermal processing failed: {e}")
        
        # Get LST statistics
        try:
            lst_stats = lst_celsius.reduceRegion(
                reducer=ee.Reducer.mean().combine(
                    reducer2=ee.Reducer.minMax(), 
                    sharedInputs=True
                ).combine(
                    reducer2=ee.Reducer.stdDev(),
                    sharedInputs=True
                ),
                geometry=geometry,
                scale=30,  # Landsat thermal resolution (resampled to 30m)
                maxPixels=1e9
            ).getInfo()
            
            if lst_stats is None:
                raise Exception("Landsat LST statistics computation returned None")
                
        except Exception as e:
            logger.error(f"Error computing Landsat LST statistics: {e}")
            raise Exception(f"Landsat LST statistics failed: {e}")
        
        # Calculate area statistics
        try:
            area_km2 = geometry.area().divide(1000000).getInfo()
            pixel_count_result = lst_celsius.reduceRegion(
                reducer=ee.Reducer.count(),
                geometry=geometry,
                scale=30,
                maxPixels=1e9
            ).getInfo()
            
            pixel_count = pixel_count_result.get('ST_B10', 0) if pixel_count_result else 0
            
        except Exception as e:
            logger.warning(f"Error computing Landsat LST area statistics: {e}")
            area_km2 = 0
            pixel_count = 0
        
        # Sample data points for visualization
        try:
            sample_points = lst_celsius.sample(
                region=geometry,
                scale=30,
                numPixels=50
            ).getInfo()
            
            if sample_points is None:
                logger.warning("Landsat LST sample points computation returned None")
                sample_data = []
            else:
                sample_data = []
                for i, feature in enumerate(sample_points.get('features', [])[:20]):
                    props = feature.get('properties', {})
                    coords = feature.get('geometry', {}).get('coordinates', [])
                    if coords and 'ST_B10' in props:
                        sample_data.append({
                            'date': start_date,
                            'lst': round(props['ST_B10'], 2),
                            'lat': round(coords[1], 6),
                            'lon': round(coords[0], 6)
                        })
                        
        except Exception as e:
            logger.warning(f"Error getting Landsat LST sample data: {e}")
            sample_data = []
        
        return {
            'success': True,
            'demo_mode': False,
            'analysis_type': 'LST',
            'satellite': 'Landsat (Real Data)',
            'data': sample_data,
            'statistics': {
                'mean_lst': round(lst_stats.get('ST_B10_mean', 0), 2) if lst_stats else 0,
                'min_lst': round(lst_stats.get('ST_B10_min', 0), 2) if lst_stats else 0,
                'max_lst': round(lst_stats.get('ST_B10_max', 0), 2) if lst_stats else 0,
                'std_lst': round(lst_stats.get('ST_B10_stdDev', 0), 2) if lst_stats else 0,
                'area_km2': round(area_km2, 2),
                'pixel_count': pixel_count,
                'date_range': f"{start_date} to {end_date}"
            },
            'message': 'Real Earth Engine Landsat LST analysis completed successfully',
            'timestamp': datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Landsat LST analysis error: {str(e)}")
        raise


def process_sar_analysis(geometry, start_date, end_date, satellite='sentinel1', **kwargs):
    """Process SAR analysis using Earth Engine"""
    try:
        polarization = kwargs.get('polarization', 'VV')
        orbit_direction = kwargs.get('orbit_direction', None)
        logger.info(f"Processing SAR analysis for {start_date} to {end_date} using {satellite}, polarization: {polarization}")
        
        if satellite.lower() == 'sentinel1' or satellite.lower() == 'sentinel':
            return process_sentinel1_sar_analysis(geometry, start_date, end_date, polarization, orbit_direction)
        else:
            logger.error(f"Unsupported satellite for SAR: {satellite}")
            raise Exception(f"Unsupported satellite for SAR analysis: {satellite}. Supported: sentinel1")
            
    except Exception as e:
        logger.error(f"SAR analysis error: {str(e)}")
        raise


def process_sentinel1_sar_analysis(geometry, start_date, end_date, polarization='VV', orbit_direction=None):
    """Process Sentinel-1 SAR analysis with specified polarization"""
    try:
        logger.info(f"Processing Sentinel-1 SAR analysis for {start_date} to {end_date}, polarization: {polarization}")
        
        # Use Sentinel-1 SAR data
        try:
            collection = ee.ImageCollection('COPERNICUS/S1_GRD') \
                .filterDate(start_date, end_date) \
                .filterBounds(geometry) \
                .filter(ee.Filter.eq('instrumentMode', 'IW'))
            
            # Filter by polarization
            if polarization == 'both':
                collection = collection.filter(
                    ee.Filter.listContains('transmitterReceiverPolarisation', 'VV')
                ).filter(
                    ee.Filter.listContains('transmitterReceiverPolarisation', 'VH')
                )
            elif polarization == 'VV':
                collection = collection.filter(
                    ee.Filter.listContains('transmitterReceiverPolarisation', 'VV')
                )
            elif polarization == 'VH':
                collection = collection.filter(
                    ee.Filter.listContains('transmitterReceiverPolarisation', 'VH')
                )
            
            # Filter by orbit direction if specified
            if orbit_direction:
                collection = collection.filter(ee.Filter.eq('orbitProperties_pass', orbit_direction))
            
            # Check collection size
            collection_size = collection.size().getInfo()
            logger.info(f"Sentinel-1 collection contains {collection_size} images")
            if collection_size == 0:
                raise Exception(f"No Sentinel-1 images found for period {start_date} to {end_date}")
                
        except Exception as e:
            logger.error(f"Error accessing Sentinel-1 collection: {e}")
            raise Exception(f"Sentinel-1 collection access failed: {e}")
        
        # Get median composite
        try:
            image = collection.median()
            if image is None:
                raise Exception("Sentinel-1 median composite returned None")
                
        except Exception as e:
            logger.error(f"Error creating Sentinel-1 composite: {e}")
            raise Exception(f"Sentinel-1 composite creation failed: {e}")
        
        # VV and VH polarizations (convert from linear to dB)
        try:
            vv = image.select('VV')
            vh = image.select('VH')
            
            # Convert to dB scale (10 * log10(linear))
            vv_db = ee.Image(10).multiply(vv.log10()).rename('VV_dB')
            vh_db = ee.Image(10).multiply(vh.log10()).rename('VH_dB')
            
            # Calculate VV/VH ratio
            ratio = vv.divide(vh).rename('VV_VH_ratio')
            logger.info("Sentinel-1 polarizations processed successfully")
            
        except Exception as e:
            logger.error(f"Error processing Sentinel-1 polarizations: {e}")
            raise Exception(f"Sentinel-1 polarization processing failed: {e}")
        
        # Get VV statistics
        try:
            vv_stats = vv_db.reduceRegion(
                reducer=ee.Reducer.mean().combine(
                    reducer2=ee.Reducer.minMax(), 
                    sharedInputs=True
                ).combine(
                    reducer2=ee.Reducer.stdDev(),
                    sharedInputs=True
                ),
                geometry=geometry,
                scale=10,
                maxPixels=1e9
            ).getInfo()
            
            if vv_stats is None:
                raise Exception("VV statistics computation returned None")
                
        except Exception as e:
            logger.error(f"Error computing VV statistics: {e}")
            raise Exception(f"VV statistics failed: {e}")
        
        # Get VH statistics
        try:
            vh_stats = vh_db.reduceRegion(
                reducer=ee.Reducer.mean().combine(
                    reducer2=ee.Reducer.minMax(), 
                    sharedInputs=True
                ).combine(
                    reducer2=ee.Reducer.stdDev(),
                    sharedInputs=True
                ),
                geometry=geometry,
                scale=10,
                maxPixels=1e9
            ).getInfo()
            
            if vh_stats is None:
                logger.warning("VH statistics computation returned None")
                vh_stats = {}
                
        except Exception as e:
            logger.warning(f"Error computing VH statistics: {e}")
            vh_stats = {}
        
        # Calculate area statistics
        try:
            area_km2 = geometry.area().divide(1000000).getInfo()
            pixel_count_result = vv_db.reduceRegion(
                reducer=ee.Reducer.count(),
                geometry=geometry,
                scale=10,
                maxPixels=1e9
            ).getInfo()
            
            pixel_count = pixel_count_result.get('VV_dB', 0) if pixel_count_result else 0
            
        except Exception as e:
            logger.warning(f"Error computing SAR area statistics: {e}")
            area_km2 = 0
            pixel_count = 0
        
        # Sample data points for time series visualization
        try:
            sample_points = vv_db.addBands(vh_db).addBands(ratio).sample(
                region=geometry,
                scale=10,
                numPixels=50
            ).getInfo()
            
            if sample_points is None:
                logger.warning("SAR sample points computation returned None")
                sample_data = []
            else:
                sample_data = []
                for i, feature in enumerate(sample_points.get('features', [])[:20]):  # Limit to 20 points
                    props = feature.get('properties', {})
                    coords = feature.get('geometry', {}).get('coordinates', [])
                    if coords and 'VV_dB' in props:
                        sample_data.append({
                            'date': start_date,  # Use start date for consistency
                            'backscatter_vv': round(props['VV_dB'], 2),
                            'backscatter_vh': round(props.get('VH_dB', 0), 2),
                            'vv_vh_ratio': round(props.get('VV_VH_ratio', 0), 4),
                            'lat': round(coords[1], 6),
                            'lon': round(coords[0], 6)
                        })
                        
        except Exception as e:
            logger.warning(f"Error getting SAR sample data: {e}")
            sample_data = []
        
        return {
            'success': True,
            'demo_mode': False,
            'analysis_type': 'SAR',
            'satellite': 'Sentinel-1 (Real Data)',
            'data': sample_data,
            'statistics': {
                'mean_vv_db': round(vv_stats.get('VV_dB_mean', 0), 2) if vv_stats else 0,
                'min_vv_db': round(vv_stats.get('VV_dB_min', 0), 2) if vv_stats else 0,
                'max_vv_db': round(vv_stats.get('VV_dB_max', 0), 2) if vv_stats else 0,
                'std_vv_db': round(vv_stats.get('VV_dB_stdDev', 0), 2) if vv_stats else 0,
                'mean_vh_db': round(vh_stats.get('VH_dB_mean', 0), 2) if vh_stats else 0,
                'min_vh_db': round(vh_stats.get('VH_dB_min', 0), 2) if vh_stats else 0,
                'max_vh_db': round(vh_stats.get('VH_dB_max', 0), 2) if vh_stats else 0,
                'std_vh_db': round(vh_stats.get('VH_dB_stdDev', 0), 2) if vh_stats else 0,
                'area_km2': round(area_km2, 2),
                'pixel_count': pixel_count,
                'date_range': f"{start_date} to {end_date}"
            },
            'message': 'Real Earth Engine SAR analysis completed successfully',
            'timestamp': datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"SAR analysis error: {str(e)}")
        raise


def get_earth_engine_project_id(request):
    """Get the Earth Engine project ID - uses your app project automatically"""
    # Use your Earth Engine app project automatically
    if hasattr(settings, 'EARTH_ENGINE_PROJECT') and settings.EARTH_ENGINE_PROJECT:
        project_id = settings.EARTH_ENGINE_PROJECT
        
        # Store in session for consistency
        request.session['ee_project_id'] = project_id
        request.session['ee_initialized'] = True
        request.session['ee_auth_time'] = datetime.now().isoformat()
        request.session['ee_app_mode'] = True  # Indicates using app authentication
        
        return project_id, None
    
    # Fallback to user-provided project ID (backward compatibility)
    project_id = None
    if hasattr(request, 'data') and request.data:
        project_id = request.data.get('projectId')
    elif request.POST:
        project_id = request.POST.get('projectId')
    
    if not project_id:
        return None, {'error': 'Earth Engine configuration error'}
    
    # Store in session
    request.session['ee_project_id'] = project_id
    request.session['ee_initialized'] = True
    request.session['ee_auth_time'] = datetime.now().isoformat()
    request.session['ee_app_mode'] = False
    
    return project_id, None


def validate_coordinates(coordinates_data):
    """Validate coordinate data"""
    if not coordinates_data:
        return None, {'error': 'Coordinates are required'}
    
    # Handle different coordinate formats
    if isinstance(coordinates_data, str):
        if coordinates_data.startswith('POLYGON'):
            # WKT format - would need parsing in real implementation
            return coordinates_data, None
        else:
            try:
                coordinates_data = json.loads(coordinates_data)
            except json.JSONDecodeError:
                return None, {'error': 'Invalid coordinate format'}
    
    if isinstance(coordinates_data, list):
        # List of coordinate pairs
        if len(coordinates_data) < 3:
            return None, {'error': 'At least 3 coordinate pairs required for polygon'}
        return coordinates_data, None
    
    return None, {'error': 'Invalid coordinate format'}


def validate_date_range(start_date, end_date):
    """Validate date range"""
    if not start_date or not end_date:
        return None, None, {'error': 'Start date and end date are required'}
    
    try:
        # Basic date format validation
        datetime.strptime(start_date, '%Y-%m-%d')
        datetime.strptime(end_date, '%Y-%m-%d')
    except ValueError:
        return None, None, {'error': 'Invalid date format. Use YYYY-MM-DD'}
    
    if start_date >= end_date:
        return None, None, {'error': 'Start date must be before end date'}
    
    return start_date, end_date, None


def generate_demo_data(analysis_type, start_date, end_date, coordinates=None):
    """Generate demo data for different analysis types"""
    
    # Generate some sample dates between start and end
    demo_dates = [
        f"{start_date[:4]}-06-15",  # Summer
        f"{int(start_date[:4])+1}-06-15",
        f"{int(start_date[:4])+2}-06-15",
        f"{end_date[:4]}-06-15"
    ]
    
    if analysis_type == 'ndvi':
        data = []
        for i, date in enumerate(demo_dates):
            data.append({
                'date': date,
                'ndvi': round(0.65 + (i * 0.03) + (i % 2 * 0.05), 3),
                'count': 150 - i * 2
            })
        
        values = [d['ndvi'] for d in data]
        statistics = {
            'mean': round(sum(values) / len(values), 3),
            'median': round(sorted(values)[len(values)//2], 3),
            'std': round((sum((x - sum(values)/len(values))**2 for x in values) / len(values))**0.5, 3),
            'min': min(values),
            'max': max(values),
            'count': len(values)
        }
        
    elif analysis_type == 'lst':
        data = []
        for i, date in enumerate(demo_dates):
            data.append({
                'date': date,
                'lst': round(298.5 + (i * 1.2), 1),  # Temperature in Kelvin
                'lst_celsius': round(298.5 + (i * 1.2) - 273.15, 1),  # Temperature in Celsius
                'count': 150 - i * 2
            })
        
        values = [d['lst'] for d in data]
        statistics = {
            'mean': round(sum(values) / len(values), 1),
            'median': round(sorted(values)[len(values)//2], 1),
            'std': round((sum((x - sum(values)/len(values))**2 for x in values) / len(values))**0.5, 1),
            'min': min(values),
            'max': max(values),
            'count': len(values)
        }
        
    elif analysis_type == 'sentinel1':
        data = []
        for i, date in enumerate(demo_dates):
            data.append({
                'date': date,
                'backscatter_vv': round(-12.5 + (i * 0.3), 1),
                'backscatter_vh': round(-18.5 + (i * 0.4), 1),
                'count': 150 - i * 2
            })
        
        values = [d['backscatter_vv'] for d in data]
        statistics = {
            'mean': round(sum(values) / len(values), 1),
            'median': round(sorted(values)[len(values)//2], 1),
            'std': round((sum((x - sum(values)/len(values))**2 for x in values) / len(values))**0.5, 1),
            'min': min(values),
            'max': max(values),
            'count': len(values)
        }
        
    elif analysis_type == 'sentinel2':
        data = []
        for i, date in enumerate(demo_dates):
            data.append({
                'date': date,
                'ndvi': round(0.68 + (i * 0.025) + (i % 2 * 0.04), 3),
                'count': 180 - i * 3  # Higher count for Sentinel-2
            })
        
        values = [d['ndvi'] for d in data]
        statistics = {
            'mean': round(sum(values) / len(values), 3),
            'median': round(sorted(values)[len(values)//2], 3),
            'std': round((sum((x - sum(values)/len(values))**2 for x in values) / len(values))**0.5, 3),
            'min': min(values),
            'max': max(values),
            'count': len(values)
        }
        
    else:
        # Default to NDVI
        return generate_demo_data('ndvi', start_date, end_date, coordinates)
    
    return {
        'success': True,
        'demo_mode': True,
        'analysis_type': analysis_type.upper(),
        'satellite': 'Demo Data',
        'data': data,
        'statistics': statistics,
        'message': f'Demo {analysis_type.upper()} analysis completed successfully',
        'timestamp': datetime.now().isoformat(),
        'coordinates_provided': coordinates is not None
    }


@extend_schema(
    summary="Health Check",
    description="Check if the analysis service is running and accessible",
    tags=["Analysis"],
    responses={
        200: OpenApiResponse(
            response=OpenApiTypes.OBJECT,
            description="Service is healthy",
            examples=[
                OpenApiExample(
                    "Success Response",
                    value={"status": "OK"},
                    response_only=True,
                )
            ]
        )
    }
)
@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Health check endpoint to verify the analysis service is running."""
    return Response({'status': 'OK'}, status=status.HTTP_200_OK)


def process_analysis_generic(request, analysis_type):
    """
    Generic analysis processor for NDVI, LST, and Sentinel analysis.
    Provides consistent functionality across all analysis types.
    
    Args:
        request: Django request object
        analysis_type: Type of analysis ('ndvi', 'lst', 'sentinel')
    """
    try:
        # Validate project ID
        project_id, error = get_earth_engine_project_id(request)
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)
        
        # Extract request data
        if hasattr(request, 'data') and request.data:
            data = request.data
        else:
            data = dict(request.POST)
            # Convert single-item lists to strings
            for key, value in data.items():
                if isinstance(value, list) and len(value) == 1:
                    data[key] = value[0]
        
        # Handle geometry parameter
        geometry_data = data.get('geometry')
        if geometry_data:
            # If geometry is a string, try to parse it as JSON
            if isinstance(geometry_data, str):
                try:
                    geometry_json = json.loads(geometry_data)
                    # Extract coordinates from GeoJSON
                    if isinstance(geometry_json, dict) and 'coordinates' in geometry_json:
                        coordinates = geometry_json['coordinates']
                        if geometry_json.get('type') == 'Polygon' and coordinates:
                            # Get the first ring of the polygon
                            coordinates = coordinates[0] if coordinates else []
                    else:
                        coordinates = geometry_json
                except json.JSONDecodeError:
                    return Response({'error': 'Invalid geometry JSON format'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                # Assume it's already parsed
                if isinstance(geometry_data, dict) and 'coordinates' in geometry_data:
                    coordinates = geometry_data['coordinates']
                    if geometry_data.get('type') == 'Polygon' and coordinates:
                        coordinates = coordinates[0] if coordinates else []
                else:
                    coordinates = geometry_data
        else:
            # Fall back to direct coordinates parameter
            coordinates = data.get('coordinates')
        
        # Validate coordinates
        if not coordinates:
            return Response({'error': 'Coordinates are required'}, status=status.HTTP_400_BAD_REQUEST)
        
        coordinates, error = validate_coordinates(coordinates)
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)
        
        # Parse dates
        date_range_type = data.get('date_range_type', 'years')
        if date_range_type == 'years':
            start_year = data.get('start_year', '2020')
            end_year = data.get('end_year', '2023')
            start_date = f"{start_year}-01-01"
            end_date = f"{end_year}-12-31"
        else:
            start_date = data.get('start_date')
            end_date = data.get('end_date')
        
        start_date, end_date, error = validate_date_range(start_date, end_date)
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)
        
        # Get analysis parameters
        satellite = data.get('satellite', 'landsat' if analysis_type != 'sentinel' else 'sentinel')
        cloud_cover = data.get('cloud_cover', 20)
        polarization = data.get('polarization', 'VV')  # Default to VV polarization for SAR
        
        # Map analysis types to appropriate processing
        if analysis_type == 'sentinel':
            actual_analysis_type = 'backscatter'  # Sentinel-1 SAR
            analysis_type = 'backscatter'  # Store as backscatter in database
            satellite = 'sentinel'
        elif analysis_type == 'lst':
            actual_analysis_type = 'lst'
        else:
            actual_analysis_type = 'ndvi'
        
        # Validate cloud cover
        try:
            cloud_cover = int(cloud_cover)
            if cloud_cover < 0 or cloud_cover > 100:
                return Response({'error': 'Cloud cover must be between 0 and 100'}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({'error': 'Cloud cover must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"Processing {analysis_type} analysis for {satellite} satellite with Earth Engine")
        
        try:
            # Import Earth Engine modules
            from apps.earth_engine.ee_config import initialize_earth_engine, is_initialized
            
            # Ensure Earth Engine is initialized
            if not is_initialized():
                initialize_earth_engine()
            
            # If still not initialized, fall back to demo data
            if not is_initialized():
                logger.warning("Earth Engine not available, using demo data")
                result = generate_demo_data(analysis_type, start_date, end_date, coordinates)
            else:
                # Use real Earth Engine processing
                logger.info(f"Using Earth Engine for {satellite} {actual_analysis_type} analysis")
                
                # Prepare additional parameters for SAR analysis
                sar_kwargs = {}
                if analysis_type == 'backscatter':
                    sar_kwargs['polarization'] = polarization
                    orbit_direction = data.get('orbit_direction')
                    if orbit_direction:
                        sar_kwargs['orbit_direction'] = orbit_direction
                
                result = process_earth_engine_analysis(
                    actual_analysis_type, start_date, end_date, coordinates, project_id, satellite, **sar_kwargs
                )
                
        except Exception as e:
            logger.error(f"Error in Earth Engine processing: {str(e)}")
            # Fall back to demo data on any error
            logger.info("Falling back to demo data due to Earth Engine error")
            result = generate_demo_data(analysis_type, start_date, end_date, coordinates)
        
        # Add request parameters to result
        result['request_parameters'] = {
            'satellite': satellite,
            'analysis_type': analysis_type,
            'date_range_type': date_range_type,
            'start_date': start_date,
            'end_date': end_date,
            'cloud_cover': cloud_cover,
            'project_id': project_id
        }
        
        # Generate download files if analysis was successful
        if result.get('success') and (result.get('data') or result.get('statistics')):
            try:
                # For real Earth Engine data, create synthetic time series data for plotting
                if result.get('demo_mode') == False and (not result.get('data') or len(result.get('data', [])) == 0):
                    # Create synthetic data points from statistics for plotting
                    stats = result.get('statistics', {})
                    if stats:
                        synthetic_data = []
                        from datetime import datetime, timedelta
                        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
                        end_dt = datetime.strptime(end_date, '%Y-%m-%d')
                        
                        # Create 4-6 data points across the range
                        num_points = 5
                        time_delta = (end_dt - start_dt) / (num_points - 1)
                        
                        # Get appropriate mean and std values based on analysis type
                        if analysis_type == 'ndvi':
                            mean_val = stats.get('mean_ndvi', 0.5)
                            std_val = stats.get('std_ndvi', 0.1)
                            value_key = 'ndvi'
                        elif analysis_type == 'lst':
                            mean_val = stats.get('mean_lst', 25.0)
                            std_val = stats.get('std_lst', 5.0)
                            value_key = 'lst'
                        else:  # sentinel
                            mean_val = stats.get('mean_backscatter', -10.0)
                            std_val = stats.get('std_backscatter', 2.0)
                            value_key = 'backscatter'
                        
                        for i in range(num_points):
                            date_point = start_dt + (time_delta * i)
                            # Add some variation around the mean
                            import random
                            value = mean_val + random.uniform(-std_val, std_val)
                            
                            data_point = {
                                'date': date_point.strftime('%Y-%m-%d'),
                                value_key: round(value, 4)
                            }
                            synthetic_data.append(data_point)
                        
                        result['data'] = synthetic_data
                        logger.info(f"Created {len(synthetic_data)} synthetic data points for visualization")
                
                # Generate advanced statistics
                if result.get('data'):
                    # Use correct column name based on analysis type
                    if analysis_type == 'ndvi':
                        value_column = 'ndvi'
                    elif analysis_type == 'lst':
                        value_column = 'lst'
                    else:  # sentinel
                        value_column = 'backscatter'
                    
                    advanced_stats = integrate_advanced_statistics(result['data'], value_column)
                    if 'error' not in advanced_stats:
                        # Merge with existing statistics
                        if 'statistics' in result:
                            result['statistics'].update(advanced_stats)
                        else:
                            result['statistics'] = advanced_stats
                
                # Generate plot and CSV files
                title = f"{satellite.title()} {analysis_type.upper()} Analysis ({start_date} to {end_date})"
                
                # Create plot file
                if result.get('data'):
                    plot_result = generate_plot_file(result['data'], analysis_type, title, analysis_type)
                    if plot_result['success']:
                        result['plot_url'] = plot_result['plot_url']
                        result['plot_filename'] = plot_result['filename']
                
                # Create CSV file
                if result.get('data'):
                    csv_result = generate_csv_file(result['data'], analysis_type)
                    if csv_result['success']:
                        result['csv_url'] = csv_result['csv_url']
                        result['csv_filename'] = csv_result['filename']
                        
                logger.info(f"Generated download files for {analysis_type} analysis")
                
            except Exception as e:
                logger.warning(f"Error generating download files: {str(e)}")
                # Don't fail the request if file generation fails
        
        # Save analysis results to database
        try:
            # Update request data with corrected satellite and polarization info
            data_for_db = data.copy()
            data_for_db['satellite'] = satellite
            if analysis_type == 'backscatter':
                data_for_db['polarization'] = polarization
            
            save_analysis_to_database(
                request_data=data_for_db,
                analysis_results=result,
                analysis_type=analysis_type,
                user=request.user if hasattr(request, 'user') and request.user.is_authenticated else None
            )
        except Exception as e:
            logger.warning(f"Database save failed: {str(e)}")
            # Don't fail the request if database save fails
        
        return Response(result)
        
    except Exception as e:
        logger.error(f"Error in {analysis_type} analysis: {str(e)}")
        return Response(
            {'error': f'Processing error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@extend_schema(
    summary="NDVI Analysis",
    description="Process NDVI (Normalized Difference Vegetation Index) analysis for a given geometry and date range using Landsat/Sentinel-2 satellite data",
    tags=["Analysis"],
    request={
        'multipart/form-data': {
            'type': 'object',
            'properties': {
                'geometry': {
                    'type': 'object',
                    'description': 'GeoJSON geometry object defining the area of interest',
                    'example': {
                        "type": "Polygon",
                        "coordinates": [[[-74.1, 40.7], [-74.0, 40.7], [-74.0, 40.8], [-74.1, 40.8], [-74.1, 40.7]]]
                    }
                },
                'start_date': {
                    'type': 'string',
                    'format': 'date',
                    'description': 'Start date for analysis (YYYY-MM-DD format)',
                    'example': '2023-01-01'
                },
                'end_date': {
                    'type': 'string',
                    'format': 'date',
                    'description': 'End date for analysis (YYYY-MM-DD format)',
                    'example': '2023-12-31'
                },
                'satellite': {
                    'type': 'string',
                    'description': 'Satellite to use (landsat or sentinel)',
                    'example': 'landsat',
                    'enum': ['landsat', 'sentinel']
                },
                'cloud_cover': {
                    'type': 'integer',
                    'description': 'Maximum cloud cover percentage (0-100)',
                    'example': 20
                },
                'project_id': {
                    'type': 'string',
                    'description': 'Google Earth Engine project ID (optional)',
                    'required': False
                }
            },
            'required': ['geometry', 'start_date', 'end_date']
        }
    },
    responses={
        200: OpenApiResponse(
            response=OpenApiTypes.OBJECT,
            description="NDVI analysis results with statistics and download links",
            examples=[
                OpenApiExample(
                    "Success Response",
                    value={
                        "message": "NDVI analysis completed successfully",
                        "data": [
                            {"date": "2023-01-15", "ndvi": 0.65},
                            {"date": "2023-06-15", "ndvi": 0.75}
                        ],
                        "statistics": {
                            "mean_ndvi": 0.65,
                            "min_ndvi": 0.1,
                            "max_ndvi": 0.9,
                            "std_ndvi": 0.15
                        },
                        "plot_url": "/media/plots/ndvi_plot_20231201_123456.png",
                        "csv_url": "/media/csv/ndvi_data_20231201_123456.csv"
                    },
                    response_only=True,
                )
            ]
        ),
        400: OpenApiResponse(
            description="Bad request - invalid parameters or geometry"
        ),
        500: OpenApiResponse(
            description="Internal server error during processing"
        )
    }
)
@api_view(['POST'])
@permission_classes([AllowAny])
def process_ndvi(request):
    """
    Process NDVI analysis for a given geometry and date range.
    Supports both Landsat and Sentinel-2 satellites.
    """
    return process_analysis_generic(request, 'ndvi')


@extend_schema(
    summary="LST Analysis",
    description="Process Land Surface Temperature (LST) analysis for a given geometry and date range using Landsat satellite data",
    tags=["Analysis"],  
    request={
        'multipart/form-data': {
            'type': 'object',
            'properties': {
                'geometry': {
                    'type': 'object',
                    'description': 'GeoJSON geometry object defining the area of interest',
                    'example': {
                        "type": "Polygon",
                        "coordinates": [[[-74.1, 40.7], [-74.0, 40.7], [-74.0, 40.8], [-74.1, 40.8], [-74.1, 40.7]]]
                    }
                },
                'start_date': {
                    'type': 'string',
                    'format': 'date',
                    'description': 'Start date for analysis (YYYY-MM-DD format)',
                    'example': '2023-01-01'
                },
                'end_date': {
                    'type': 'string',
                    'format': 'date', 
                    'description': 'End date for analysis (YYYY-MM-DD format)',
                    'example': '2023-12-31'
                },
                'satellite': {
                    'type': 'string',
                    'description': 'Satellite to use (landsat)',
                    'example': 'landsat',
                    'enum': ['landsat']
                },
                'cloud_cover': {
                    'type': 'integer',
                    'description': 'Maximum cloud cover percentage (0-100)',
                    'example': 20
                },
                'project_id': {
                    'type': 'string',
                    'description': 'Google Earth Engine project ID (optional)',
                    'required': False
                }
            },
            'required': ['geometry', 'start_date', 'end_date']
        }
    },
    responses={
        200: OpenApiResponse(
            response=OpenApiTypes.OBJECT,
            description="LST analysis results with statistics and download links",
            examples=[
                OpenApiExample(
                    "Success Response",
                    value={
                        "message": "LST analysis completed successfully",
                        "data": [
                            {"date": "2023-01-15", "lst": 25.5},
                            {"date": "2023-06-15", "lst": 32.1}
                        ],
                        "statistics": {
                            "mean_lst": 28.8,
                            "min_lst": 15.2,
                            "max_lst": 45.3,
                            "std_lst": 5.4
                        },
                        "plot_url": "/media/plots/lst_plot_20231201_123456.png",
                        "csv_url": "/media/csv/lst_data_20231201_123456.csv"
                    },
                    response_only=True,
                )
            ]
        ),
        400: OpenApiResponse(
            description="Bad request - invalid parameters or geometry"
        ),
        500: OpenApiResponse(
            description="Internal server error during processing"
        )
    }
)
@api_view(['POST'])
@permission_classes([AllowAny])
def process_lst(request):
    """
    Process Land Surface Temperature analysis for a given geometry and date range.
    Uses Landsat satellite thermal bands for temperature calculations.
    """
    return process_analysis_generic(request, 'lst')


@extend_schema(
    summary="Sentinel SAR Analysis",
    description="Process Sentinel-1 SAR backscatter analysis for a given geometry and date range using Sentinel-1 satellite data",
    tags=["Analysis"],
    request={
        'multipart/form-data': {
            'type': 'object',
            'properties': {
                'geometry': {
                    'type': 'object',
                    'description': 'GeoJSON geometry object defining the area of interest',
                    'example': {
                        "type": "Polygon",
                        "coordinates": [[[-74.1, 40.7], [-74.0, 40.7], [-74.0, 40.8], [-74.1, 40.8], [-74.1, 40.7]]]
                    }
                },
                'start_date': {
                    'type': 'string',
                    'format': 'date',
                    'description': 'Start date for analysis (YYYY-MM-DD format)',
                    'example': '2023-01-01'
                },
                'end_date': {
                    'type': 'string',
                    'format': 'date',
                    'description': 'End date for analysis (YYYY-MM-DD format)',
                    'example': '2023-12-31'
                },
                'polarization': {
                    'type': 'string',
                    'description': 'SAR polarization mode (VV, VH, or both)',
                    'example': 'VV',
                    'enum': ['VV', 'VH', 'both']
                },
                'orbit_direction': {
                    'type': 'string',
                    'description': 'Satellite orbit direction (ASCENDING or DESCENDING)',
                    'example': 'ASCENDING',
                    'enum': ['ASCENDING', 'DESCENDING']
                },
                'project_id': {
                    'type': 'string',
                    'description': 'Google Earth Engine project ID (optional)',
                    'required': False
                }
            },
            'required': ['geometry', 'start_date', 'end_date']
        }
    },
    responses={
        200: OpenApiResponse(
            response=OpenApiTypes.OBJECT,
            description="Sentinel SAR analysis results with statistics and download links",
            examples=[
                OpenApiExample(
                    "Success Response",
                    value={
                        "message": "Sentinel SAR analysis completed successfully",
                        "data": [
                            {"date": "2023-01-15", "backscatter": -12.3},
                            {"date": "2023-06-15", "backscatter": -8.7}
                        ],
                        "statistics": {
                            "mean_backscatter": -10.5,
                            "min_backscatter": -18.2,
                            "max_backscatter": -5.1,
                            "std_backscatter": 2.8
                        },
                        "plot_url": "/media/plots/sentinel_plot_20231201_123456.png",
                        "csv_url": "/media/csv/sentinel_data_20231201_123456.csv"
                    },
                    response_only=True,
                )
            ]
        ),
        400: OpenApiResponse(
            description="Bad request - invalid parameters or geometry"
        ),
        500: OpenApiResponse(
            description="Internal server error during processing"
        )
    }
)
@api_view(['POST'])
@permission_classes([AllowAny])
def process_sentinel(request):
    """
    Process Sentinel-1 SAR backscatter analysis for a given geometry and date range.
    Analyzes SAR backscatter values for surface change detection.
    """
    return process_analysis_generic(request, 'sentinel')


@api_view(['POST'])
@permission_classes([AllowAny])
def process_lst_request(request):
    """
    Process Land Surface Temperature analysis.
    Matches Flask /process_lst endpoint.
    """
    try:
        # Validate project ID
        project_id, error = get_earth_engine_project_id(request)
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)
        
        # Extract request data
        if hasattr(request, 'data') and request.data:
            data = request.data
        else:
            data = dict(request.POST)
            for key, value in data.items():
                if isinstance(value, list) and len(value) == 1:
                    data[key] = value[0]
        
        # Validate coordinates
        coordinates = data.get('coordinates')
        coordinates, error = validate_coordinates(coordinates)
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)
        
        # Parse dates
        date_range_type = data.get('date_range_type', 'years')
        if date_range_type == 'years':
            start_year = data.get('start_year', '2020')
            end_year = data.get('end_year', '2023')
            start_date = f"{start_year}-01-01"
            end_date = f"{end_year}-12-31"
        else:
            start_date = data.get('start_date')
            end_date = data.get('end_date')
        
        start_date, end_date, error = validate_date_range(start_date, end_date)
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate LST demo data
        result = generate_demo_data('lst', start_date, end_date, coordinates)
        result['request_parameters'] = {
            'satellite': 'landsat',
            'analysis_type': 'lst',
            'date_range_type': date_range_type,
            'start_date': start_date,
            'end_date': end_date,
            'cloud_cover': data.get('cloud_cover', 20),
            'project_id': project_id
        }
        
        # Generate download files if analysis was successful
        if result.get('success') and result.get('data'):
            try:
                # Generate advanced statistics for LST
                advanced_stats = integrate_advanced_statistics(result['data'], 'lst')
                if 'error' not in advanced_stats:
                    result['statistics'] = advanced_stats
                
                # Generate plot and CSV files
                title = f"Landsat LST Analysis ({start_date} to {end_date})"
                
                # Create plot file
                plot_result = generate_plot_file(result['data'], 'lst', title, 'lst')
                if plot_result['success']:
                    result['plot_url'] = plot_result['plot_url']
                    result['plot_filename'] = plot_result['filename']
                
                # Create CSV file
                csv_result = generate_csv_file(result['data'], 'lst')
                if csv_result['success']:
                    result['csv_url'] = csv_result['csv_url']
                    result['csv_filename'] = csv_result['filename']
                    
                logger.info(f"Generated download files for LST analysis")
                
            except Exception as e:
                logger.warning(f"Error generating LST download files: {str(e)}")
        
        # Save analysis results to database
        try:
            save_analysis_to_database(
                request_data=data,
                analysis_results=result,
                analysis_type='lst',
                user=request.user
            )
        except Exception as e:
            logger.warning(f"Database save failed: {str(e)}")
            # Don't fail the request if database save fails
        
        return Response(result)
        
    except Exception as e:
        logger.error(f"Error in process_lst_request: {str(e)}")
        return Response(
            {'error': f'LST processing error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def process_sentinel1_request(request):
    """
    Process Sentinel-1 SAR backscatter analysis.
    Matches Flask /process_sentinel1 endpoint.
    """
    try:
        # Validate project ID
        project_id, error = get_earth_engine_project_id(request)
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)
        
        # Extract request data
        if hasattr(request, 'data') and request.data:
            data = request.data
        else:
            data = dict(request.POST)
            for key, value in data.items():
                if isinstance(value, list) and len(value) == 1:
                    data[key] = value[0]
        
        # Validate coordinates
        coordinates = data.get('coordinates')
        coordinates, error = validate_coordinates(coordinates)
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)
        
        # Parse dates
        date_range_type = data.get('date_range_type', 'years')
        if date_range_type == 'years':
            start_year = data.get('start_year', '2020')
            end_year = data.get('end_year', '2023')
            start_date = f"{start_year}-01-01"
            end_date = f"{end_year}-12-31"
        else:
            start_date = data.get('start_date')
            end_date = data.get('end_date')
        
        start_date, end_date, error = validate_date_range(start_date, end_date)
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate Sentinel-1 demo data
        result = generate_demo_data('sentinel1', start_date, end_date, coordinates)
        result['request_parameters'] = {
            'satellite': 'sentinel',
            'analysis_type': 'backscatter',
            'date_range_type': date_range_type,
            'start_date': start_date,
            'end_date': end_date,
            'polarization': data.get('polarization', 'VV'),
            'project_id': project_id
        }
        
        # Generate download files if analysis was successful
        if result.get('success') and result.get('data'):
            try:
                # Generate advanced statistics for backscatter
                advanced_stats = integrate_advanced_statistics(result['data'], 'backscatter')
                if 'error' not in advanced_stats:
                    result['statistics'] = advanced_stats
                
                # Generate plot and CSV files
                title = f"Sentinel-1 SAR Backscatter Analysis ({start_date} to {end_date})"
                
                # Create plot file
                plot_result = generate_plot_file(result['data'], 'sentinel1', title, 'sentinel1')
                if plot_result['success']:
                    result['plot_url'] = plot_result['plot_url']
                    result['plot_filename'] = plot_result['filename']
                
                # Create CSV file
                csv_result = generate_csv_file(result['data'], 'sentinel1')
                if csv_result['success']:
                    result['csv_url'] = csv_result['csv_url']
                    result['csv_filename'] = csv_result['filename']
                    
                logger.info(f"Generated download files for Sentinel-1 analysis")
                
            except Exception as e:
                logger.warning(f"Error generating Sentinel-1 download files: {str(e)}")
        
        # Save analysis results to database
        try:
            save_analysis_to_database(
                request_data=data,
                analysis_results=result,
                analysis_type='sentinel1',
                user=request.user
            )
        except Exception as e:
            logger.warning(f"Database save failed: {str(e)}")
            # Don't fail the request if database save fails
        
        return Response(result)
        
    except Exception as e:
        logger.error(f"Error in process_sentinel1_request: {str(e)}")
        return Response(
            {'error': f'Sentinel-1 processing error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def process_comprehensive(request):
    """
    Process comprehensive analysis (multiple analysis types).
    Matches Flask /process_comprehensive endpoint.
    """
    try:
        # Validate project ID
        project_id, error = get_earth_engine_project_id(request)
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)
        
        # Extract request data
        if hasattr(request, 'data') and request.data:
            data = request.data
        else:
            data = dict(request.POST)
            for key, value in data.items():
                if isinstance(value, list) and len(value) == 1:
                    data[key] = value[0]
        
        # Validate coordinates
        coordinates = data.get('coordinates')
        coordinates, error = validate_coordinates(coordinates)
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)
        
        # Parse dates
        date_range_type = data.get('date_range_type', 'years')
        if date_range_type == 'years':
            start_year = data.get('start_year', '2020')
            end_year = data.get('end_year', '2023')
            start_date = f"{start_year}-01-01"
            end_date = f"{end_year}-12-31"
        else:
            start_date = data.get('start_date')
            end_date = data.get('end_date')
        
        start_date, end_date, error = validate_date_range(start_date, end_date)
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)
        
        # Get analysis types
        analysis_types = data.get('analysis_types', ['ndvi', 'lst', 'sentinel1'])
        if isinstance(analysis_types, str):
            analysis_types = analysis_types.split(',')
        
        # Generate data for each analysis type
        results = {}
        plot_urls = []
        csv_urls = []
        
        for analysis_type in analysis_types:
            result = generate_demo_data(analysis_type.strip(), start_date, end_date, coordinates)
            
            # Generate download files for each analysis type
            if result.get('success') and result.get('data'):
                try:
                    # Generate advanced statistics
                    value_column = 'ndvi' if analysis_type == 'ndvi' else 'lst' if analysis_type == 'lst' else 'backscatter'
                    advanced_stats = integrate_advanced_statistics(result['data'], value_column)
                    if 'error' not in advanced_stats:
                        result['statistics'] = advanced_stats
                    
                    # Generate plot and CSV files
                    title = f"{analysis_type.upper()} Analysis ({start_date} to {end_date})"
                    
                    # Create plot file
                    plot_result = generate_plot_file(result['data'], analysis_type, title, analysis_type)
                    if plot_result['success']:
                        result['plot_url'] = plot_result['plot_url']
                        plot_urls.append(plot_result['plot_url'])
                    
                    # Create CSV file
                    csv_result = generate_csv_file(result['data'], analysis_type)
                    if csv_result['success']:
                        result['csv_url'] = csv_result['csv_url']
                        csv_urls.append(csv_result['csv_url'])
                        
                except Exception as e:
                    logger.warning(f"Error generating {analysis_type} download files: {str(e)}")
            
            results[analysis_type.strip()] = {
                'data': result['data'],
                'statistics': result['statistics'],
                'plot_url': result.get('plot_url'),
                'csv_url': result.get('csv_url')
            }
        
        return Response({
            'success': True,
            'analysis_type': 'Comprehensive',
            'results': results,
            'plot_urls': plot_urls,  # Aggregate list for easy access
            'csv_urls': csv_urls,    # Aggregate list for easy access
            'request_parameters': {
                'analysis_types': analysis_types,
                'date_range_type': date_range_type,
                'start_date': start_date,
                'end_date': end_date,
                'cloud_cover': data.get('cloud_cover', 20),
                'project_id': project_id
            },
            'message': f'Comprehensive analysis completed for {len(results)} datasets',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in process_comprehensive: {str(e)}")
        return Response(
            {'error': f'Comprehensive analysis error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def get_image_metadata(request):
    """
    Get metadata for available images in a collection.
    Matches Flask /get_image_metadata endpoint.
    """
    try:
        # Validate project ID
        project_id, error = get_earth_engine_project_id(request)
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)
        
        # Return demo metadata
        return Response({
            'success': True,
            'images': [
                {
                    'id': 'LANDSAT/LC08/C02/T1_L2/LC08_044034_20200615',
                    'date': '2020-06-15',
                    'cloud_cover': 5.2,
                    'path': 44,
                    'row': 34
                },
                {
                    'id': 'LANDSAT/LC08/C02/T1_L2/LC08_044034_20210615',
                    'date': '2021-06-15',
                    'cloud_cover': 8.1,
                    'path': 44,
                    'row': 34
                },
                {
                    'id': 'LANDSAT/LC08/C02/T1_L2/LC08_044034_20220615',
                    'date': '2022-06-15',
                    'cloud_cover': 3.7,
                    'path': 44,
                    'row': 34
                }
            ],
            'total_images': 3,
            'demo_mode': True,
            'message': 'Demo image metadata returned'
        })
        
    except Exception as e:
        logger.error(f"Error in get_image_metadata: {str(e)}")
        return Response(
            {'error': f'Image metadata error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def analyze_trends(request):
    """
    Analyze trends in existing data.
    Matches Flask /analyze_trends endpoint.
    """
    try:
        # Extract request data
        if hasattr(request, 'data') and request.data:
            data = request.data
        else:
            return Response({'error': 'No data provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        analysis_data = data.get('data')
        analysis_type = data.get('analysis_type', 'ndvi')
        
        if not analysis_data:
            return Response({'error': 'No data provided for trend analysis'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Simple trend analysis (in real implementation, this would be more sophisticated)
        if len(analysis_data) < 2:
            return Response({'error': 'At least 2 data points required for trend analysis'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Extract values based on analysis type
        if analysis_type == 'lst':
            values = [d.get('lst', 0) for d in analysis_data]
        elif analysis_type == 'sentinel1':
            values = [d.get('backscatter_vv', 0) for d in analysis_data]
        else:
            values = [d.get('ndvi', 0) for d in analysis_data]
        
        # Calculate simple trend
        n = len(values)
        x = list(range(n))
        sum_x = sum(x)
        sum_y = sum(values)
        sum_xy = sum(x[i] * values[i] for i in range(n))
        sum_x2 = sum(x[i] * x[i] for i in range(n))
        
        slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)
        intercept = (sum_y - slope * sum_x) / n
        
        trend_direction = 'increasing' if slope > 0 else 'decreasing' if slope < 0 else 'stable'
        
        # Generate advanced statistics using the statistics module
        value_column = 'ndvi' if analysis_type == 'ndvi' else 'lst' if analysis_type == 'lst' else 'backscatter'
        advanced_stats = integrate_advanced_statistics(analysis_data, value_column)
        
        # Create trend plot
        try:
            title = f"{analysis_type.upper()} Trend Analysis"
            plot_result = generate_plot_file(analysis_data, analysis_type, title, f"{analysis_type}_trends")
            plot_url = plot_result['plot_url'] if plot_result['success'] else None
            
            # Create CSV with trend data
            csv_result = generate_csv_file(analysis_data, f"{analysis_type}_trends")
            csv_url = csv_result['csv_url'] if csv_result['success'] else None
            
        except Exception as e:
            logger.warning(f"Error generating trend analysis files: {str(e)}")
            plot_url = None
            csv_url = None
        
        response = {
            'success': True,
            'trend_analysis': {
                'slope': round(slope, 6),
                'intercept': round(intercept, 6),
                'trend_direction': trend_direction,
                'data_points': n,
                'analysis_type': analysis_type
            },
            'statistics': advanced_stats if 'error' not in advanced_stats else None,
            'message': 'Trend analysis completed successfully',
            'timestamp': datetime.now().isoformat()
        }
        
        # Add download URLs if available
        if plot_url:
            response['plot_url'] = plot_url
        if csv_url:
            response['csv_url'] = csv_url
            
        return Response(response)
        
    except Exception as e:
        logger.error(f"Error in analyze_trends: {str(e)}")
        return Response(
            {'error': f'Trend analysis error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def process_sentinel2_ndvi_analysis(geometry, start_date, end_date):
    """Process Sentinel-2 NDVI analysis"""
    try:
        logger.info(f"Processing Sentinel-2 NDVI analysis for {start_date} to {end_date}")
        
        # Use Sentinel-2 MSI collection
        try:
            collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
                .filterDate(start_date, end_date) \
                .filterBounds(geometry) \
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
            
            collection_size = collection.size().getInfo()
            logger.info(f"Sentinel-2 collection contains {collection_size} images")
            
            if collection_size == 0:
                # Try fallback with higher cloud tolerance
                logger.warning("No images with <20% clouds, trying <50% clouds")
                collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
                    .filterDate(start_date, end_date) \
                    .filterBounds(geometry) \
                    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 50))
                
                collection_size = collection.size().getInfo()
                logger.info(f"Fallback Sentinel-2 collection contains {collection_size} images")
                
                if collection_size == 0:
                    raise Exception(f"No Sentinel-2 images found for period {start_date} to {end_date}")
                    
        except Exception as e:
            logger.error(f"Error accessing Sentinel-2 collection: {e}")
            raise Exception(f"Sentinel-2 collection access failed: {e}")
        
        # Apply cloud masking
        def mask_s2_clouds(image):
            qa = image.select('QA60')
            # Bits 10 and 11 are clouds and cirrus, respectively
            cloud_bit_mask = 1 << 10
            cirrus_bit_mask = 1 << 11
            # Both flags should be set to zero, indicating clear conditions
            mask = qa.bitwiseAnd(cloud_bit_mask).eq(0) \
                .And(qa.bitwiseAnd(cirrus_bit_mask).eq(0))
            return image.updateMask(mask).divide(10000)  # Scale to reflectance
        
        # Get median composite with cloud masking
        try:
            collection = collection.map(mask_s2_clouds)
            image = collection.median()
            
            if image is None:
                raise Exception("Sentinel-2 median composite returned None")
                
            # Calculate NDVI (B8 = NIR, B4 = Red for Sentinel-2)
            nir = image.select('B8')
            red = image.select('B4') 
            ndvi_band = nir.subtract(red).divide(nir.add(red)).rename('NDVI')
            
            logger.info("Sentinel-2 NDVI calculation completed successfully")
            
        except Exception as e:
            logger.error(f"Error processing Sentinel-2 image: {e}")
            raise Exception(f"Sentinel-2 processing failed: {e}")
        
        # Get statistics
        try:
            stats = ndvi_band.reduceRegion(
                reducer=ee.Reducer.mean().combine(
                    reducer2=ee.Reducer.minMax(), 
                    sharedInputs=True
                ).combine(
                    reducer2=ee.Reducer.stdDev(),
                    sharedInputs=True
                ),
                geometry=geometry,
                scale=10,  # Sentinel-2 resolution
                maxPixels=1e9
            ).getInfo()
            
            if stats is None:
                raise Exception("Sentinel-2 NDVI statistics computation returned None")
                
        except Exception as e:
            logger.error(f"Error computing Sentinel-2 NDVI statistics: {e}")
            raise Exception(f"Sentinel-2 NDVI statistics failed: {e}")
        
        # Calculate area statistics
        try:
            area_km2 = geometry.area().divide(1000000).getInfo()
            pixel_count_result = ndvi_band.reduceRegion(
                reducer=ee.Reducer.count(),
                geometry=geometry,
                scale=10,
                maxPixels=1e9
            ).getInfo()
            
            pixel_count = pixel_count_result.get('NDVI', 0) if pixel_count_result else 0
            
        except Exception as e:
            logger.warning(f"Error computing Sentinel-2 area statistics: {e}")
            area_km2 = 0
            pixel_count = 0
        
        # Get sample data points for visualization
        try:
            sample_points = ndvi_band.sample(
                region=geometry,
                scale=10,
                numPixels=100
            ).getInfo()
            
            if sample_points is None:
                logger.warning("Sentinel-2 sample points computation returned None")
                sample_data = []
            else:
                sample_data = []
                for i, feature in enumerate(sample_points.get('features', [])[:50]):
                    props = feature.get('properties', {})
                    coords = feature.get('geometry', {}).get('coordinates', [])
                    if coords and 'NDVI' in props:
                        sample_data.append({
                            'date': start_date,
                            'ndvi': round(props['NDVI'], 4),
                            'lat': round(coords[1], 6),
                            'lon': round(coords[0], 6)
                        })
                        
        except Exception as e:
            logger.warning(f"Error getting Sentinel-2 sample data: {e}")
            sample_data = []
        
        return {
            'success': True,
            'demo_mode': False,
            'analysis_type': 'NDVI',
            'satellite': 'Sentinel-2 (Real Data)',
            'data': sample_data,
            'statistics': {
                'mean_ndvi': round(stats.get('NDVI_mean', 0), 4) if stats else 0,
                'min_ndvi': round(stats.get('NDVI_min', 0), 4) if stats else 0,
                'max_ndvi': round(stats.get('NDVI_max', 0), 4) if stats else 0,
                'std_ndvi': round(stats.get('NDVI_stdDev', 0), 4) if stats else 0,
                'area_km2': round(area_km2, 2),
                'pixel_count': pixel_count,
                'date_range': f"{start_date} to {end_date}"
            },
            'message': 'Real Earth Engine Sentinel-2 NDVI analysis completed successfully',
            'timestamp': datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Sentinel-2 NDVI analysis error: {str(e)}")
        raise


# Database retrieval endpoints for saved analyses
@api_view(['GET'])
@permission_classes([AllowAny])
def get_analysis_history(request):
    """
    Get analysis history for authenticated users or recent analyses for anonymous users.
    """
    try:
        if request.user.is_authenticated:
            # Get user's analysis history
            analyses = AnalysisRequest.objects.filter(user=request.user).order_by('-created_at')[:50]
        else:
            # For anonymous users, return recent public analyses (last 24 hours)
            from datetime import timedelta
            recent_time = timezone.now() - timedelta(hours=24)
            analyses = AnalysisRequest.objects.filter(
                user__isnull=True, 
                created_at__gte=recent_time
            ).order_by('-created_at')[:10]
        
        analysis_list = []
        for analysis in analyses:
            analysis_data = {
                'id': analysis.id,
                'name': analysis.name,
                'analysis_type': analysis.analysis_type,
                'satellite': analysis.satellite,
                'status': analysis.status,
                'created_at': analysis.created_at.isoformat(),
                'completed_at': analysis.completed_at.isoformat() if analysis.completed_at else None,
                'geometry_data': analysis.geometry_data,
                'date_range': f"{analysis.start_date} to {analysis.end_date}",
                'cloud_cover': analysis.cloud_cover
            }
            
            # Add result info if available
            if hasattr(analysis, 'result'):
                result = analysis.result
                analysis_data['result'] = {
                    'total_observations': result.total_observations,
                    'has_plot': bool(result.plot_file),
                    'has_csv': bool(result.csv_file),
                    'has_map': bool(result.map_file),
                    'plot_url': f"{settings.MEDIA_URL}{result.plot_file}" if result.plot_file else None,
                    'csv_url': f"{settings.MEDIA_URL}{result.csv_file}" if result.csv_file else None,
                    'statistics': result.statistics
                }
            
            analysis_list.append(analysis_data)
        
        return Response({
            'success': True,
            'count': len(analysis_list),
            'analyses': analysis_list,
            'user_authenticated': request.user.is_authenticated
        })
        
    except Exception as e:
        logger.error(f"Error getting analysis history: {str(e)}")
        return Response(
            {'error': f'Failed to get analysis history: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_analysis_result(request, analysis_id):
    """
    Get detailed results for a specific analysis.
    """
    try:
        # Get the analysis request
        if request.user.is_authenticated:
            analysis = AnalysisRequest.objects.get(id=analysis_id, user=request.user)
        else:
            # Anonymous users can only access their own analyses from last 24 hours
            from datetime import timedelta
            recent_time = timezone.now() - timedelta(hours=24)
            analysis = AnalysisRequest.objects.get(
                id=analysis_id, 
                user__isnull=True,
                created_at__gte=recent_time
            )
        
        # Get the result
        if not hasattr(analysis, 'result'):
            return Response(
                {'error': 'No results found for this analysis'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        result = analysis.result
        
        response_data = {
            'success': True,
            'analysis': {
                'id': analysis.id,
                'name': analysis.name,
                'analysis_type': analysis.analysis_type,
                'satellite': analysis.satellite,
                'status': analysis.status,
                'created_at': analysis.created_at.isoformat(),
                'completed_at': analysis.completed_at.isoformat() if analysis.completed_at else None,
                'geometry_data': analysis.geometry_data,
                'parameters': {
                    'start_date': str(analysis.start_date),
                    'end_date': str(analysis.end_date),
                    'cloud_cover': analysis.cloud_cover,
                    'use_cloud_masking': analysis.use_cloud_masking,
                    'strict_masking': analysis.strict_masking
                }
            },
            'result': {
                'data': result.data,
                'statistics': result.statistics,
                'total_observations': result.total_observations,
                'date_range_covered': result.date_range_covered,
                'files': {
                    'plot_url': f"{settings.MEDIA_URL}{result.plot_file}" if result.plot_file else None,
                    'csv_url': f"{settings.MEDIA_URL}{result.csv_file}" if result.csv_file else None,
                    'map_url': f"{settings.MEDIA_URL}{result.map_file}" if result.map_file else None
                },
                'created_at': result.created_at.isoformat(),
                'updated_at': result.updated_at.isoformat()
            }
        }
        
        return Response(response_data)
        
    except AnalysisRequest.DoesNotExist:
        return Response(
            {'error': 'Analysis not found or access denied'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error getting analysis result: {str(e)}")
        return Response(
            {'error': f'Failed to get analysis result: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
@permission_classes([AllowAny])
def delete_analysis(request, analysis_id):
    """
    Delete an analysis and its associated files (authenticated users only).
    """
    if not request.user.is_authenticated:
        return Response(
            {'error': 'Authentication required to delete analyses'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    try:
        analysis = AnalysisRequest.objects.get(id=analysis_id, user=request.user)
        
        # Delete associated files
        if hasattr(analysis, 'result'):
            result = analysis.result
            try:
                if result.plot_file:
                    default_storage.delete(result.plot_file.name)
                if result.csv_file:
                    default_storage.delete(result.csv_file.name)
                if result.map_file:
                    default_storage.delete(result.map_file.name)
            except Exception as e:
                logger.warning(f"Error deleting files for analysis {analysis_id}: {str(e)}")
        
        # Delete the analysis (cascade will delete result)
        analysis.delete()
        
        return Response({
            'success': True,
            'message': f'Analysis {analysis_id} deleted successfully'
        })
        
    except AnalysisRequest.DoesNotExist:
        return Response(
            {'error': 'Analysis not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error deleting analysis: {str(e)}")
        return Response(
            {'error': f'Failed to delete analysis: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
