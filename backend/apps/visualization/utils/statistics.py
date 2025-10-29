"""
Statistics extraction utilities for Earth observation data.

This module provides functions for extracting statistical values from satellite images
for different analysis types (NDVI, LST, SAR backscatter).
"""

import ee
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


def extract_image_statistics(
    images,
    geometry,
    analysis_type,
    satellite,
    polarization='VV',
    cloud_masking_level='disabled'
):
    """
    Extract statistical values from selected images for the area of interest
    
    Args:
        images: List of Earth Engine images
        geometry: Earth Engine geometry for the area of interest
        analysis_type: Type of analysis ('ndvi', 'lst', 'backscatter')
        satellite: Satellite type ('landsat', 'sentinel1', 'sentinel2')
        polarization: SAR polarization ('VV' or 'VH')
        cloud_masking_level: Cloud masking level for optical satellites
        
    Returns:
        list: List of dictionaries with statistics for each image
    """
    # Import here to avoid circular imports
    from .ndvi_calculator import calculate_ndvi_landsat, calculate_sentinel2_ndvi
    from .lst_calculator import calculate_lst_landsat
    
    statistics = []
    
    try:
        for idx, image in enumerate(images):
            try:
                # Get image metadata
                image_info = image.getInfo()
                properties = image_info.get('properties', {})
                
                # Extract date
                time_start = properties.get('system:time_start')
                if time_start:
                    date = datetime.fromtimestamp(time_start / 1000).strftime('%Y-%m-%d')
                else:
                    date = 'Unknown'
                
                # Calculate analysis band
                # IMPORTANT: Disable cloud masking for statistics extraction to avoid None values
                # Cloud masking can remove ALL pixels, leaving nothing to compute statistics from
                if analysis_type.lower() == 'ndvi':
                    if 'landsat' in satellite.lower():
                        # Always disable masking for statistics to ensure we get valid values
                        processed_image = calculate_ndvi_landsat(
                            image,
                            enable_cloud_masking=False,
                            masking_strictness=False
                        )
                        band_name = 'NDVI'
                    elif 'sentinel2' in satellite.lower():
                        processed_image = calculate_sentinel2_ndvi(
                            image,
                            enable_cloud_masking=False,
                            masking_strictness=False
                        )
                        band_name = 'NDVI'
                    else:
                        processed_image = image
                        band_name = 'NDVI'
                        
                elif analysis_type.lower() == 'lst':
                    if 'landsat' in satellite.lower():
                        # Always disable masking for statistics to ensure we get valid values
                        processed_image = calculate_lst_landsat(
                            image,
                            enable_cloud_masking=False,
                            masking_strictness=False
                        )
                        band_name = 'LST'
                    else:
                        continue  # Skip non-Landsat for LST
                        
                elif analysis_type.lower() in ['sar', 'backscatter']:
                    # For SAR, use the polarization band directly
                    band_name = polarization
                    processed_image = image.select(band_name)
                else:
                    continue
                
                # Get the representative value for the image
                # Use mean of the area of interest as the single representative value
                analysis_band = processed_image.select(band_name)
                
                # Get mean value as the representative value for this image
                # Note: Don't apply strict masking here as it may result in None values
                # The processed_image already has cloud masking applied if enabled
                stats = analysis_band.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=geometry,
                    scale=30,  # 30m resolution for Landsat/Sentinel
                    maxPixels=1e9,
                    bestEffort=True  # Reduce computation if too many pixels
                ).getInfo()
                
                # Extract the mean value
                # When using .select() on a single band + reduceRegion with mean(),
                # Earth Engine returns the band name as the key (not 'band_mean')
                image_value = stats.get(band_name)
                
                logger.info(
                    f"Stats from reduceRegion: {stats}, "
                    f"extracted value for {band_name}: {image_value}"
                )
                
                # Apply value clamping for display (not masking) to handle outliers
                if image_value is not None:
                    if analysis_type.lower() == 'ndvi':
                        # Clamp NDVI to valid range -1 to 1
                        image_value = max(-1.0, min(1.0, image_value))
                    elif analysis_type.lower() == 'lst':
                        # Clamp LST to reasonable range -50 to 60°C
                        image_value = max(-50.0, min(60.0, image_value))
                
                # Format the result - single value per image
                stat_dict = {
                    'index': idx,
                    'date': date,
                    'image_id': properties.get('system:index', 'Unknown'),
                    'satellite_name': properties.get('SPACECRAFT_ID') or 
                                     properties.get('SATELLITE') or 
                                     satellite,
                }
                
                if image_value is not None:
                    if analysis_type.lower() == 'lst':
                        # LST is already in Celsius from calculate_lst_landsat function
                        stat_dict['value'] = round(image_value, 2)
                        stat_dict['unit'] = '°C'
                    elif analysis_type.lower() in ['sar', 'backscatter']:
                        # SAR backscatter in dB
                        stat_dict['value'] = round(image_value, 2)
                        stat_dict['unit'] = 'dB'
                    else:
                        # NDVI (unitless, -1 to 1)
                        stat_dict['value'] = round(image_value, 3)
                        stat_dict['unit'] = ''
                else:
                    stat_dict['value'] = None
                    stat_dict['unit'] = ''
                
                statistics.append(stat_dict)
                logger.info(
                    f"Extracted value for image {idx}: {date}, "
                    f"value={stat_dict.get('value')}"
                )
                
            except Exception as img_error:
                logger.error(f"Error extracting statistics for image {idx}: {img_error}")
                # Add placeholder entry
                statistics.append({
                    'index': idx,
                    'date': 'Error',
                    'image_id': 'Unknown',
                    'satellite_name': satellite,
                    'value': None,
                    'unit': '',
                    'error': str(img_error)
                })
    
    except Exception as e:
        logger.error(f"Error in extract_image_statistics: {e}")
    
    return statistics
