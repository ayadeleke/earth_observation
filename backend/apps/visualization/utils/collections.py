
import ee
import logging

logger = logging.getLogger(__name__)


def filter_for_complete_coverage(collection, geometry, is_sentinel1=False):
    """
    Filter collection to only include images that completely cover the ROI
    
    Args:
        collection: Earth Engine ImageCollection
        geometry: Earth Engine geometry object (ROI)
        is_sentinel1: If True, use more lenient coverage threshold for SAR
        
    Returns:
        ee.ImageCollection: Filtered collection with complete coverage
    """
    try:
        logger.info("Filtering for complete ROI coverage...")
        
        def check_coverage(image):
            # Get the image footprint
            footprint = image.geometry()
            
            # Check if the image footprint completely contains the ROI
            # This means the ROI is entirely within the image bounds
            roi_covered = footprint.contains(geometry, ee.ErrorMargin(1))  # 1 meter tolerance
            
            # Also check intersection area to ensure good coverage
            intersection = footprint.intersection(geometry, ee.ErrorMargin(1))
            intersection_area = intersection.area()
            roi_area = geometry.area()
            
            # Coverage percentage (should be close to 100% for complete coverage)
            coverage_percent = intersection_area.divide(roi_area).multiply(100)
            
            # Set properties for debugging
            return image.set({
                'roi_covered': roi_covered,
                'coverage_percent': coverage_percent,
                'intersection_area': intersection_area,
                'roi_area': roi_area
            })
        
        # Add coverage properties to all images
        collection_with_coverage = collection.map(check_coverage)
        
        # Filter for images based on coverage criteria
        coverage_threshold = 90 if is_sentinel1 else 99
        complete_coverage = collection_with_coverage.filter(
            ee.Filter.And(
                ee.Filter.eq('roi_covered', True),
                ee.Filter.gte('coverage_percent', coverage_threshold)
            )
        )
        
        return complete_coverage
    
    except Exception as e:
        logger.error(f"Error in coverage filtering: {str(e)}")
        return collection  # Return original collection if filtering fails


def get_landsat_collection(geometry, start_date, end_date, cloud_cover):
    """
    Get Landsat collection for the specified parameters with complete ROI coverage
    
    Args:
        geometry: Earth Engine geometry for the area of interest
        start_date: Start date (YYYY-MM-DD format)
        end_date: End date (YYYY-MM-DD format)
        cloud_cover: Maximum cloud cover percentage
        
    Returns:
        ee.ImageCollection: Filtered and sorted Landsat collection
    """
    try:
        start_year = int(start_date.split("-")[0])
        end_year = int(end_date.split("-")[0])
        collections = []
        
        # Log the search parameters
        logger.info(
            f"Searching for Landsat images: {start_date} to {end_date}, "
            f"cloud cover <= {cloud_cover}%"
        )
        logger.info(f"Area of interest bounds: {geometry.bounds().getInfo()}")
        
        # Convert cloud_cover to float and ensure it's a valid number
        try:
            cloud_cover = float(cloud_cover)
        except (TypeError, ValueError):
            cloud_cover = 20.0
        
        # Add available Landsat collections based on date range
        if end_year >= 2021:
            # Try Landsat 9 first (newest)
            l9 = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2") \
                .filterDate(start_date, end_date) \
                .filterBounds(geometry) \
                .filter(ee.Filter.lt("CLOUD_COVER", ee.Number(cloud_cover)))
            collections.append(l9)
            logger.info("Added Landsat 9 collection")
        
        if end_year >= 2013:
            # Then Landsat 8
            l8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2") \
                .filterDate(start_date, end_date) \
                .filterBounds(geometry) \
                .filter(ee.Filter.lt("CLOUD_COVER", ee.Number(cloud_cover)))
            collections.append(l8)
            logger.info("Added Landsat 8 collection")
        
        if start_year <= 2013 or end_year >= 1999:
            # Then Landsat 7
            l7 = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2") \
                .filterDate(start_date, end_date) \
                .filterBounds(geometry) \
                .filter(ee.Filter.lt("CLOUD_COVER", ee.Number(cloud_cover)))
            collections.append(l7)
            logger.info("Added Landsat 7 collection")
        
        if start_year <= 2013:
            # Finally Landsat 5
            l5 = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2") \
                .filterDate(start_date, end_date) \
                .filterBounds(geometry) \
                .filter(ee.Filter.lt("CLOUD_COVER", ee.Number(cloud_cover)))
            collections.append(l5)
            logger.info("Added Landsat 5 collection")

        if not collections:
            raise ValueError(
                f"No Landsat collections available for date range: "
                f"{start_date} to {end_date}"
            )

        # Merge collections
        collection = collections[0]
        for coll in collections[1:]:
            collection = collection.merge(coll)
        
        # Get initial count
        total_images = collection.size().getInfo()
        logger.info(f"Total images found: {total_images}")
        
        if total_images == 0:
            raise ValueError(
                f"No images found with {cloud_cover}% cloud cover threshold. "
                f"Try increasing the cloud cover threshold."
            )
        
        # Sort by quality metrics
        collection = collection.sort('CLOUD_COVER').sort('system:time_start')
        
        # Apply coverage filtering but with a fallback
        try:
            filtered_collection = filter_for_complete_coverage(collection, geometry)
            filtered_count = filtered_collection.size().getInfo()
            logger.info(f"Images after coverage filtering: {filtered_count}")
            
            if filtered_count == 0:
                logger.warning("No images with complete coverage, using partial coverage")
                return collection  # Return unfiltered collection as fallback
            return filtered_collection
        except Exception as e:
            logger.warning(f"Coverage filtering failed: {e}, using unfiltered collection")
            return collection
            
    except Exception as e:
        logger.error(f"Error in get_landsat_collection: {e}")
        raise


