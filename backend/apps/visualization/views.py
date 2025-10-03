import ee
import logging
import os
import tempfile
import zipfile
from datetime import datetime
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
import folium  # For enhanced layer control

try:
    import geopandas as gpd
    from shapely.geometry import mapping
    GEOPANDAS_AVAILABLE = True
except ImportError:
    GEOPANDAS_AVAILABLE = False
    gpd = None
    mapping = None

# Try to import geemap for interactive maps
try:
    import geemap
    GEEMAP_AVAILABLE = True
except ImportError:
    GEEMAP_AVAILABLE = False
    geemap = None

logger = logging.getLogger(__name__)


def calculate_ndvi_landsat(image, enable_cloud_masking=True, masking_strictness=False):
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
    
    # Calculate NDVI
    ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI')
    
    # Apply cloud masking if enabled
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
            
            # Apply mask to NDVI
            ndvi = ndvi.updateMask(cloud_mask)
        except Exception as e:
            # If QA_PIXEL band is not available, continue without masking
            logger.warning(f"QA_PIXEL band not available for cloud masking in Landsat image: {e}")
    
    # Add date and NDVI to image
    return image.addBands(ndvi).set('system:time_start', image.get('system:time_start'))


def calculate_lst_landsat(image, enable_cloud_masking=True, masking_strictness=False):
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


def calculate_sentinel2_ndvi(image, enable_cloud_masking=True, masking_strictness=False):
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


def create_interactive_map(geometry, analysis_type='ndvi', start_date=None, end_date=None, satellite='landsat', cloud_cover=20, selected_images=None, cloud_masking_level='recommended'):
    """
    Create an interactive map with calculated analysis layers - Django version of Flask functionality
    
    Args:
        geometry: Earth Engine geometry for the area of interest
        analysis_type: Type of analysis ('ndvi', 'lst', 'backscatter')
        start_date: Start date for image collection
        end_date: End date for image collection
        satellite: Satellite type ('landsat', 'sentinel1', 'sentinel2')
        cloud_cover: Maximum cloud cover percentage
        selected_images: List of pre-selected images (optional)
        
    Returns:
        dict: Map HTML file information and metadata
    """
    try:
        if not GEEMAP_AVAILABLE:
            logger.warning("geemap not available, falling back to simple HTML map")
            return create_simple_html_map_with_analysis(geometry, analysis_type, start_date, end_date, satellite, cloud_cover)
        
        logger.info(f"Creating interactive map with analysis: {analysis_type}, satellite: {satellite}")
        
        # Get center coordinates from geometry
        try:
            bounds = geometry.bounds().getInfo()
            coords = bounds['coordinates'][0]
            center_lat = sum(coord[1] for coord in coords) / len(coords)
            center_lon = sum(coord[0] for coord in coords) / len(coords)
            logger.info(f"Map center coordinates: {center_lat}, {center_lon}")
        except Exception as e:
            logger.warning(f"Failed to extract geometry center: {e}, using defaults")
            center_lat, center_lon = 52.5, 13.4
        
        # Create a minimal geemap Map
        map_obj = geemap.Map(
            center=[center_lat, center_lon],
            zoom=10,
            add_google_map=False,  # Prevent duplicate base layers
            plugin_LatLngPopup=False,  # Disable unused plugins
            plugin_Draw=False,
            plugin_Fullscreen=False,  # Keep UI minimal
            control_scale=True  # Add scale for reference
        )
        
        # Initialize the map with proper layers
        try:
            # Add single basemap that will be controlled by the layer control
            map_obj.add_basemap('SATELLITE')
            
            # Add the area of interest with mobile-friendly style
            aoi_style = {
                'color': 'red',
                'weight': 2,
                'fillOpacity': 0.1,
                'opacity': 0.8
            }
            map_obj.addLayer(geometry, aoi_style, 'Area of Interest')
            logger.info("Initialized map with basemaps and AOI")
        except Exception as e:
            logger.warning(f"Could not initialize map layers: {e}")
        
        # Add AOI boundary
        try:
            aoi_style = {
                'color': 'red',
                'fillColor': 'red',
                'fillOpacity': 0.1,
                'weight': 3
            }
            map_obj.addLayer(geometry, aoi_style, 'Area of Interest')
            map_obj.centerObject(geometry, 10)
            logger.info("Added geometry layer and centered map")
        except Exception as e:
            logger.warning(f"Failed to add geometry layer: {e}")
        
        # Get image collection based on satellite type
        if 'sentinel2' in satellite.lower():
            collection = get_sentinel2_collection(geometry, start_date, end_date, cloud_cover)
        elif 'sentinel1' in satellite.lower() or 'sentinel-1' in satellite.lower():
            collection = get_sentinel1_collection(geometry, start_date, end_date)
        else:  # landsat
            collection = get_landsat_collection(geometry, start_date, end_date, cloud_cover)
        
        if collection.size().getInfo() == 0:
            raise ValueError("No images found for the specified criteria")
        
        # Get images for analysis - use selected images if provided, otherwise first few
        if selected_images and len(selected_images) > 0:
            # Handle special case for analysis page: first and last images only
            if (len(selected_images) == 1 and 
                isinstance(selected_images[0], str) and 
                selected_images[0] == 'first_last'):
                
                logger.info("Using first and last images for analysis page custom map")
                full_image_list = collection.getInfo()['features']
                
                if len(full_image_list) >= 2:
                    # Use first and last images
                    first_img = ee.Image(full_image_list[0]['id'])
                    last_img = ee.Image(full_image_list[-1]['id'])
                    images = [first_img, last_img]
                    logger.info(f"Selected first image: {full_image_list[0]['id']}")
                    logger.info(f"Selected last image: {full_image_list[-1]['id']}")
                elif len(full_image_list) == 1:
                    # Only one image available
                    images = [ee.Image(full_image_list[0]['id'])]
                    logger.info(f"Only one image available: {full_image_list[0]['id']}")
                else:
                    raise ValueError("No images found for the specified criteria")
                    
            else:
                # User has selected specific images - use those
                logger.info(f"Using {len(selected_images)} user-selected images")
                full_image_list = collection.getInfo()['features']
                
                # Clean and parse the selected indices
                cleaned_indices = []
                for idx in selected_images:
                    try:
                        # Handle both integer and string indices
                        index = int(str(idx).strip('[]')) if isinstance(idx, str) else int(idx)
                        if 0 <= index < len(full_image_list):
                            cleaned_indices.append(index)
                        else:
                            logger.warning(f"Invalid image index: {index} (max: {len(full_image_list)-1})")
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Error processing selected image index {idx}: {e}")
                
                # Sort indices to maintain chronological order
                cleaned_indices.sort()
                
                # Convert indices to images
                images = []
                for index in cleaned_indices:
                    img_id = full_image_list[index]['id']
                    images.append(ee.Image(img_id))
                    logger.info(f"Selected image {index}: {img_id}")
                
                if not images:
                    logger.warning("No valid selected images found, falling back to first 5")
                    image_list = collection.limit(5).getInfo()['features']
                    images = [ee.Image(img['id']) for img in image_list]
        else:
            # No valid selection - use first few images for visualization
            logger.info("No valid user selection, using first 5 images")
            try:
                image_list = collection.limit(5).getInfo()['features']
                images = [ee.Image(img['id']) for img in image_list]
                if not images:
                    raise ValueError("No images found for the specified date range and parameters")
            except Exception as e:
                logger.error(f"Error getting default images: {e}")
                raise ValueError("Failed to get default images. Check the date range and parameters.")
        
        # Add analysis layers based on type
        if analysis_type.lower() == 'ndvi':
            add_ndvi_layers(map_obj, images, geometry, satellite, collection, cloud_masking_level)
        elif analysis_type.lower() == 'lst' and satellite.lower() != 'sentinel2':
            add_lst_layers(map_obj, images, geometry, satellite, collection, cloud_masking_level)
        elif (analysis_type.lower() in ['backscatter', 'sar']) and ('sentinel1' in satellite.lower() or 'sentinel-1' in satellite.lower()):
            add_backscatter_layers(map_obj, images, geometry, collection)
        else:
            logger.warning(f"Analysis type {analysis_type} not supported for satellite {satellite}")
            # Add basic RGB layers as fallback
            add_rgb_layers(map_obj, images, geometry, satellite)
        
        # Add layer control using direct JavaScript injection
        try:
            # First remove any existing layer control
            map_obj.clear_controls()
            
            # Add this JavaScript after the map is created
            custom_js = """
            <script>
            // Wait for the map and layers to be ready
            document.addEventListener('DOMContentLoaded', function() {
                if (typeof mapObject !== 'undefined') {
                    // Create a collapsible layer control
                    var layerControl = L.control.layers(
                        {'Satellite': mapObject.layers[0]},  // Base layers
                        {},  // Overlays (added automatically)
                        {
                            position: 'topright',
                            collapsed: true,
                            sortLayers: false
                        }
                    );
                    
                    // Add it to the map
                    layerControl.addTo(mapObject);
                    
                    // Style the control for mobile
                    var style = document.createElement('style');
                    style.textContent = `
                        .leaflet-control-layers {
                            max-height: 60vh;
                            overflow-y: auto;
                            font-size: 14px;
                            background: white;
                            border-radius: 4px;
                            box-shadow: 0 1px 5px rgba(0,0,0,0.4);
                        }
                        .leaflet-touch .leaflet-control-layers {
                            border: 2px solid rgba(0,0,0,0.2);
                        }
                        @media (max-width: 600px) {
                            .leaflet-control-layers {
                                max-height: 40vh;
                                max-width: 80vw;
                            }
                        }
                    `;
                    document.head.appendChild(style);
                }
            });
            </script>
            """
            
            # Get the HTML content
            html_content = map_obj.to_html()
            
            # Insert our custom JavaScript before the closing body tag
            html_content = html_content.replace('</body>', f'{custom_js}</body>')
            
            # Save the modified HTML
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            map_filename = f'interactive_map_{timestamp}.html'
            map_filepath = os.path.join(settings.STATIC_DIR, map_filename)
            
            with open(map_filepath, 'w', encoding='utf-8') as f:
                f.write(html_content)
            
            logger.info("Added custom collapsible layer control")
            
        except Exception as e:
            logger.warning(f"Could not add custom layer control: {e}")
            try:
                # Basic fallback
                map_obj.add_layer_control()
                logger.info("Added basic layer control as fallback")
            except Exception as e2:
                logger.warning(f"Could not add basic layer control: {e2}")
        
        # Center map on the area of interest
        map_obj.centerObject(geometry, zoom=11)
        
        # Save map to HTML file
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        map_filename = f'interactive_map_{timestamp}.html'
        
        from django.conf import settings
        static_dir = os.path.join(settings.BASE_DIR, 'static')
        os.makedirs(static_dir, exist_ok=True)
        map_filepath = os.path.join(static_dir, map_filename)
        
        # Save the map
        map_obj.to_html(map_filepath)
        logger.info(f"Interactive map saved to {map_filepath}")
        
        # Verify file was created successfully
        if os.path.exists(map_filepath) and os.path.getsize(map_filepath) > 1000:
            return {
                'success': True,
                'map_url': f'/static/{map_filename}',
                'map_filename': map_filename,
                'fallback_url': f'/static/{map_filename}'
            }
        else:
            logger.error("Map file creation failed or file too small")
            return create_simple_html_map_with_analysis(geometry, analysis_type, start_date, end_date, satellite, cloud_cover)
        
    except Exception as e:
        logger.error(f"Error creating interactive map: {str(e)}")
        return create_simple_html_map_with_analysis(geometry, analysis_type, start_date, end_date, satellite, cloud_cover)


