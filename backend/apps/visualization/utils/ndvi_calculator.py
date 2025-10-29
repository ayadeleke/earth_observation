"""
NDVI (Normalized Difference Vegetation Index) calculation utilities.

This module provides functions for calculating NDVI from different satellite sources
"""

import ee
import logging

logger = logging.getLogger(__name__)


def calculate_ndvi_landsat(image, enable_cloud_masking=False, masking_strictness=False):
    """
    Calculate NDVI for Landsat image (handles different band names) with optional cloud masking
    
    Args:
        image: Earth Engine image
        enable_cloud_masking: Whether to apply cloud masking
        masking_strictness: If True, apply strict masking (more aggressive)
        
    Returns:
        ee.Image: Image with NDVI band added
    """
    # Scale factors for Landsat Collection 2 Level 2
    scale_factor = 0.0000275
    offset = -0.2
    
    # Apply scaling to all bands
    scaled = image.multiply(scale_factor).add(offset)
    
    # Get band names to determine Landsat version
    band_names = image.bandNames()
    
    # For Landsat 4-7: B3=Red, B4=NIR
    # For Landsat 8-9: B4=Red, B5=NIR
    nir = ee.Algorithms.If(
        band_names.contains('SR_B5'),  # Landsat 8-9
        scaled.select('SR_B5'),
        scaled.select('SR_B4')  # Landsat 4-7
    )
    
    red = ee.Algorithms.If(
        band_names.contains('SR_B5'),  # Landsat 8-9  
        scaled.select('SR_B4'),
        scaled.select('SR_B3')  # Landsat 4-7
    )
    
    nir = ee.Image(nir)
    red = ee.Image(red)
    
    # Calculate NDVI with proper handling of division by zero
    denominator = nir.add(red)
    ndvi = nir.subtract(red).divide(denominator).rename('NDVI')
    
    # Clamp NDVI to valid range (-1 to 1) instead of using aggressive masking
    # This ensures we always have valid values for statistics extraction
    # Use clamp() instead of updateMask() to avoid None values in statistics
    ndvi = ndvi.clamp(-1.0, 1.0)
    
    # Apply cloud masking if enabled (for visualization, not statistics)
    if enable_cloud_masking:
        try:
            qa_pixel = image.select('QA_PIXEL')
            
            if masking_strictness:
                # Strict masking: Remove clouds, cloud shadows, and dilated clouds
                # Bit values: 3=cloud, 4=cloud shadow, 1=dilated cloud
                cloud_mask = qa_pixel.bitwiseAnd(1 << 3).eq(0).And(  # Clear of clouds
                            qa_pixel.bitwiseAnd(1 << 4).eq(0)).And(  # Clear of cloud shadow
                            qa_pixel.bitwiseAnd(1 << 1).eq(0))       # Clear of dilated cloud
            else:
                # Standard masking: Remove high confidence clouds and cloud shadows
                cloud_mask = qa_pixel.bitwiseAnd(1 << 3).eq(0).And(  # Clear of clouds
                            qa_pixel.bitwiseAnd(1 << 4).eq(0))       # Clear of cloud shadow
            
            # Apply mask to NDVI for visualization only
            # Note: This can still result in all pixels masked, but we keep the clamped version for statistics
            ndvi = ndvi.updateMask(cloud_mask)
        except Exception as e:
            # If QA_PIXEL band is not available, continue without masking
            logger.warning(f"QA_PIXEL band not available for cloud masking in Landsat image: {e}")
    
    # Add date and NDVI to image
    return image.addBands(ndvi).set('system:time_start', image.get('system:time_start'))


def calculate_sentinel2_ndvi(image, enable_cloud_masking=False, masking_strictness=False):
    """
    Calculate NDVI for Sentinel-2 image with optional cloud masking
    
    Args:
        image: Earth Engine Sentinel-2 image
        enable_cloud_masking: Whether to apply cloud masking
        masking_strictness: If True, apply strict masking (more aggressive)
        
    Returns:
        ee.Image: Image with NDVI band added
    """
    # Scale factor for Sentinel-2 Surface Reflectance
    scale_factor = 0.0001  # Sentinel-2 SR is scaled by 10000
    scaled = image.multiply(scale_factor)
    
    nir = scaled.select('B8')  # Near-Infrared
    red = scaled.select('B4')  # Red
    
    # Calculate NDVI
    ndvi = nir.subtract(red).divide(nir.add(red)).rename("NDVI")
    
    # Apply cloud masking if enabled and SCL band is available
    if enable_cloud_masking:
        try:
            # Use Scene Classification Layer (SCL) for cloud masking
            scl = image.select('SCL')
            
            if masking_strictness:
                # Strict masking: Remove clouds, cloud shadows, medium/high prob clouds, and thin cirrus
                # SCL values: 3=cloud shadows, 8=medium prob clouds, 9=high prob clouds, 10=thin cirrus
                cloud_mask = scl.neq(3).And(scl.neq(8)).And(scl.neq(9)).And(scl.neq(10))
            else:
                # Standard masking: Remove high probability clouds and cloud shadows
                cloud_mask = scl.neq(9).And(scl.neq(3))  # Remove high prob clouds and shadows
            
            # Apply mask to NDVI
            ndvi = ndvi.updateMask(cloud_mask)
        except:
            # If SCL band is not available, continue without masking
            logger.warning("SCL band not available for cloud masking in Sentinel-2 image")
    
    return image.addBands(ndvi)
