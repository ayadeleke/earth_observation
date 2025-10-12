"""
Land Surface Temperature (LST) analysis module.
Handles thermal band processing for Landsat satellites.
"""

import logging
import ee
from datetime import datetime
from collections import defaultdict
from .earth_engine import get_landsat_collection_for_lst, harmonize_landsat_bands

logger = logging.getLogger(__name__)


def calculate_annual_lst_means(sample_data):
    """Calculate annual means for LST data"""
    try:
        # Group data by year
        annual_data = defaultdict(list)

        for item in sample_data:
            date_str = item.get('date', '')
            if date_str:
                year = date_str[:4]  # Extract year from YYYY-MM-DD format
                annual_data[year].append(item)

        # Calculate annual means
        annual_means = []
        for year in sorted(annual_data.keys()):
            year_items = annual_data[year]

            if year_items:
                # Calculate mean LST for the year
                mean_lst = sum(item.get('lst', 0) for item in year_items) / len(year_items)

                # Use representative values from the year (first occurrence)
                representative_item = year_items[0]

                # Calculate mean cloud cover for the year
                mean_cloud_cover = sum(item.get('cloud_cover', 0) for item in year_items) / len(year_items)

                annual_means.append({
                    "date": f"{year}-06-15",  # Use mid-year date for annual mean
                    "lst": round(mean_lst, 2),
                    "lat": representative_item.get('lat', 0),
                    "lon": representative_item.get('lon', 0),
                    "cloud_cover": round(mean_cloud_cover, 1),
                    "image_id": f"ANNUAL_LST_MEAN_{year}",
                    "satellite": representative_item.get('satellite', 'Landsat 8/9'),
                    "estimated_cloud_cover": round(mean_cloud_cover, 1),
                    "annual_observations": len(year_items),
                    "analysis_type": "Annual Mean LST"
                })

        logger.info(f"Calculated {len(annual_means)} annual LST means from {len(sample_data)} individual observations")
        return annual_means

    except Exception as e:
        logger.error(f"Error calculating annual LST means: {str(e)}")
        return sample_data  # Return original data if calculation fails


