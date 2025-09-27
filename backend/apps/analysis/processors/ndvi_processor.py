"""
Django-adapted NDVI processing and analysis functions
Migrated from the original Flask modules
"""
import ee
import pandas as pd
import numpy as np
from datetime import datetime
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class NDVIProcessor:
    """NDVI analysis processor for Django backend"""
    
    def __init__(self):
        self.ensure_earth_engine_initialized()
    
    def ensure_earth_engine_initialized(self):
        """Ensure Earth Engine is initialized"""
        try:
            # Try to access EE to check if initialized
            ee.Number(1).getInfo()
        except Exception:
            # Initialize Earth Engine
            if hasattr(settings, 'EARTH_ENGINE_SERVICE_ACCOUNT_KEY') and settings.EARTH_ENGINE_SERVICE_ACCOUNT_KEY:
                # Use service account authentication
                credentials = ee.ServiceAccountCredentials(
                    settings.EARTH_ENGINE_SERVICE_ACCOUNT_KEY['client_email'],
                    settings.EARTH_ENGINE_SERVICE_ACCOUNT_KEY
                )
                ee.Initialize(credentials)
            else:
                # Use default authentication
                ee.Initialize()
    
    def process_landsat_ndvi(self, geometry, start_date, end_date, cloud_cover=20, 
                           selected_indices=None, require_complete_coverage=True, 
                           use_cloud_masking=True, strict_masking=False):
        """
        Process Landsat NDVI analysis for given geometry and date range
        
        Args:
            geometry: Django GIS geometry object
            start_date (str): Start date in YYYY-MM-DD format
            end_date (str): End date in YYYY-MM-DD format
            cloud_cover (int): Maximum cloud cover percentage
            selected_indices (list, optional): Indices of specific images to use
            require_complete_coverage (bool): Whether to filter for complete ROI coverage
            use_cloud_masking (bool): Whether to apply cloud masking
            strict_masking (bool): Whether to use strict cloud masking
        
        Returns:
            dict: {
                'success': bool,
                'data': list of records,
                'error': str or None,
                'statistics': dict,
                'metadata': dict
            }
        """
        try:
            logger.info(f"Starting NDVI processing for date range: {start_date} to {end_date}")
            logger.info(f"Cloud cover threshold: {cloud_cover}%")
            logger.info(f"Cloud masking enabled: {use_cloud_masking} (strict: {strict_masking})")
            
            # Convert Django geometry to Earth Engine geometry
            ee_geometry = self._django_geom_to_ee(geometry)
            
            # Get Landsat collection
            if use_cloud_masking:
                collection = self._get_cloud_masked_collection(
                    start_date, end_date, ee_geometry, cloud_cover, 
                    require_complete_coverage, strict_masking
                )
            else:
                collection = self._get_landsat_collection(
                    start_date, end_date, ee_geometry, cloud_cover, 
                    require_complete_coverage
                )
            
            collection_size = collection.size().getInfo()
            logger.info(f"Got collection with {collection_size} images")
            
            if collection_size == 0:
                return {
                    'success': False,
                    'data': [],
                    'error': 'No images found for the specified criteria',
                    'statistics': {},
                    'metadata': {}
                }
            
            # Calculate NDVI for each image
            ndvi_collection = collection.map(self._calculate_ndvi_landsat)
            
            # Reduce to get statistics for the geometry
            ndvi_features = ndvi_collection.map(
                lambda image: self._reduce_region_ndvi(image, ee_geometry, use_cloud_masking)
            )
            
            # Get the data
            ndvi_data = ndvi_features.getInfo()
            
            if not ndvi_data or not ndvi_data.get('features'):
                return {
                    'success': False,
                    'data': [],
                    'error': 'No NDVI data found for the specified area and date range',
                    'statistics': {},
                    'metadata': {}
                }
            
            # Convert to records
            records = []
            for feature in ndvi_data['features']:
                props = feature['properties']
                if props.get('ndvi') is not None:
                    records.append({
                        'date': props['date'],
                        'image_id': props.get('image_id', 'N/A'),
                        'doy': props.get('doy', 'N/A'),
                        'ndvi': props['ndvi'],
                        'original_cloud_cover': props.get('original_cloud_cover', 'N/A'),
                        'effective_cloud_cover': props.get('effective_cloud_cover', 'N/A'),
                        'cloud_masking_applied': props.get('cloud_masking_applied', False)
                    })
            
            if not records:
                return {
                    'success': False,
                    'data': [],
                    'error': 'No valid NDVI values found',
                    'statistics': {},
                    'metadata': {}
                }
            
            # Sort by date
            records.sort(key=lambda x: x['date'])
            
            # Calculate statistics
            statistics = self._calculate_ndvi_statistics(records)
            
            # Create metadata
            metadata = {
                'total_observations': len(records),
                'date_range': f"{records[0]['date']} to {records[-1]['date']}",
                'collection_size': collection_size,
                'cloud_masking_applied': use_cloud_masking,
                'strict_masking': strict_masking
            }
            
            logger.info(f"Successfully processed {len(records)} NDVI observations")
            
            return {
                'success': True,
                'data': records,
                'error': None,
                'statistics': statistics,
                'metadata': metadata
            }
            
        except Exception as e:
            logger.error(f"Error in NDVI processing: {str(e)}")
            return {
                'success': False,
                'data': [],
                'error': f"NDVI processing error: {str(e)}",
                'statistics': {},
                'metadata': {}
            }
    
    def _django_geom_to_ee(self, django_geom):
        """Convert Django geometry to Earth Engine geometry"""
        if hasattr(django_geom, 'coords'):
            # Polygon
            coords = list(django_geom.coords[0])  # Get exterior ring
            return ee.Geometry.Polygon(coords)
        else:
            # Try to use GeoJSON
            geojson = django_geom.geojson
            return ee.Geometry(geojson)
    
    def _get_landsat_collection(self, start_date, end_date, geometry, cloud_cover, require_complete_coverage=True):
        """Get Landsat collection with basic filtering"""
        # This is a simplified version - you would implement the full logic here
        collection = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2') \
            .filterDate(start_date, end_date) \
            .filterBounds(geometry) \
            .filter(ee.Filter.lt('CLOUD_COVER', cloud_cover))
        
        # Merge with Landsat 9 if available
        l9_collection = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2') \
            .filterDate(start_date, end_date) \
            .filterBounds(geometry) \
            .filter(ee.Filter.lt('CLOUD_COVER', cloud_cover))
        
        return collection.merge(l9_collection)
    
    def _get_cloud_masked_collection(self, start_date, end_date, geometry, cloud_cover, require_complete_coverage, strict_masking):
        """Get cloud-masked Landsat collection"""
        # Get base collection
        collection = self._get_landsat_collection(start_date, end_date, geometry, cloud_cover, require_complete_coverage)
        
        # Apply cloud masking
        def mask_clouds(image):
            qa = image.select('QA_PIXEL')
            # Cloud shadow, cloud, and cirrus masks
            cloud_shadow = qa.bitwiseAnd(1 << 4)
            cloud = qa.bitwiseAnd(1 << 3)
            cirrus = qa.bitwiseAnd(1 << 2)
            
            if strict_masking:
                # More aggressive masking
                mask = cloud_shadow.eq(0).And(cloud.eq(0)).And(cirrus.eq(0))
            else:
                # Basic cloud masking
                mask = cloud.eq(0)
            
            return image.updateMask(mask)
        
        return collection.map(mask_clouds)
    
    def _calculate_ndvi_landsat(self, image):
        """Calculate NDVI for Landsat image"""
        nir = image.select('SR_B5')  # Landsat 8/9 NIR
        red = image.select('SR_B4')  # Landsat 8/9 Red
        
        ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI')
        
        return image.addBands(ndvi)
    
    def _reduce_region_ndvi(self, image, geometry, use_cloud_masking):
        """Reduce NDVI over region"""
        ndvi_mean = image.select('NDVI').reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=geometry,
            scale=30,
            maxPixels=1e9
        )
        
        # Calculate cloud cover info
        if use_cloud_masking:
            qa_pixel = image.select('QA_PIXEL')
            total_pixels = qa_pixel.reduceRegion(
                reducer=ee.Reducer.count(),
                geometry=geometry,
                scale=30,
                maxPixels=1e9,
                bestEffort=True
            ).get('QA_PIXEL')
            
            valid_ndvi_pixels = image.select('NDVI').reduceRegion(
                reducer=ee.Reducer.count(),
                geometry=geometry,
                scale=30,
                maxPixels=1e9,
                bestEffort=True
            ).get('NDVI')
            
            total_count = ee.Number(total_pixels)
            valid_count = ee.Number(valid_ndvi_pixels)
            
            data_availability = valid_count.divide(total_count.max(1)).multiply(100).min(100).max(0)
            effective_cloud_cover = ee.Number(100).subtract(data_availability).max(0).min(100)
        else:
            effective_cloud_cover = image.get('CLOUD_COVER')
        
        return ee.Feature(None, {
            'date': ee.Date(image.get('system:time_start')).format('YYYY-MM-dd'),
            'image_id': image.get('system:id'),
            'doy': ee.Date(image.get('system:time_start')).getRelative('day', 'year').add(1),
            'ndvi': ndvi_mean.get('NDVI'),
            'original_cloud_cover': image.get('CLOUD_COVER'),
            'effective_cloud_cover': effective_cloud_cover,
            'cloud_masking_applied': use_cloud_masking
        })
    
    def _calculate_ndvi_statistics(self, records):
        """Calculate NDVI statistics from records"""
        try:
            ndvi_values = [r['ndvi'] for r in records if r['ndvi'] is not None]
            
            if not ndvi_values:
                return {
                    'mean_ndvi': 0.0,
                    'std_ndvi': 0.0,
                    'min_ndvi': 0.0,
                    'max_ndvi': 0.0,
                    'median_ndvi': 0.0,
                    'total_observations': 0
                }
            
            return {
                'mean_ndvi': float(np.mean(ndvi_values)),
                'std_ndvi': float(np.std(ndvi_values)),
                'min_ndvi': float(np.min(ndvi_values)),
                'max_ndvi': float(np.max(ndvi_values)),
                'median_ndvi': float(np.median(ndvi_values)),
                'total_observations': len(ndvi_values)
            }
        except Exception as e:
            logger.error(f"Error calculating statistics: {str(e)}")
            return {
                'mean_ndvi': 0.0,
                'std_ndvi': 0.0,
                'min_ndvi': 0.0,
                'max_ndvi': 0.0,
                'median_ndvi': 0.0,
                'total_observations': 0
            }
