"""
Earth Engine utilities for Earth observation analysis.
Handles Earth Engine geometry operations and data collection.
"""

import json
import logging
import ee
from datetime import datetime
from apps.earth_engine.ee_config import initialize_earth_engine

logger = logging.getLogger(__name__)


def wkt_to_ee_geometry(wkt_string):
    """Convert WKT string to Earth Engine geometry object"""
    try:
        # Ensure Earth Engine is initialized
        if not initialize_earth_engine():
            raise ValueError("Earth Engine initialization failed")
            
        if wkt_string.startswith("POLYGON"):
            # Extract coordinates from WKT POLYGON((x y, x y, ...))
            coords_str = wkt_string.replace("POLYGON((", "").replace("))", "")
            coord_pairs = coords_str.split(", ")
            coordinates = []
            
            for pair in coord_pairs:
                lon, lat = pair.split(" ")
                coordinates.append([float(lon), float(lat)])
            
            # Create Earth Engine polygon
            return ee.Geometry.Polygon([coordinates])
        elif wkt_string.startswith("POINT"):
            # Extract coordinates from WKT POINT(x y)
            coords_str = wkt_string.replace("POINT(", "").replace(")", "")
            lon, lat = coords_str.split(" ")
            return ee.Geometry.Point([float(lon), float(lat)])
        else:
            raise ValueError(f"Unsupported WKT geometry type: {wkt_string[:20]}...")
    except Exception as e:
        logger.error(f"Error converting WKT to EE geometry: {str(e)}")
        raise ValueError(f"Invalid WKT format: {str(e)}")


def geojson_to_ee_geometry(geojson_data):
    """Convert GeoJSON data to Earth Engine geometry object"""
    try:
        # Ensure Earth Engine is initialized
        if not initialize_earth_engine():
            raise ValueError("Earth Engine initialization failed")
            
        if isinstance(geojson_data, str):
            geojson_data = json.loads(geojson_data)
            
        # Handle different GeoJSON structures
        if 'features' in geojson_data:
            # FeatureCollection
            if not geojson_data['features']:
                raise ValueError("No features in GeoJSON")
            # Use first feature's geometry
            geometry = geojson_data['features'][0]['geometry']
        elif 'geometry' in geojson_data:
            # Feature
            geometry = geojson_data['geometry']
        elif 'type' in geojson_data and 'coordinates' in geojson_data:
            # Direct geometry
            geometry = geojson_data
        else:
            raise ValueError("Invalid GeoJSON structure")
            
        return ee.Geometry(geometry)
        
    except Exception as e:
        logger.error(f"Error converting GeoJSON to EE geometry: {str(e)}")
        raise ValueError(f"Invalid GeoJSON format: {str(e)}")


def validate_coordinates(coordinates_data):
    """Validate coordinate data and convert to Earth Engine geometry if needed"""
    try:
        if not coordinates_data:
            return False, "Coordinates are required"

        # Handle different coordinate formats
        if isinstance(coordinates_data, str):
            if coordinates_data.startswith("POLYGON") or coordinates_data.startswith("POINT"):
                # WKT format - convert to Earth Engine geometry
                try:
                    ee_geometry = wkt_to_ee_geometry(coordinates_data)
                    return True, None
                except ValueError as e:
                    return False, str(e)
            else:
                try:
                    coordinates_data = json.loads(coordinates_data)
                except json.JSONDecodeError:
                    return False, "Invalid coordinate format"

        if isinstance(coordinates_data, list):
            # List of coordinate pairs - convert to Earth Engine polygon
            if len(coordinates_data) < 3:
                return False, "At least 3 coordinate pairs required for polygon"
            try:
                # Ensure Earth Engine is initialized
                if not initialize_earth_engine():
                    raise ValueError("Earth Engine initialization failed")
                    
                # Assume [[lon, lat], [lon, lat], ...] format
                ee_geometry = ee.Geometry.Polygon([coordinates_data])
                return True, None
            except Exception as e:
                return False, f"Error creating geometry: {str(e)}"

        return False, "Invalid coordinate format"
        
    except Exception as e:
        logger.error(f"Coordinate validation error: {str(e)}")
        return False, f"Validation error: {str(e)}"