def get_sentinel2_collection(geometry, start_date, end_date, cloud_cover):
    """
    Get Sentinel-2 collection for the specified parameters with complete ROI coverage
    
    Args:
        geometry: Earth Engine geometry for the area of interest
        start_date: Start date (YYYY-MM-DD format)
        end_date: End date (YYYY-MM-DD format)
        cloud_cover: Maximum cloud cover percentage
        
    Returns:
        ee.ImageCollection: Filtered and sorted Sentinel-2 collection
    """
    # Use Harmonized Sentinel-2 collection
    logger.info("Using Harmonized Sentinel-2 collection")
    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterDate(start_date, end_date)
        .filterBounds(geometry)
    )
    
    logger.info(f"Total Sentinel-2 images after initial filtering: {collection.size().getInfo()}")
    
    # Filter by quality metrics
    collection = collection.filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", cloud_cover))\
        .filter(ee.Filter.lt("NODATA_PIXEL_PERCENTAGE", 10))
    
    logger.info(f"Sentinel-2 images after cloud and quality filtering: {collection.size().getInfo()}")
    
    # Sort by cloud coverage and acquisition time to get best quality images
    collection = collection.sort('CLOUDY_PIXEL_PERCENTAGE').sort('system:time_start')
    
    # Apply complete coverage filtering
    filtered_collection = filter_for_complete_coverage(collection, geometry)
    logger.info(f"Sentinel-2 images after coverage filtering: {filtered_collection.size().getInfo()}")
    
    return filtered_collection


def get_sentinel1_collection(geometry, start_date, end_date, orbit_direction='BOTH'):
    """
    Get Sentinel-1 collection for the specified parameters with flexible coverage
    
    Args:
        geometry: Earth Engine geometry for the area of interest
        start_date: Start date (YYYY-MM-DD format)
        end_date: End date (YYYY-MM-DD format)
        orbit_direction: Orbit direction ('BOTH', 'ASCENDING', or 'DESCENDING')
        
    Returns:
        ee.ImageCollection: Filtered Sentinel-1 SAR collection
    """
    collection = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterDate(start_date, end_date)
        .filterBounds(geometry)
        .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
        .filterMetadata('resolution_meters', 'equals', 10)
        .filter(ee.Filter.eq('instrumentMode', 'IW'))
    )
    
    # Filter by orbit direction if specified
    if orbit_direction != 'BOTH':
        logger.info(f"Filtering Sentinel-1 collection by orbit direction: {orbit_direction}")
        collection = collection.filter(ee.Filter.eq('orbitProperties_pass', orbit_direction))
    else:
        logger.info("Including both ASCENDING and DESCENDING orbits")
        # Include both ASCENDING and DESCENDING for more images
        collection = collection.filter(
            ee.Filter.inList('orbitProperties_pass', ['ASCENDING', 'DESCENDING'])
        )
    
    logger.info(f"Total Sentinel-1 images before coverage filtering: {collection.size().getInfo()}")
    
    try:
        # Apply more lenient coverage filtering for Sentinel-1
        def check_coverage_s1(image):
            footprint = image.geometry()
            # 10m tolerance for SAR
            intersection = footprint.intersection(geometry, ee.ErrorMargin(10))
            intersection_area = intersection.area()
            roi_area = geometry.area()
            coverage_percent = intersection_area.divide(roi_area).multiply(100)
            return image.set('coverage_percent', coverage_percent)
        
        # Add coverage info to images
        collection_with_coverage = collection.map(check_coverage_s1)
        
        # Filter for images with at least 85% coverage (more lenient for SAR)
        filtered_collection = collection_with_coverage.filter(
            ee.Filter.gte('coverage_percent', 85)
        )
        filtered_count = filtered_collection.size().getInfo()
        logger.info(f"Sentinel-1 images after coverage filtering: {filtered_count}")
        
        if filtered_count == 0:
            logger.warning("No images with sufficient coverage, using unfiltered collection")
            return collection
        return filtered_collection
    except Exception as e:
        logger.warning(
            f"Coverage filtering failed for Sentinel-1: {e}, "
            f"using unfiltered collection"
        )
        return collection
