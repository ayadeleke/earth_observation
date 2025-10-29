
import os
import tempfile
import zipfile
import logging

logger = logging.getLogger(__name__)

# Try to import geopandas
try:
    import geopandas as gpd
    GEOPANDAS_AVAILABLE = True
except ImportError:
    GEOPANDAS_AVAILABLE = False
    gpd = None


def process_shapefile_to_coordinates(shapefile_obj):
    """
    Process uploaded shapefile and extract coordinates as WKT
    
    Args:
        shapefile_obj: Django uploaded file object (ZIP file containing shapefile components)
        
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