def validate_image_coverage(image, geometry, min_coverage_percent=70):
    """
    Validate that an image has sufficient coverage of the AOI.
    
    Args:
        image: Earth Engine image
        geometry: AOI geometry
        min_coverage_percent: Minimum coverage percentage required
    
    Returns:
        bool: True if image has sufficient coverage
    """
    try:
        # Get the image footprint
        image_geometry = image.geometry()
        
        # Calculate intersection between image and AOI
        intersection = geometry.intersection(image_geometry, ee.ErrorMargin(1))
        
        # Calculate coverage percentage
        aoi_area = geometry.area(ee.ErrorMargin(1))
        intersection_area = intersection.area(ee.ErrorMargin(1))
        coverage_percent = intersection_area.divide(aoi_area).multiply(100)
        
        # Check if coverage meets minimum requirement
        return coverage_percent.gte(min_coverage_percent)
    except Exception as e:
        logger.warning(f"Coverage validation failed: {str(e)}")
        return ee.Number(1)  # Default to include image if validation fails


def get_landsat_collection(geometry, start_date, end_date, cloud_cover=20):
    """
    Get a consistent Landsat collection for use across multiple analysis types.
    Supports Landsat 5, 7, 8, and 9 missions based on date range.
    """
    try:
        # Ensure Earth Engine is initialized
        if not initialize_earth_engine():
            raise ValueError("Earth Engine initialization failed")
            
        start_year = int(start_date.split("-")[0])
        end_year = int(end_date.split("-")[0])
        collections = []

        # Landsat 5 (1984-2013)
        if start_year <= 2013:
            l5_end = min(end_year, 2013)
            if start_year <= l5_end:
                l5 = (
                    ee.ImageCollection("LANDSAT/LT05/C02/T1_L2")
                    .filterDate(start_date, end_date)
                    .filterBounds(geometry)
                    .filter(ee.Filter.lt("CLOUD_COVER", cloud_cover))
                )
                collections.append(l5)
                logger.info(f"Added Landsat 5 collection for years {start_year}-{l5_end}")

        # Landsat 7 (1999-present)
        if end_year >= 1999:
            l7_start = max(start_year, 1999)
            l7 = (
                ee.ImageCollection("LANDSAT/LE07/C02/T1_L2")
                .filterDate(start_date, end_date)
                .filterBounds(geometry)
                .filter(ee.Filter.lt("CLOUD_COVER", cloud_cover))
            )
            collections.append(l7)
            logger.info(f"Added Landsat 7 collection for years {l7_start}-{end_year}")

        # Landsat 8 (2013-present)
        if end_year >= 2013:
            l8_start = max(start_year, 2013)
            l8 = (
                ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
                .filterDate(start_date, end_date)
                .filterBounds(geometry)
                .filter(ee.Filter.lt("CLOUD_COVER", cloud_cover))
            )
            collections.append(l8)
            logger.info(f"Added Landsat 8 collection for years {l8_start}-{end_year}")

        # Landsat 9 (2021-present)
        if end_year >= 2021:
            l9_start = max(start_year, 2021)
            l9 = (
                ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
                .filterDate(start_date, end_date)
                .filterBounds(geometry)
                .filter(ee.Filter.lt("CLOUD_COVER", cloud_cover))
            )
            collections.append(l9)
            logger.info(f"Added Landsat 9 collection for years {l9_start}-{end_year}")

        if not collections:
            raise Exception(f"No Landsat data available for the specified date range: {start_date} to {end_date}")

        # Merge collections
        collection = collections[0]
        for i in range(1, len(collections)):
            collection = collection.merge(collections[i])

        collection_size = collection.size().getInfo()
        logger.info(f"Landsat collection contains {collection_size} images")
        
        # Apply band harmonization to ensure compatibility across different Landsat missions
        collection = harmonize_landsat_bands(collection, analysis_type='ndvi')
        logger.info("Applied NDVI band harmonization to mixed Landsat collection")
        
        # Add coverage validation to filter images with good AOI coverage
        def add_coverage_property(image):
            coverage_valid = validate_image_coverage(image, geometry, 90)  # 90% minimum coverage
            return image.set('aoi_coverage_valid', coverage_valid)
        
        collection_with_coverage = collection.map(add_coverage_property)
        well_covered_collection = collection_with_coverage.filter(ee.Filter.eq('aoi_coverage_valid', 1))
        
        well_covered_count = well_covered_collection.size().getInfo()
        logger.info(f"Found {well_covered_count} images with good AOI coverage (≥90%)")
        
        # Use well-covered images if available, otherwise fall back to all images
        if well_covered_count > 0:
            final_collection = well_covered_collection
            logger.info("Using well-covered images for analysis")
        else:
            final_collection = collection
            logger.warning("No well-covered images found, using all available images")
        
        if final_collection.size().getInfo() == 0:
            raise Exception("No suitable Landsat images found")

        return final_collection
    except Exception as e:
        logger.error(f"Error creating Landsat collection: {str(e)}")
        raise