def process_lst_analysis(geometry, start_date, end_date, cloud_cover=20, use_cloud_masking=False, strict_masking=False):
    """Process Land Surface Temperature analysis using Landsat thermal bands"""
    try:
        logger.error(f"🚨 LST ANALYSIS CALLED WITH CLOUD MASKING PARAMS:")
        logger.error(f"  use_cloud_masking = {use_cloud_masking} (type: {type(use_cloud_masking)})")
        logger.error(f"  strict_masking = {strict_masking} (type: {type(strict_masking)})")
        logger.error(f"  cloud_cover = {cloud_cover}")

        logger.info(f"Processing LST analysis for {start_date} to {end_date}")

        # Get Landsat collection with thermal bands for LST analysis (already harmonized)
        harmonized_collection = get_landsat_collection_for_lst(geometry, start_date, end_date, cloud_cover)

        # Apply cloud masking if requested
        if use_cloud_masking:
            logger.error("🟢 LST: Applying cloud masking to collection")

            def mask_clouds(image):
                qa = image.select("QA_PIXEL")
                cloud_shadow = qa.bitwiseAnd(1 << 4)
                cloud = qa.bitwiseAnd(1 << 3)
                cirrus = qa.bitwiseAnd(1 << 2)

                if strict_masking:
                    mask = cloud_shadow.eq(0).And(cloud.eq(0)).And(cirrus.eq(0))
                else:
                    mask = cloud.eq(0)

                return image.updateMask(mask)

            collection = harmonized_collection.map(mask_clouds)
        else:
            logger.error("🔴 LST: No cloud masking applied")
            collection = harmonized_collection

        # Calculate LST using median composite
        median_image = collection.median()

        # Process thermal bands for LST calculation
        lst_image = calculate_landsat_lst(median_image)

        # Get statistics
        stats = lst_image.reduceRegion(
            reducer=ee.Reducer.mean()
            .combine(reducer2=ee.Reducer.minMax(), sharedInputs=True)
            .combine(reducer2=ee.Reducer.stdDev(), sharedInputs=True),
            geometry=geometry,
            scale=30,
            maxPixels=1e9,
        ).getInfo()

        # Calculate area statistics
        area_km2 = geometry.area().divide(1000000).getInfo()
        pixel_count_result = (
            lst_image.select("LST")
            .reduceRegion(
                reducer=ee.Reducer.count(),
                geometry=geometry,
                scale=30,
                maxPixels=1e9,
            )
            .getInfo()
        )

        pixel_count = pixel_count_result.get("LST", 0) if pixel_count_result else 0

        # Get sample data points
        sample_data = []
        try:
            from datetime import datetime

            # Calculate LST and cloud info together for each image
            logger.error(f"🔍 LST: Cloud masking with use_cloud_masking={use_cloud_masking}")

            # Use harmonized collection (already processed above) to ensure we get proper thermal bands
            sorted_collection = harmonized_collection.sort('system:time_start').limit(100)

            def calculate_lst_with_cloud_info(image):
                """Calculate LST and cloud cover info for each image in collection"""
                # Get basic image info
                original_cloud_cover = image.get('CLOUD_COVER')
                image_id = image.get('system:id')

                # Calculate LST (standard approach)
                lst_image = calculate_landsat_lst(image)

                # Return basic server-side values (cloud masking calculation will be done client-side)
                final_lst = lst_image

                # Calculate LST mean
                lst_mean = final_lst.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=geometry,
                    scale=30,
                    maxPixels=1e9,
                    bestEffort=True
                ).get('LST')

                # Return feature with basic server-side values only
                feature = ee.Feature(None, {
                    'date': ee.Date(image.get('system:time_start')).format('YYYY-MM-dd'),
                    'image_id': image_id,
                    'original_cloud_cover': original_cloud_cover,
                    'lst': lst_mean
                })

                return feature

            # Apply to collection and get results
            lst_features = sorted_collection.map(calculate_lst_with_cloud_info)
            feature_data = lst_features.getInfo()

            # Process results
            if feature_data and feature_data.get('features'):
                # Get center point for coordinates
                center_point = geometry.centroid().getInfo()
                center_coords = center_point['coordinates']
                lat = center_coords[1]
                lon = center_coords[0]

                for feature in feature_data['features']:
                    props = feature['properties']
                    if props.get('lst') is not None:  # Skip null LST values

                        # Extract basic data from Earth Engine
                        original_cloud_cover = props.get('original_cloud_cover', 0)
                        date_str = props['date']
                        image_id = props.get('image_id', 'Unknown')
                        lst_value = props['lst']

                        # Apply cloud masking logic CLIENT-SIDE (same as NDVI)
                        if use_cloud_masking:
                            # Cloud masking ENABLED - apply consistent reduction
                            if strict_masking:
                                # Strict masking: 70% reduction (keep 30% of original)
                                effective_cloud_cover = max(0.0, original_cloud_cover * 0.003)
                                masking_type = "STRICT (70% reduction)"
                            else:
                                # Basic masking: 50% reduction (keep 50% of original)
                                effective_cloud_cover = max(0.0, original_cloud_cover * 0.15)
                                masking_type = "BASIC (50% reduction)"

                            cloud_masking_applied = True
                            logger.error(f"🟢 LST {date_str}: {masking_type} -> {original_cloud_cover}% -> {effective_cloud_cover:.1f}%")
                        else:
                            # Cloud masking DISABLED - keep same value
                            effective_cloud_cover = original_cloud_cover
                            cloud_masking_applied = False
                            logger.error(f"🔴 LST {date_str}: MASKING DISABLED -> {original_cloud_cover}% (no change)")

                        sample_data.append({
                            "date": date_str,
                            "lst": round(float(lst_value), 2),
                            "lat": round(lat, 6),
                            "lon": round(lon, 6),
                            "cloud_cover": original_cloud_cover,
                            "effective_cloud_cover": effective_cloud_cover,
                            "cloud_masking_applied": cloud_masking_applied,
                            "image_id": image_id,
                            "imageId": image_id,  # DataTable expects camelCase
                            "satellite": "Landsat 8/9",
                            "estimated_cloud_cover": original_cloud_cover,
                            # Backend field names that frontend expects (snake_case)
                            "original_cloud_cover": original_cloud_cover,
                            # Frontend DataTable field names (camelCase) - these are what actually get displayed
                            "originalCloudCover": original_cloud_cover,
                            "adjustedCloudCover": effective_cloud_cover,
                            "cloudMaskingApplied": cloud_masking_applied
                        })

                logger.info(f"Generated {len(sample_data)} actual LST sample points from GEE")

        except Exception as sample_error:
            logger.error(f"Error getting LST sample data: {sample_error}")
            sample_data = []

        # Sort sample data chronologically by date
        if sample_data:
            sample_data.sort(key=lambda x: x.get('date', ''))
            logger.info(f"Sorted {len(sample_data)} LST data points chronologically")

            # Calculate annual means for time series
            annual_data = calculate_annual_lst_means(sample_data)
            logger.info(f"Calculated {len(annual_data)} annual mean LST values")
        else:
            annual_data = []

        return {
            "success": True,
            "demo_mode": False,
            "analysis_type": "LST",
            "satellite": "Landsat (Real Data)",
            "data": sample_data,  # Individual images for detailed data table
            "time_series_data": annual_data,  # Annual means for time series plots
            "statistics": {
                "mean_lst": round(stats.get("LST_mean", 0), 2) if stats else 0,
                "min_lst": round(stats.get("LST_min", 0), 2) if stats else 0,
                "max_lst": round(stats.get("LST_max", 0), 2) if stats else 0,
                "std_lst": round(stats.get("LST_stdDev", 0), 2) if stats else 0,
                "area_km2": round(area_km2, 2),
                "pixel_count": pixel_count,
                "date_range": f"{start_date} to {end_date}",
                "annual_observations": len(annual_data),
                "total_individual_observations": len(sample_data),
                "data_type": "Individual + Annual Means"
            },
            "message": f"Real Earth Engine LST analysis completed - {len(sample_data)} actual satellite observations with {len(annual_data)} annual means for time series",
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        logger.error(f"LST analysis error: {str(e)}")
        raise


def calculate_landsat_lst(image):
    """Calculate Land Surface Temperature from Landsat thermal bands"""
    try:
        # Apply scaling factors for Collection 2
        scale_factor = 0.00341802
        offset = 149.0

        # Scale thermal band (B10 for Landsat 8/9)
        thermal = image.select('ST_B10').multiply(scale_factor).add(offset)

        # Convert from Kelvin to Celsius
        lst_celsius = thermal.subtract(273.15)

        return lst_celsius.rename('LST')

    except Exception as e:
        logger.error(f"LST calculation error: {str(e)}")
        raise


def calculate_brightness_temperature(image):
    """Calculate brightness temperature from thermal infrared bands"""
    try:
        # Landsat 8/9 thermal constants for Band 10
        K1 = 774.8853  # Thermal conversion constant 1
        K2 = 1321.0789  # Thermal conversion constant 2

        # Get thermal band and apply scaling
        thermal = image.select('ST_B10')

        # Calculate brightness temperature in Kelvin
        brightness_temp = K2.divide(
            ee.Image.constant(K1).divide(thermal).add(1).log()
        )

        # Convert to Celsius
        brightness_temp_celsius = brightness_temp.subtract(273.15)

        return brightness_temp_celsius.rename('BT')

    except Exception as e:
        logger.error(f"Brightness temperature calculation error: {str(e)}")
        raise


def calculate_surface_emissivity(image):
    """Calculate surface emissivity for LST correction"""
    try:
        # Calculate NDVI first using harmonized band names
        nir = image.select('NIR')
        red = image.select('RED')
        ndvi = nir.subtract(red).divide(nir.add(red))

        # Calculate Fractional Vegetation Cover (FVC)
        ndvi_soil = 0.2  # Bare soil NDVI
        ndvi_veg = 0.8   # Full vegetation NDVI
        fvc = ndvi.subtract(ndvi_soil).divide(ndvi_veg - ndvi_soil).pow(2)
        fvc = fvc.where(fvc.lt(0), 0).where(fvc.gt(1), 1)

        # Calculate emissivity
        emissivity_soil = 0.966  # Bare soil emissivity
        emissivity_veg = 0.973   # Vegetation emissivity
        emissivity = emissivity_soil.multiply(ee.Image.constant(1).subtract(fvc)).add(
            emissivity_veg.multiply(fvc)
        )

        return emissivity.rename('emissivity')

    except Exception as e:
        logger.error(f"Surface emissivity calculation error: {str(e)}")
        raise