def filter_for_complete_coverage(collection, geometry, is_sentinel1=False):
    """
    Filter collection to only include images that completely cover the ROI
    
    Args:
        collection: Earth Engine ImageCollection
        geometry: Earth Engine geometry object (ROI)
        
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
    """Get Landsat collection for the specified parameters with complete ROI coverage"""
    try:
        start_year = int(start_date.split("-")[0])
        end_year = int(end_date.split("-")[0])
        collections = []
        
        # Log the search parameters
        logger.info(f"Searching for Landsat images: {start_date} to {end_date}, cloud cover <= {cloud_cover}%")
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
            raise ValueError(f"No Landsat collections available for date range: {start_date} to {end_date}")

        # Merge collections
        collection = collections[0]
        for coll in collections[1:]:
            collection = collection.merge(coll)
        
        # Get initial count
        total_images = collection.size().getInfo()
        logger.info(f"Total images found: {total_images}")
        
        if total_images == 0:
            # Try with relaxed cloud cover if no images found
            cloud_cover_relaxed = min(cloud_cover * 2, 100)
            logger.info(f"No images found, trying with relaxed cloud cover: {cloud_cover_relaxed}%")
            
            collection = collection.filter(ee.Filter.lt("CLOUD_COVER", cloud_cover_relaxed))
            total_images = collection.size().getInfo()
            logger.info(f"Images found with relaxed cloud cover: {total_images}")
            
            if total_images == 0:
                raise ValueError("No images found even with relaxed cloud cover threshold")
        
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
    """Get Sentinel-2 collection for the specified parameters with complete ROI coverage"""
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


def get_sentinel1_collection(geometry, start_date, end_date):
    """Get Sentinel-1 collection for the specified parameters with complete ROI coverage"""
    collection = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterDate(start_date, end_date)
        .filterBounds(geometry)
        .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
        .filterMetadata('resolution_meters', 'equals', 10)
        .filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'))
        .filter(ee.Filter.eq('instrumentMode', 'IW'))
    )
    
    logger.info(f"Total Sentinel-1 images before coverage filtering: {collection.size().getInfo()}")
    
    try:
        # Apply less strict coverage filtering for Sentinel-1
        def check_coverage_s1(image):
            footprint = image.geometry()
            intersection = footprint.intersection(geometry, ee.ErrorMargin(10))  # 10m tolerance for SAR
            intersection_area = intersection.area()
            roi_area = geometry.area()
            coverage_percent = intersection_area.divide(roi_area).multiply(100)
            return image.set('coverage_percent', coverage_percent)
        
        # Add coverage info to images
        collection_with_coverage = collection.map(check_coverage_s1)
        
        # Filter for images with at least 90% coverage
        filtered_collection = collection_with_coverage.filter(ee.Filter.gte('coverage_percent', 90))
        filtered_count = filtered_collection.size().getInfo()
        logger.info(f"Sentinel-1 images after coverage filtering: {filtered_count}")
        
        if filtered_count == 0:
            logger.warning("No images with sufficient coverage, using unfiltered collection")
            return collection
        return filtered_collection
    except Exception as e:
        logger.warning(f"Coverage filtering failed for Sentinel-1: {e}, using unfiltered collection")
        return collection


def add_ndvi_layers(map_obj, images, geometry, satellite, collection, cloud_masking_level='recommended'):
    """Add NDVI analysis layers to the map including temporal changes"""
    try:
        # Convert cloud_masking_level to boolean parameters
        enable_cloud_masking = cloud_masking_level != 'disabled'
        masking_strictness = cloud_masking_level == 'strict'
        
        logger.info(f"Adding NDVI layers for {satellite}, cloud masking: {cloud_masking_level}")
        
        # Calculate NDVI for the collection and get median
        if satellite.lower() == 'sentinel2':
            ndvi_collection = collection.map(lambda img: calculate_sentinel2_ndvi(img, enable_cloud_masking, masking_strictness))
        else:
            ndvi_collection = collection.map(lambda img: calculate_ndvi_landsat(img, enable_cloud_masking, masking_strictness))
        
        ndvi_median = ndvi_collection.select('NDVI').median().clip(geometry)
        
        # Add NDVI layer
        vis_params_ndvi = {
            'min': -1,
            'max': 1,
            'palette': ['red', 'yellow', 'green']
        }
        
        # Add median NDVI layer with visualization parameters
        try:
            map_obj.addLayer(
                ndvi_median, 
                vis_params_ndvi, 
                f'NDVI Median ({satellite.upper()})'
            )
            logger.info("Added median NDVI layer")
        except Exception as e:
            logger.warning(f"Error adding median NDVI layer: {e}")
        
        # Images are already sorted chronologically from the selection process
        logger.info(f"Processing {len(images)} images for NDVI analysis")
        
        # Add individual NDVI images and calculate changes
        logger.info(f"Adding {len(images)} individual NDVI layers and changes")
        ndvi_images = []
        image_dates = []
        
        for i, image in enumerate(images):
            try:
                if satellite.lower() == 'sentinel2':
                    ndvi_image = calculate_sentinel2_ndvi(image, enable_cloud_masking, masking_strictness)
                else:
                    ndvi_image = calculate_ndvi_landsat(image, enable_cloud_masking, masking_strictness)
                
                ndvi = ndvi_image.select('NDVI')
                ndvi_clipped = ndvi.clip(geometry)
                date_info = ee.Date(image.get('system:time_start')).format('YYYY-MM-dd').getInfo()
                
                # Store for change analysis
                ndvi_images.append(ndvi_clipped)
                image_dates.append(date_info)
                
                # Add individual NDVI layer with brackets for first/last images
                try:
                    # Add brackets around first and last image labels
                    if i == 0 and len(images) > 1:
                        layer_name = f'[First Image] NDVI {date_info}'
                    elif i == len(images) - 1 and len(images) > 1:
                        layer_name = f'[Last Image] NDVI {date_info}'
                    else:
                        layer_name = f'NDVI {date_info}'
                    
                    map_obj.addLayer(
                        ndvi_clipped, 
                        vis_params_ndvi, 
                        layer_name
                    )
                    logger.info(f"Added NDVI layer: {layer_name}")
                except Exception as e:
                    logger.warning(f"Error adding NDVI layer for {date_info}: {e}")
            except Exception as e:
                logger.warning(f"Failed to add NDVI layer for image {i}: {e}")
        
        # Add NDVI change layers if we have multiple images
        if len(ndvi_images) >= 2:
            try:
                # Create visualization parameters for NDVI changes
                vis_params_ndvi_change = {
                    'min': -0.5,
                    'max': 0.5,
                    'palette': ['red', 'white', 'green']  # Red = decrease, Green = increase
                }
                
                # Calculate sequential changes between consecutive images
                for i in range(len(ndvi_images) - 1):
                    earlier_ndvi = ndvi_images[i]
                    later_ndvi = ndvi_images[i + 1]
                    ndvi_change = later_ndvi.subtract(earlier_ndvi)
                    
                    change_label = f'NDVI Change ({image_dates[i]} → {image_dates[i + 1]})'
                    map_obj.addLayer(ndvi_change, vis_params_ndvi_change, change_label)
                    logger.info(f"Added NDVI change layer: {change_label}")
                
                # Add total change (first to last)
                total_change = ndvi_images[-1].subtract(ndvi_images[0])
                total_change_label = f'NDVI Total Change ({image_dates[0]} → {image_dates[-1]})'
                map_obj.addLayer(total_change, vis_params_ndvi_change, total_change_label)
                logger.info("Added NDVI total change layer")
            except Exception as e:
                logger.warning(f"Failed to add NDVI change layers: {e}")
        
        logger.info("Successfully added NDVI layers and changes")
        
    except Exception as e:
        logger.error(f"Error adding NDVI layers: {e}")


def add_lst_layers(map_obj, images, geometry, satellite, collection, cloud_masking_level='recommended'):
    """Add LST analysis layers to the map"""
    try:
        # Convert cloud_masking_level to boolean parameters
        enable_cloud_masking = cloud_masking_level != 'disabled'
        masking_strictness = cloud_masking_level == 'strict'
        
        logger.info(f"Adding LST layers for {satellite}, cloud masking: {cloud_masking_level}")
        
        # Calculate LST for the collection and get median
        lst_collection = collection.map(lambda img: calculate_lst_landsat(img, enable_cloud_masking, masking_strictness))
        lst_median = lst_collection.select('LST').median().clip(geometry)
        
        # Add LST layer
        vis_params_lst = {
            'min': 0,
            'max': 40,
            'palette': ['blue', 'cyan', 'yellow', 'red']
        }
        map_obj.addLayer(lst_median, vis_params_lst, f'LST Median ({satellite.upper()}) °C')
        
        # Add individual LST layers and calculate changes
        logger.info(f"Adding {len(images)} individual LST layers and changes")
        lst_images = []
        image_dates = []
        
        for i, image in enumerate(images):
            try:
                lst_image = calculate_lst_landsat(image, enable_cloud_masking, masking_strictness)
                lst_clipped = lst_image.select('LST').clip(geometry)
                date_info = ee.Date(image.get('system:time_start')).format('YYYY-MM-dd').getInfo()
                
                # Store for change analysis
                lst_images.append(lst_clipped)
                image_dates.append(date_info)
                
                # Add individual LST layer with brackets for first/last images
                if i == 0 and len(images) > 1:
                    layer_name = f'[First Image] LST {date_info} °C'
                elif i == len(images) - 1 and len(images) > 1:
                    layer_name = f'[Last Image] LST {date_info} °C'
                else:
                    layer_name = f'LST {date_info} °C'
                
                map_obj.addLayer(lst_clipped, vis_params_lst, layer_name)
                logger.info(f"Added LST layer: {layer_name}")
            except Exception as e:
                logger.warning(f"Failed to add LST layer for image {i}: {e}")
        
        # Add LST change layers if we have multiple images
        if len(lst_images) >= 2:
            try:
                # Create visualization parameters for LST changes
                vis_params_lst_change = {
                    'min': -10,
                    'max': 10,
                    'palette': ['blue', 'white', 'red']  # Blue = cooler, Red = warmer
                }
                
                # Calculate sequential temperature changes
                for i in range(len(lst_images) - 1):
                    earlier_lst = lst_images[i]
                    later_lst = lst_images[i + 1]
                    lst_change = later_lst.subtract(earlier_lst)
                    
                    change_label = f'LST Change ({image_dates[i]} → {image_dates[i + 1]}) °C'
                    map_obj.addLayer(lst_change, vis_params_lst_change, change_label)
                    logger.info(f"Added LST change layer: {change_label}")
                
                # Add total temperature change (first to last)
                total_change = lst_images[-1].subtract(lst_images[0])
                total_change_label = f'LST Total Change ({image_dates[0]} → {image_dates[-1]}) °C'
                map_obj.addLayer(total_change, vis_params_lst_change, total_change_label)
                logger.info("Added LST total change layer")
            except Exception as e:
                logger.warning(f"Failed to add LST change layers: {e}")
        
        logger.info("Successfully added LST layers and changes")
        
    except Exception as e:
        logger.error(f"Error adding LST layers: {e}")


def add_backscatter_layers(map_obj, images, geometry, collection):
    """Add Sentinel-1 backscatter layers to the map"""
    try:
        logger.info("Adding Sentinel-1 backscatter layers")
        
        # Get median backscatter
        median_image = collection.median().clip(geometry)
        
        # Add VV polarization layer
        vis_params_sar = {
            'min': -25,
            'max': 0,
            'palette': ['black', 'gray', 'white']
        }
        map_obj.addLayer(median_image.select('VV'), vis_params_sar, 'SAR VV Median (dB)')
        
        # Add individual backscatter images and calculate changes
        logger.info(f"Adding {len(images)} individual SAR layers and changes")
        sar_images = []
        image_dates = []
        
        for i, image in enumerate(images):
            try:
                sar_clipped = image.clip(geometry)
                date_info = ee.Date(image.get('system:time_start')).format('YYYY-MM-dd').getInfo()
                
                # Store for change analysis
                sar_images.append(sar_clipped)
                image_dates.append(date_info)
                
                # Add individual SAR layer with brackets for first/last images
                if i == 0 and len(images) > 1:
                    layer_name = f'[First Image] SAR VV {date_info} (dB)'
                elif i == len(images) - 1 and len(images) > 1:
                    layer_name = f'[Last Image] SAR VV {date_info} (dB)'
                else:
                    layer_name = f'SAR VV {date_info} (dB)'
                
                map_obj.addLayer(sar_clipped.select('VV'), vis_params_sar, layer_name)
                logger.info(f"Added SAR layer: {layer_name}")
            except Exception as e:
                logger.warning(f"Failed to add SAR layer for image {i}: {e}")
        
        # Add backscatter change layers if we have multiple images
        if len(sar_images) >= 2:
            try:
                # Create visualization parameters for backscatter changes
                vis_params_sar_change = {
                    'min': -5,
                    'max': 5,
                    'palette': ['red', 'white', 'blue']  # Red = decrease, Blue = increase
                }
                
                # Calculate sequential backscatter changes
                for i in range(len(sar_images) - 1):
                    earlier_sar = sar_images[i].select('VV')
                    later_sar = sar_images[i + 1].select('VV')
                    sar_change = later_sar.subtract(earlier_sar)
                    
                    change_label = f'SAR VV Change ({image_dates[i]} → {image_dates[i + 1]}) dB'
                    map_obj.addLayer(sar_change, vis_params_sar_change, change_label)
                    logger.info(f"Added SAR change layer: {change_label}")
                
                # Add total backscatter change (first to last)
                total_change = sar_images[-1].select('VV').subtract(sar_images[0].select('VV'))
                total_change_label = f'SAR VV Total Change ({image_dates[0]} → {image_dates[-1]}) dB'
                map_obj.addLayer(total_change, vis_params_sar_change, total_change_label)
                logger.info("Added SAR total change layer")
            except Exception as e:
                logger.warning(f"Failed to add SAR change layers: {e}")
        
        logger.info("Successfully added backscatter layers and changes")
        
    except Exception as e:
        logger.error(f"Error adding backscatter layers: {e}")


def add_rgb_layers(map_obj, images, geometry, satellite):
    """Add RGB visualization layers as fallback"""
    try:
        logger.info(f"Adding RGB layers for {satellite}")
        
        for i, image in enumerate(images[:min(3, len(images))]):  # Use up to 3 images for RGB
            try:
                image_clipped = image.clip(geometry)
                date_info = ee.Date(image.get('system:time_start')).format('YYYY-MM-dd').getInfo()
                
                if satellite.lower() == 'sentinel2':
                    vis_params = {
                        'bands': ['B4', 'B3', 'B2'],  # RGB for Sentinel-2
                        'min': 0,
                        'max': 3000
                    }
                else:  # Landsat
                    # Try different band combinations
                    band_names = image.bandNames().getInfo()
                    if 'SR_B4' in band_names:  # Landsat 8/9
                        vis_params = {
                            'bands': ['SR_B4', 'SR_B3', 'SR_B2'],
                            'min': 0.0,
                            'max': 0.3
                        }
                    else:  # Landsat 4-7
                        vis_params = {
                            'bands': ['SR_B3', 'SR_B2', 'SR_B1'],
                            'min': 0.0,
                            'max': 0.3
                        }
                
                # Add individual RGB layer with brackets for first/last images
                if i == 0 and len(images) > 1:
                    layer_name = f'[First Image] RGB {date_info}'
                elif i == len(images) - 1 and len(images) > 1:
                    layer_name = f'[Last Image] RGB {date_info}'
                else:
                    layer_name = f'RGB {date_info}'
                
                map_obj.addLayer(image_clipped, vis_params, layer_name)
                logger.info(f"Added RGB layer: {layer_name}")
            except Exception as e:
                logger.warning(f"Failed to add RGB layer for image {i}: {e}")
        
    except Exception as e:
        logger.error(f"Error adding RGB layers: {e}")


def create_simple_html_map_with_analysis(geometry, analysis_type, start_date, end_date, satellite, cloud_cover):
    """Create a simple HTML map with basic analysis visualization as fallback"""
    try:
        logger.info("Creating simple HTML map with analysis as fallback")
        
        # Get center coordinates
        try:
            bounds = geometry.bounds().getInfo()
            coords = bounds['coordinates'][0]
            center_lat = sum(coord[1] for coord in coords) / len(coords)
            center_lon = sum(coord[0] for coord in coords) / len(coords)
        except:
            center_lat, center_lon = 52.5, 13.4
        
        # Generate Earth Engine tile URL for the analysis
        if analysis_type.lower() == 'ndvi':
            if satellite.lower() == 'sentinel2':
                result = generate_sentinel2_visualization(geometry, start_date, end_date, satellite, cloud_cover)
            else:
                result = generate_ndvi_visualization(geometry, start_date, end_date, satellite, cloud_cover)
        elif analysis_type.lower() == 'lst':
            result = generate_lst_visualization(geometry, start_date, end_date, satellite, cloud_cover)
        else:
            # Basic RGB visualization
            collection = get_landsat_collection(geometry, start_date, end_date, cloud_cover)
            image = collection.median().clip(geometry)
            vis_params = {'bands': ['SR_B4', 'SR_B3', 'SR_B2'], 'min': 0.0, 'max': 0.3}
            map_id_dict = ee.Image(image).getMapId(vis_params)
            tile_url = f"https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/{map_id_dict['mapid']}/tiles/{{z}}/{{x}}/{{y}}?token={map_id_dict['token']}"
            result = Response({'tile_url': tile_url, 'bounds': geometry.bounds().getInfo()})
        
        response_data = result.data if hasattr(result, 'data') else result
        tile_url = response_data.get('tile_url', '')
        
        # Create HTML content
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>{analysis_type.upper()} Analysis - {satellite.upper()}</title>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <style>
                body {{ margin: 0; padding: 0; }}
                #map {{ height: 100vh; width: 100%; }}
                .legend {{ 
                    background: white; 
                    padding: 10px; 
                    border-radius: 5px; 
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                    font-family: Arial, sans-serif;
                }}
                .info {{ padding: 6px 8px; font: 14px Arial; background: rgba(255,255,255,0.8); }}
            </style>
        </head>
        <body>
            <div id="map"></div>
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
            <script>
                var map = L.map('map').setView([{center_lat}, {center_lon}], 10);
                
                // Base layers
                var osm = L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{
                    attribution: '© OpenStreetMap contributors'
                }});
                
                var satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{{z}}/{{y}}/{{x}}', {{
                    attribution: 'Tiles © Esri'
                }});
                
                satellite.addTo(map);
                
                // Add analysis layer
                var analysisLayer = L.tileLayer('{tile_url}', {{
                    attribution: 'Google Earth Engine | {analysis_type.upper()} Analysis',
                    opacity: 0.8
                }}).addTo(map);
                
                // Layer control
                var baseLayers = {{
                    "Satellite": satellite,
                    "OpenStreetMap": osm
                }};
                var overlayLayers = {{
                    "{analysis_type.upper()} Layer": analysisLayer
                }};
                L.control.layers(baseLayers, overlayLayers).addTo(map);
                
                // Add AOI boundary
                var aoi = {geometry.getInfo()};
                var aoiLayer = L.geoJSON(aoi, {{
                    style: {{
                        color: 'red',
                        weight: 3,
                        fillOpacity: 0.1,
                        fillColor: 'red'
                    }}
                }}).addTo(map);
                
                // Fit to AOI
                map.fitBounds(aoiLayer.getBounds());
                
                // Add legend
                var legend = L.control({{position: 'bottomright'}});
                legend.onAdd = function (map) {{
                    var div = L.DomUtil.create('div', 'legend');
                    div.innerHTML = '<h4>{analysis_type.upper()} Analysis</h4>' +
                                   '<p><strong>Satellite:</strong> {satellite.upper()}</p>' +
                                   '<p><strong>Period:</strong> {start_date} to {end_date}</p>' +
                                   '<p><strong>Generated:</strong> {datetime.now().strftime("%Y-%m-%d %H:%M")}</p>';
                    return div;
                }};
                legend.addTo(map);
            </script>
        </body>
        </html>
        """
        
        # Save HTML file
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        map_filename = f'simple_analysis_map_{timestamp}.html'
        
        from django.conf import settings
        static_dir = os.path.join(settings.BASE_DIR, 'static')
        os.makedirs(static_dir, exist_ok=True)
        map_filepath = os.path.join(static_dir, map_filename)
        
        with open(map_filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        logger.info(f"Simple analysis map saved to {map_filepath}")
        
        return {
            'success': True,
            'map_url': f'/static/{map_filename}',
            'map_filename': map_filename,
            'fallback_url': f'/static/{map_filename}'
        }
        
    except Exception as e:
        logger.error(f"Error creating simple HTML map with analysis: {e}")
        return {
            'success': False,
            'error': str(e)
        }


def process_shapefile_to_coordinates(shapefile_obj):
    """
    Process uploaded shapefile and extract coordinates as WKT
    
    Args:
        shapefile_obj: Django uploaded file object
        
    Returns:
        str or None: WKT polygon string or None if failed
    """
    if not GEOPANDAS_AVAILABLE:
        logger.error("GeoPandas not available for shapefile processing")
        return None
    
    try:
        logger.info(f"Processing shapefile: {shapefile_obj.name}")
        
        # Create temporary directory for extraction
        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = os.path.join(temp_dir, shapefile_obj.name)
            
            # Save uploaded file
            with open(zip_path, 'wb+') as destination:
                for chunk in shapefile_obj.chunks():
                    destination.write(chunk)
            
            # Extract ZIP file
            try:
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)
                    
                    # Find all extracted files
                    extracted_files = []
                    for root, dirs, files in os.walk(temp_dir):
                        for file in files:
                            rel_path = os.path.relpath(os.path.join(root, file), temp_dir)
                            extracted_files.append(rel_path)
                    
            except zipfile.BadZipFile:
                logger.error("Invalid ZIP file")
                return None
            
            # Find shapefile components
            shp_files = [f for f in extracted_files if f.lower().endswith('.shp')]
            
            if not shp_files:
                logger.error("No .shp file found in the uploaded ZIP")
                return None
            
            if len(shp_files) > 1:
                logger.error(f"Multiple .shp files found: {shp_files}")
                return None
            
            shp_file = shp_files[0]
            shp_path = os.path.join(temp_dir, shp_file)
            
            # Read shapefile
            try:
                gdf = gpd.read_file(shp_path)
                
                if gdf.empty:
                    logger.error("Shapefile is empty")
                    return None
                
                # Convert to WGS84 if needed
                if gdf.crs != 'EPSG:4326':
                    gdf = gdf.to_crs('EPSG:4326')
                
                # Use the first feature if multiple features exist
                if len(gdf) > 1:
                    gdf = gdf.iloc[:1]
                
                # Get geometry as WKT
                geom = gdf.geometry.iloc[0]
                wkt = geom.wkt
                
                logger.info(f"Successfully extracted WKT: {wkt[:100]}...")
                return wkt
                
            except Exception as e:
                logger.error(f"Error reading shapefile: {str(e)}")
                return None
    
    except Exception as e:
        logger.error(f"Error processing shapefile: {str(e)}")
        return None