def get_sentinel2_collection(geometry, start_date, end_date, cloud_cover=20):
    """
    Get Sentinel-2 collection for analysis.
    """
    try:
        # Ensure Earth Engine is initialized
        if not initialize_earth_engine():
            raise ValueError("Earth Engine initialization failed")
            
        collection = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterDate(start_date, end_date)
            .filterBounds(geometry)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", cloud_cover))
        )

        collection_size = collection.size().getInfo()
        logger.info(f"Sentinel-2 collection contains {collection_size} images")
        
        if collection_size == 0:
            raise Exception("No suitable Sentinel-2 images found")

        return collection
    except Exception as e:
        logger.error(f"Error creating Sentinel-2 collection: {str(e)}")
        raise


def calculate_ndvi_landsat(image):
    """
    Calculate NDVI for harmonized Landsat image using standardized band names
    
    Args:
        image: Earth Engine image with harmonized RED and NIR bands
        
    Returns:
        ee.Image: Image with NDVI band added
    """
    try:
        # Scale factors for Landsat Collection 2 Level 2
        scale_factor = 0.0000275
        offset = -0.2
        
        # Apply scaling to RED and NIR bands
        red_scaled = image.select('RED').multiply(scale_factor).add(offset)
        nir_scaled = image.select('NIR').multiply(scale_factor).add(offset)
        
        # Calculate NDVI
        ndvi = nir_scaled.subtract(red_scaled).divide(nir_scaled.add(red_scaled)).rename('NDVI')
        
        # Add NDVI band to the original image
        return image.addBands(ndvi).set('system:time_start', image.get('system:time_start'))
        
    except Exception as e:
        logger.error(f"Error calculating NDVI for harmonized Landsat image: {str(e)}")
        raise


def harmonize_landsat_bands(collection, analysis_type='ndvi'):
    """
    Harmonize band names across different Landsat missions to ensure compatibility.
    Supports different analysis types by selecting appropriate bands.
    
    Args:
        collection: Earth Engine ImageCollection with mixed Landsat missions
        analysis_type: str, either 'ndvi' or 'lst' to determine which bands to include
        
    Returns:
        ee.ImageCollection: Collection with harmonized band names
    """
    try:
        def harmonize_image(image):
            # Get band names to identify Landsat mission
            band_names = image.bandNames()
            
            # Check if this is Landsat 8/9 (has ST_B10) or Landsat 4-7 (has ST_B6)
            is_landsat_89 = band_names.contains('ST_B10')
            
            if analysis_type == 'lst':
                # Include thermal bands for LST analysis
                harmonized = ee.Algorithms.If(
                    is_landsat_89,
                    # Landsat 8/9: RED=SR_B4, NIR=SR_B5, THERMAL=ST_B10
                    image.select(['SR_B4', 'SR_B5', 'ST_B10', 'QA_PIXEL'], ['RED', 'NIR', 'ST_B10', 'QA_PIXEL']),
                    # Landsat 5/7: RED=SR_B3, NIR=SR_B4, THERMAL=ST_B6 -> ST_B10 (standardized name)
                    image.select(['SR_B3', 'SR_B4', 'ST_B6', 'QA_PIXEL'], ['RED', 'NIR', 'ST_B10', 'QA_PIXEL'])
                )
            else:
                # NDVI analysis - only optical bands
                harmonized = ee.Algorithms.If(
                    is_landsat_89,
                    # Landsat 8/9: RED=SR_B4, NIR=SR_B5
                    image.select(['SR_B4', 'SR_B5', 'QA_PIXEL'], ['RED', 'NIR', 'QA_PIXEL']),
                    # Landsat 4-7: RED=SR_B3, NIR=SR_B4  
                    image.select(['SR_B3', 'SR_B4', 'QA_PIXEL'], ['RED', 'NIR', 'QA_PIXEL'])
                )
            
            return ee.Image(harmonized).copyProperties(image, image.propertyNames())
        
        return collection.map(harmonize_image)
        
    except Exception as e:
        logger.error(f"Error harmonizing Landsat bands: {str(e)}")
        return collection


