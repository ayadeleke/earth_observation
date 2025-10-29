"""
LST (Land Surface Temperature) calculation utilities.

This module provides functions for calculating LST from Landsat satellites:
- Landsat 5/7 (thermal band ST_B6)
- Landsat 8/9 (thermal band ST_B10)
"""

import ee
import logging

logger = logging.getLogger(__name__)


def calculate_lst_landsat(image, enable_cloud_masking=False, masking_strictness=False):
    """
    Calculate Land Surface Temperature for Landsat image with optional cloud masking
    Handles Landsat 5/7 (ST_B6) and Landsat 8/9 (ST_B10) thermal bands
    
    Args:
        image: Earth Engine image with thermal bands
        enable_cloud_masking: Whether to apply cloud masking
        masking_strictness: If True, apply strict masking (more aggressive)
        
    Returns:
        ee.Image: Image with LST band added  
    """
    # Get band names to determine which thermal band is available
    band_names = image.bandNames()
    
    # Check thermal band availability:
    # Landsat 8/9: ST_B10
    # Landsat 5/7: ST_B6
    has_st_b10 = band_names.contains('ST_B10')
    has_st_b6 = band_names.contains('ST_B6')
    
    # Select the appropriate thermal band
    st_band = ee.Algorithms.If(
        has_st_b10,
        image.select('ST_B10'),  # Landsat 8/9
        ee.Algorithms.If(
            has_st_b6,
            image.select('ST_B6'),   # Landsat 5/7
            None  # No thermal band available
        )
    )
    
    st_band = ee.Image(st_band)
    
    # Apply scale factor and offset, then convert to Celsius
    # Scale factor: 0.00341802, Offset: 149.0 (from Landsat Collection 2 docs)
    lst_celsius = st_band.multiply(0.00341802).add(149.0).subtract(273.15)
    
    # Apply cloud masking if enabled
    if enable_cloud_masking:
        try:
            qa_pixel = image.select('QA_PIXEL')
            
            if masking_strictness:
                # Strict masking: Remove clouds, cloud shadows, and dilated clouds
                cloud_mask = qa_pixel.bitwiseAnd(1 << 3).eq(0).And(  # Clear of clouds
                            qa_pixel.bitwiseAnd(1 << 4).eq(0)).And(  # Clear of cloud shadow
                            qa_pixel.bitwiseAnd(1 << 1).eq(0))       # Clear of dilated cloud
            else:
                # Standard masking: Remove high confidence clouds and cloud shadows
                cloud_mask = qa_pixel.bitwiseAnd(1 << 3).eq(0).And(  # Clear of clouds
                            qa_pixel.bitwiseAnd(1 << 4).eq(0))       # Clear of cloud shadow
            
            # Apply mask to LST
            lst_celsius = lst_celsius.updateMask(cloud_mask)
        except Exception as e:
            # If QA_PIXEL band is not available, continue without masking
            logger.warning(f"QA_PIXEL band not available for cloud masking in LST image: {e}")
    
    # Rename and return
    return image.addBands(lst_celsius.rename('LST'))
