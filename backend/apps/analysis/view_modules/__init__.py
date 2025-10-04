"""
Analysis views package - modular components for Earth observation analysis.
"""

# Import key functions for easy access
from .earth_engine import wkt_to_ee_geometry, validate_coordinates, get_landsat_collection
from .ndvi_analysis import process_ndvi_analysis, process_landsat_ndvi_analysis
from .lst_analysis import process_lst_analysis
from .sar_analysis import process_sar_analysis
from .comprehensive_analysis import (
    process_comprehensive_analysis,
    process_trend_analysis,
    process_composite_analysis
)
from .data_processing import (
    validate_analysis_request,
    export_to_csv,
    create_plot,
    format_response_data,
    calculate_statistics
)

__all__ = [
    'wkt_to_ee_geometry',
    'validate_coordinates', 
    'get_landsat_collection',
    'process_ndvi_analysis',
    'process_landsat_ndvi_analysis',
    'process_lst_analysis',
    'process_sar_analysis',
    'process_comprehensive_analysis',
    'process_trend_analysis',
    'process_composite_analysis',
    'validate_analysis_request',
    'export_to_csv',
    'create_plot',
    'format_response_data',
    'calculate_statistics'
]