def get_landsat_collection_for_lst(geometry, start_date, end_date, cloud_cover=20):
    """
    Get a Landsat collection specifically for LST analysis with thermal bands.
    Supports Landsat 5, 7, 8, and 9 missions based on date range.
    """
    try:
        # Ensure Earth Engine is initialized
        if not initialize_earth_engine():
            raise ValueError("Earth Engine initialization failed")
            
        start_year = int(start_date.split("-")[0])
        end_year = int(end_date.split("-")[0])
        collections = []

        # Landsat 5 (1984-2013) - has thermal band ST_B6
        if start_year <= 2013:
            l5_end = min(end_year, 2013)
            if start_year <= l5_end:
                l5 = (
                    ee.ImageCollection("LANDSAT/LT05/C02/T1_L2")
                    .filterDate(start_date, end_date)
                    .filterBounds(geometry)
                    .filter(ee.Filter.lt("CLOUD_COVER", cloud_cover))
                )
                collections.append(l5)
                logger.info(f"Added Landsat 5 collection for LST analysis, years {start_year}-{l5_end}")

        # Landsat 7 (1999-present) - has thermal band ST_B6
        if end_year >= 1999:
            l7_start = max(start_year, 1999)
            l7 = (
                ee.ImageCollection("LANDSAT/LE07/C02/T1_L2")
                .filterDate(start_date, end_date)
                .filterBounds(geometry)
                .filter(ee.Filter.lt("CLOUD_COVER", cloud_cover))
            )
            collections.append(l7)
            logger.info(f"Added Landsat 7 collection for LST analysis, years {l7_start}-{end_year}")

        # Landsat 8 (2013-present) - has thermal band ST_B10
        if end_year >= 2013:
            l8_start = max(start_year, 2013)
            l8 = (
                ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
                .filterDate(start_date, end_date)
                .filterBounds(geometry)
                .filter(ee.Filter.lt("CLOUD_COVER", cloud_cover))
            )
            collections.append(l8)
            logger.info(f"Added Landsat 8 collection for LST analysis, years {l8_start}-{end_year}")

        # Landsat 9 (2021-present) - has thermal band ST_B10
        if end_year >= 2021:
            l9_start = max(start_year, 2021)
            l9 = (
                ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
                .filterDate(start_date, end_date)
                .filterBounds(geometry)
                .filter(ee.Filter.lt("CLOUD_COVER", cloud_cover))
            )
            collections.append(l9)
            logger.info(f"Added Landsat 9 collection for LST analysis, years {l9_start}-{end_year}")

        if not collections:
            raise Exception(f"No Landsat data available for LST analysis in date range: {start_date} to {end_date}")

        # Merge collections
        collection = collections[0]
        for i in range(1, len(collections)):
            collection = collection.merge(collections[i])

        collection_size = collection.size().getInfo()
        logger.info(f"Landsat collection for LST contains {collection_size} images")
        
        # Apply band harmonization specifically for LST analysis
        collection = harmonize_landsat_bands(collection, analysis_type='lst')
        logger.info("Applied LST band harmonization to mixed Landsat collection")
        
        # Add coverage validation to filter images with good AOI coverage
        def add_coverage_property(image):
            coverage_valid = validate_image_coverage(image, geometry, 90)  # 90% minimum coverage
            return image.set('aoi_coverage_valid', coverage_valid)
        
        collection_with_coverage = collection.map(add_coverage_property)
        well_covered_collection = collection_with_coverage.filter(ee.Filter.eq('aoi_coverage_valid', 1))
        
        well_covered_count = well_covered_collection.size().getInfo()
        logger.info(f"Found {well_covered_count} images with good AOI coverage for LST analysis")
        
        # Use well-covered images if available, otherwise fall back to all images
        if well_covered_count > 0:
            final_collection = well_covered_collection
            logger.info("Using well-covered images for LST analysis")
        else:
            final_collection = collection
            logger.warning("No well-covered images found for LST, using all available images")
        
        if final_collection.size().getInfo() == 0:
            raise Exception("No suitable Landsat images found for LST analysis")

        return final_collection
    except Exception as e:
        logger.error(f"Error creating Landsat collection for LST: {str(e)}")
        raise