@api_view(["GET"])
def health_check(request):
    return Response({"status": "OK"}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([AllowAny])
def get_analysis_map(request):
    """Generate map visualization URL for analysis results"""
    try:
        # Import Earth Engine initialization
        from apps.earth_engine.ee_config import initialize_earth_engine, is_initialized
        
        if not is_initialized():
            if not initialize_earth_engine():
                return Response(
                    {"error": "Earth Engine not available"}, 
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )

        # Extract request data
        data = request.data
        analysis_type = data.get('analysis_type', 'ndvi')
        geometry_data = data.get('geometry')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        satellite = data.get('satellite', 'landsat')
        cloud_cover = data.get('cloud_cover', 20)

        if not all([geometry_data, start_date, end_date]):
            return Response(
                {"error": "Missing required parameters: geometry, start_date, end_date"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Convert geometry to Earth Engine format
        if isinstance(geometry_data, dict) and geometry_data.get('type') == 'Polygon':
            coords = geometry_data['coordinates'][0]
            geometry = ee.Geometry.Polygon(coords)
        else:
            return Response(
                {"error": "Invalid geometry format"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate visualization based on analysis type
        if analysis_type.lower() == 'ndvi':
            return generate_ndvi_visualization(geometry, start_date, end_date, satellite, cloud_cover)
        elif analysis_type.lower() == 'lst':
            return generate_lst_visualization(geometry, start_date, end_date, satellite, cloud_cover)
        else:
            return Response(
                {"error": f"Unsupported analysis type: {analysis_type}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

    except Exception as e:
        logger.error(f"Error generating map visualization: {str(e)}")
        return Response(
            {"error": f"Visualization error: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def generate_ndvi_visualization(geometry, start_date, end_date, satellite, cloud_cover):
    """Generate NDVI visualization"""
    try:
        # Create Landsat collection with all available missions
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
        
        # Landsat 7 (1999-present)
        if end_year >= 1999:
            l7 = (
                ee.ImageCollection("LANDSAT/LE07/C02/T1_L2")
                .filterDate(start_date, end_date)
                .filterBounds(geometry)
                .filter(ee.Filter.lt("CLOUD_COVER", cloud_cover))
            )
            collections.append(l7)
        
        # Landsat 8 (2013-present)
        if end_year >= 2013:
            l8 = (
                ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
                .filterDate(start_date, end_date)
                .filterBounds(geometry)
                .filter(ee.Filter.lt("CLOUD_COVER", cloud_cover))
            )
            collections.append(l8)

        # Landsat 9 (2021-present)
        if end_year >= 2021:
            l9 = (
                ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
                .filterDate(start_date, end_date)
                .filterBounds(geometry)
                .filter(ee.Filter.lt("CLOUD_COVER", cloud_cover))
            )
            collections.append(l9)

        if not collections:
            raise ValueError(f"No Landsat collections available for the specified date range: {start_date} to {end_date}")

        # Merge collections
        collection = collections[0]
        for coll in collections[1:]:
            collection = collection.merge(coll)
        collection = collection.sort('CLOUD_COVER').sort('system:time_start')
        
        if collection.size().getInfo() == 0:
            raise ValueError("No images found for the specified criteria")

        # Get median composite
        image = collection.median()
        
        # Calculate NDVI with support for all Landsat missions
        scale_factor = 0.0000275
        offset = -0.2
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
        
        # Calculate NDVI
        ndvi = nir.subtract(red).divide(nir.add(red)).rename("NDVI")
        
        # Clip to geometry
        ndvi_clipped = ndvi.clip(geometry)
        
        # Create visualization parameters
        vis_params = {
            'min': -1,
            'max': 1,
            'palette': ['red', 'yellow', 'green']
        }
        
        # Generate map ID and token
        map_id_dict = ee.Image(ndvi_clipped).getMapId(vis_params)
        
        # Get geometry bounds for map extent
        bounds = geometry.bounds().getInfo()
        
        return Response({
            'success': True,
            'map_id': map_id_dict['mapid'],
            'token': map_id_dict['token'],
            'tile_url': f"https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/{map_id_dict['mapid']}/tiles/{{z}}/{{x}}/{{y}}?token={map_id_dict['token']}",
            'bounds': bounds,
            'analysis_type': 'ndvi',
            'visualization_params': vis_params,
            'message': 'NDVI visualization generated successfully',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error generating NDVI visualization: {str(e)}")
        raise


def generate_sentinel2_visualization(geometry, start_date, end_date, satellite, cloud_cover):
    """Generate Sentinel-2 NDVI visualization"""
    try:
        # Create Sentinel-2 collection
        collection = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterDate(start_date, end_date)
            .filterBounds(geometry)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", cloud_cover))
        )
        
        if collection.size().getInfo() == 0:
            raise ValueError("No Sentinel-2 images found for the specified criteria")

        # Get median composite
        image = collection.median()
        
        # Calculate NDVI for Sentinel-2: B8=NIR, B4=Red
        # Scale factor for Sentinel-2 Surface Reflectance
        scale_factor = 0.0001  # Sentinel-2 SR is scaled by 10000
        scaled = image.multiply(scale_factor)
        
        nir = scaled.select('B8')  # Near-Infrared
        red = scaled.select('B4')  # Red
        
        # Calculate NDVI
        ndvi = nir.subtract(red).divide(nir.add(red)).rename("NDVI")
        
        # Apply cloud masking using SCL band
        scl = image.select('SCL')
        cloud_mask = scl.neq(9).And(scl.neq(8)).And(scl.neq(3))  # Remove clouds, cloud shadows, and medium prob clouds
        ndvi_masked = ndvi.updateMask(cloud_mask)
        
        # Clip to geometry
        ndvi_clipped = ndvi_masked.clip(geometry)
        
        # Create visualization parameters
        vis_params = {
            'min': -1,
            'max': 1,
            'palette': ['red', 'yellow', 'green']
        }
        
        # Generate map ID and token
        map_id_dict = ee.Image(ndvi_clipped).getMapId(vis_params)
        
        # Get geometry bounds for map extent
        bounds = geometry.bounds().getInfo()
        
        return Response({
            'success': True,
            'map_id': map_id_dict['mapid'],
            'token': map_id_dict['token'],
            'tile_url': f"https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/{map_id_dict['mapid']}/tiles/{{z}}/{{x}}/{{y}}?token={map_id_dict['token']}",
            'bounds': bounds,
            'analysis_type': 'ndvi',
            'satellite': 'sentinel2',
            'visualization_params': vis_params,
            'message': 'Sentinel-2 NDVI visualization generated successfully',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error generating Sentinel-2 NDVI visualization: {str(e)}")
        raise


def generate_lst_visualization(geometry, start_date, end_date, satellite, cloud_cover):
    """Generate LST visualization"""
    try:
        # Create Landsat collection with all available missions (thermal bands available in L5, L7, L8, L9)
        start_year = int(start_date.split("-")[0])
        end_year = int(end_date.split("-")[0])
        collections = []
        
        # Landsat 5 (1984-2013) - has thermal bands
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
        
        # Landsat 7 (1999-present) - has thermal bands
        if end_year >= 1999:
            l7 = (
                ee.ImageCollection("LANDSAT/LE07/C02/T1_L2")
                .filterDate(start_date, end_date)
                .filterBounds(geometry)
                .filter(ee.Filter.lt("CLOUD_COVER", cloud_cover))
            )
            collections.append(l7)
        
        # Landsat 8 (2013-present) - has thermal bands
        if end_year >= 2013:
            l8 = (
                ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
                .filterDate(start_date, end_date)
                .filterBounds(geometry)
                .filter(ee.Filter.lt("CLOUD_COVER", cloud_cover))
            )
            collections.append(l8)

        # Landsat 9 (2021-present) - has thermal bands
        if end_year >= 2021:
            l9 = (
                ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
                .filterDate(start_date, end_date)
                .filterBounds(geometry)
                .filter(ee.Filter.lt("CLOUD_COVER", cloud_cover))
            )
            collections.append(l9)

        if not collections:
            raise ValueError(f"No Landsat collections available for the specified date range: {start_date} to {end_date}")

        # Merge collections
        collection = collections[0]
        for coll in collections[1:]:
            collection = collection.merge(coll)
        collection = collection.sort('CLOUD_COVER').sort('system:time_start')
        
        if collection.size().getInfo() == 0:
            raise ValueError("No images found for the specified criteria")

        # Get median composite
        image = collection.median()
        
        # Calculate LST with support for all Landsat missions
        # Get band names to determine thermal band availability
        band_names = image.bandNames()
        
        # Check thermal band availability:
        # Landsat 8/9: ST_B10
        # Landsat 5/7: ST_B6
        has_st_b10 = band_names.contains('ST_B10')
        has_st_b6 = band_names.contains('ST_B6')
        
        # Select the appropriate thermal band
        thermal_band = ee.Algorithms.If(
            has_st_b10,
            image.select('ST_B10'),  # Landsat 8/9
            ee.Algorithms.If(
                has_st_b6,
                image.select('ST_B6'),   # Landsat 5/7
                None  # No thermal band available
            )
        )
        
        thermal_band = ee.Image(thermal_band)
        
        # Apply scale factor and offset, then convert to Celsius
        # Scale factor: 0.00341802, Offset: 149.0 (from Landsat Collection 2 docs)
        lst_celsius = thermal_band.multiply(0.00341802).add(149.0).subtract(273.15)
        
        # Clip to geometry
        lst_clipped = lst_celsius.clip(geometry)
        
        # Create visualization parameters (temperature in Celsius)
        vis_params = {
            'min': 0,
            'max': 40,
            'palette': ['blue', 'cyan', 'yellow', 'red']
        }
        
        # Generate map ID and token
        map_id_dict = ee.Image(lst_clipped).getMapId(vis_params)
        
        # Get geometry bounds for map extent
        bounds = geometry.bounds().getInfo()
        
        return Response({
            'success': True,
            'map_id': map_id_dict['mapid'],
            'token': map_id_dict['token'],
            'tile_url': f"https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/{map_id_dict['mapid']}/tiles/{{z}}/{{x}}/{{y}}?token={map_id_dict['token']}",
            'bounds': bounds,
            'analysis_type': 'lst',
            'visualization_params': vis_params,
            'message': 'LST visualization generated successfully',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error generating LST visualization: {str(e)}")
        raise


@api_view(["POST"])
@permission_classes([AllowAny])
def create_custom_map(request):
    """Create custom map compatible with React frontend expectations"""
    try:
        # Import Earth Engine initialization
        from apps.earth_engine.ee_config import initialize_earth_engine, is_initialized
        
        if not is_initialized():
            if not initialize_earth_engine():
                return Response(
                    {"success": False, "error": "Earth Engine not available"}, 
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )

        # Extract request data - handle both JSON and FormData
        if request.content_type and 'multipart/form-data' in request.content_type:
            # Handle shapefile upload (FormData)
            data = request.data
            project_id = data.get('project_id', 'ee-ayotundenew')
            satellite = data.get('satellite', 'landsat')
            analysis_type = data.get('analysis_type', 'ndvi')
            start_date = data.get('start_date')
            end_date = data.get('end_date')
            cloud_cover = int(data.get('cloud_cover', 20))
            selected_indices = data.get('selected_indices', '').split(',') if data.get('selected_indices') else []
            cloud_masking_level = data.get('cloud_masking_level', 'recommended')
            
            # Process shapefile to get coordinates
            shapefile = request.FILES.get('shapefile')
            if not shapefile:
                return Response(
                    {"success": False, "error": "Shapefile is required when using file upload"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Process shapefile to extract geometry
            coordinates = process_shapefile_to_coordinates(shapefile)
            if not coordinates:
                return Response(
                    {"success": False, "error": "Failed to process shapefile"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            # Handle JSON data
            data = request.data
            project_id = data.get('project_id', 'ee-ayotundenew')
            satellite = data.get('satellite', 'landsat')
            analysis_type = data.get('analysis_type', 'ndvi')
            start_date = data.get('start_date')
            end_date = data.get('end_date')
            cloud_cover = data.get('cloud_cover', 20)
            coordinates = data.get('coordinates')
            selected_indices_raw = data.get('selected_indices', [])
            # Handle both list and string formats for selected_indices
            if isinstance(selected_indices_raw, str):
                if selected_indices_raw == 'first_last':
                    selected_indices = ['first_last']
                else:
                    selected_indices = selected_indices_raw.split(',') if selected_indices_raw else []
            else:
                selected_indices = selected_indices_raw
            cloud_masking_level = data.get('cloud_masking_level', 'recommended')
        
        # Validate required parameters
        if not all([start_date, end_date, coordinates]):
            return Response(
                {"success": False, "error": "Missing required parameters: start_date, end_date, coordinates"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Convert coordinates to Earth Engine geometry
        try:
            if isinstance(coordinates, str) and coordinates.startswith('POLYGON'):
                # Parse WKT format: Handle various formats like:
                # POLYGON((-74.0059 40.7128, -74.0059 40.7628, ...))
                # POLYGON ((-74.0059 40.7128, -74.0059 40.7628, ...))
                # POLYGON(((-74.0059 40.7128, -74.0059 40.7628, ...)))
                
                # Remove POLYGON prefix and normalize
                coords_str = coordinates.upper().replace('POLYGON', '').strip()
                
                # Remove all parentheses and get the coordinate string
                coords_str = coords_str.strip('()')
                while coords_str.startswith('(') and coords_str.endswith(')'):
                    coords_str = coords_str[1:-1].strip()
                
                logger.info(f"Cleaned coordinate string: {coords_str[:100]}...")
                
                # Split by comma to get coordinate pairs
                coord_pairs = [pair.strip() for pair in coords_str.split(',')]
                coords = []
                
                for pair in coord_pairs:
                    if not pair.strip():
                        continue
                    
                    parts = pair.strip().split()
                    if len(parts) >= 2:
                        try:
                            lng, lat = float(parts[0]), float(parts[1])
                            coords.append([lng, lat])  # EE expects [lng, lat]
                        except ValueError as ve:
                            logger.error(f"Error parsing coordinate pair '{pair}': {ve}")
                            return Response(
                                {"success": False, "error": f"Invalid coordinate pair: {pair}"}, 
                                status=status.HTTP_400_BAD_REQUEST
                            )
                    else:
                        logger.warning(f"Skipping invalid coordinate pair: {pair}")
                
                if len(coords) < 3:
                    return Response(
                        {"success": False, "error": f"Invalid polygon: need at least 3 coordinate pairs, got {len(coords)}"}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Ensure polygon is closed (first and last points are the same)
                if coords[0] != coords[-1]:
                    coords.append(coords[0])
                
                logger.info(f"Successfully parsed {len(coords)} coordinate pairs")
                geometry = ee.Geometry.Polygon([coords])
                
            elif isinstance(coordinates, list):
                # Handle array format from drawn polygons
                try:
                    if len(coordinates) >= 3:  # Need at least 3 points for a polygon
                        if all(isinstance(coord, list) and len(coord) == 2 for coord in coordinates):
                            # Format is already [[lng, lat], [lng, lat], ...]
                            coords = coordinates
                        else:
                            # Format is [lat, lng, lat, lng, ...]
                            coords = []
                            for i in range(0, len(coordinates), 2):
                                if i + 1 < len(coordinates):
                                    coords.append([coordinates[i+1], coordinates[i]])  # Convert to [lng, lat]
                        
                        # Ensure the polygon is closed
                        if coords[0] != coords[-1]:
                            coords.append(coords[0])
                        
                        geometry = ee.Geometry.Polygon([coords])
                        logger.info(f"Created polygon from {len(coords)} coordinate pairs")
                    else:
                        return Response(
                            {"success": False, "error": "Need at least 3 points to create a polygon"}, 
                            status=status.HTTP_400_BAD_REQUEST
                        )
                except Exception as e:
                    logger.error(f"Error processing coordinate array: {str(e)}")
                    return Response(
                        {"success": False, "error": f"Invalid coordinate array format: {str(e)}"}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                return Response(
                    {"success": False, "error": "Invalid coordinates format. Expected WKT POLYGON or coordinate array"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except Exception as e:
            logger.error(f"Error parsing coordinates: {str(e)}")
            return Response(
                {"success": False, "error": f"Error parsing coordinates: {str(e)}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create interactive map with calculated analysis layers (Flask-style functionality)
        logger.info(f"Creating interactive map for {analysis_type} analysis using {satellite}")
        
        # Validate analysis type for satellite combination
        if analysis_type.lower() == 'lst' and satellite.lower() == 'sentinel2':
            return Response(
                {"success": False, "error": "LST analysis not available for Sentinel-2 (no thermal bands)"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if analysis_type.lower() == 'backscatter' and satellite.lower() != 'sentinel1':
            return Response(
                {"success": False, "error": "Backscatter analysis only available for Sentinel-1"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create interactive map with calculated analysis layers
        try:
            map_result = create_interactive_map(
                geometry=geometry,
                analysis_type=analysis_type,
                start_date=start_date,
                end_date=end_date,
                satellite=satellite,
                cloud_cover=cloud_cover,
                selected_images=selected_indices,
                cloud_masking_level=cloud_masking_level
            )
            
            if map_result.get('success'):
                logger.info(f"Successfully created interactive map: {map_result.get('map_filename')}")
                return Response({
                    'success': True,
                    'map_url': map_result.get('map_url'),
                    'fallback_url': map_result.get('fallback_url'),
                    'analysis_type': analysis_type,
                    'satellite': satellite,
                    'message': f'{analysis_type.upper()} interactive map created successfully with calculated layers'
                })
            else:
                logger.error(f"Failed to create interactive map: {map_result.get('error')}")
                return Response({
                    'success': False,
                    'error': map_result.get('error', 'Failed to create interactive map')
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except Exception as e:
            logger.error(f"Exception creating interactive map: {str(e)}")
            return Response({
                'success': False,
                'error': f'Interactive map creation failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except Exception as e:
        logger.error(f"Error creating custom map: {str(e)}")
        return Response(
            {"success": False, "error": f"Custom map creation error: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
