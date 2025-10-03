import json
from shapely.geometry import shape, Polygon, mapping
from shapely.wkt import loads, dumps

class ShapefileHandler:
    @staticmethod
    def parse_coordinates(coords_array):
        """
        Parse coordinates array into a WKT polygon string.
        Args:
            coords_array: Array of coordinate pairs [[lng1, lat1], [lng2, lat2], ...]
        Returns:
            WKT polygon string
        """
        if not coords_array or len(coords_array) < 3:
            raise ValueError("At least 3 coordinates are required to form a polygon")
        
        # Create a polygon from coordinates
        polygon = Polygon(coords_array)
        
        # Validate polygon
        if not polygon.is_valid:
            raise ValueError("Invalid polygon: The coordinates do not form a valid polygon")
            
        # Convert to WKT format
        return dumps(polygon)

    @staticmethod
    def parse_geojson(geojson_str):
        """
        Parse GeoJSON string into a WKT string.
        Args:
            geojson_str: GeoJSON string containing polygon coordinates
        Returns:
            WKT polygon string
        """
        try:
            geojson = json.loads(geojson_str)
            geometry = shape(geojson)
            return dumps(geometry)
        except Exception as e:
            raise ValueError(f"Error parsing GeoJSON: {str(e)}")

    @staticmethod
    def wkt_to_geojson(wkt_str):
        """
        Convert WKT string to GeoJSON format.
        Args:
            wkt_str: WKT polygon string
        Returns:
            GeoJSON formatted dictionary
        """
        try:
            geometry = loads(wkt_str)
            return mapping(geometry)
        except Exception as e:
            raise ValueError(f"Error converting WKT to GeoJSON: {str(e)}")