"""
Comprehensive Analysis module for multi-satellite and trend analysis.
Handles combined NDVI/LST analysis, trend detection, and composite analysis.
"""

import logging
import ee
import numpy as np
from datetime import datetime, timedelta
from .earth_engine import get_landsat_collection, get_sentinel2_collection, validate_coordinates
from .ndvi_analysis import process_landsat_ndvi_analysis, process_sentinel2_ndvi_analysis
from .lst_analysis import process_lst_analysis
from .sar_analysis import process_sar_analysis

logger = logging.getLogger(__name__)


def process_comprehensive_analysis(geometry, start_date, end_date, analysis_types=['ndvi', 'lst'], satellite="landsat", cloud_cover=20, use_cloud_masking=False, strict_masking=False):
    """Process comprehensive analysis combining multiple indicators"""
    try:
        logger.info(f"Processing comprehensive analysis: {analysis_types} using {satellite}")
        
        results = {
            "success": True,
            "demo_mode": False,
            "analysis_type": "Comprehensive",
            "satellite": satellite.title(),
            "components": analysis_types,
            "data": [],
            "statistics": {},
            "message": "",
            "timestamp": datetime.now().isoformat(),
        }
        
        # Process each analysis type
        component_results = {}
        
        if 'ndvi' in analysis_types:
            try:
                if satellite.lower() == "landsat":
                    ndvi_result = process_landsat_ndvi_analysis(geometry, start_date, end_date, cloud_cover)
                else:
                    ndvi_result = process_sentinel2_ndvi_analysis(geometry, start_date, end_date, cloud_cover)
                component_results['ndvi'] = ndvi_result
                logger.info("NDVI component completed successfully")
            except Exception as e:
                logger.error(f"NDVI component failed: {str(e)}")
                component_results['ndvi'] = {"success": False, "error": str(e)}
        
        if 'lst' in analysis_types:
            try:
                lst_result = process_lst_analysis(geometry, start_date, end_date, cloud_cover, use_cloud_masking, strict_masking)
                component_results['lst'] = lst_result
                logger.info("LST component completed successfully")
            except Exception as e:
                logger.error(f"LST component failed: {str(e)}")
                component_results['lst'] = {"success": False, "error": str(e)}
        
        if 'sar' in analysis_types:
            try:
                sar_result = process_sar_analysis(geometry, start_date, end_date)
                component_results['sar'] = sar_result
                logger.info("SAR component completed successfully")
            except Exception as e:
                logger.error(f"SAR component failed: {str(e)}")
                component_results['sar'] = {"success": False, "error": str(e)}
        
        # Combine results for detailed data table (individual images)
        combined_data = combine_analysis_results(component_results)
        
        # Combine time series data (annual means) for plots
        combined_time_series = combine_time_series_data(component_results)
        
        # Sort both datasets chronologically
        if combined_data:
            combined_data.sort(key=lambda x: x.get('date', ''))
            logger.info(f"Sorted {len(combined_data)} combined individual data points chronologically")
        
        if combined_time_series:
            combined_time_series.sort(key=lambda x: x.get('date', ''))
            logger.info(f"Sorted {len(combined_time_series)} combined time series data points chronologically")
        
        results['data'] = combined_data  # Individual images for data table
        results['time_series_data'] = combined_time_series  # Annual means for time series plots
        
        # Calculate comprehensive statistics
        comprehensive_stats = calculate_comprehensive_statistics(component_results)
        results['statistics'] = comprehensive_stats
        
        # Generate summary message
        successful_components = [comp for comp, result in component_results.items() if result.get('success', False)]
        failed_components = [comp for comp, result in component_results.items() if not result.get('success', False)]
        
        if successful_components:
            results['message'] = f"Comprehensive analysis completed. Successful: {', '.join(successful_components)}"
            if failed_components:
                results['message'] += f". Failed: {', '.join(failed_components)}"
        else:
            results['success'] = False
            results['message'] = f"All components failed: {', '.join(failed_components)}"
        
        logger.info(f"Comprehensive analysis completed with {len(successful_components)} successful components")
        return results
        
    except Exception as e:
        logger.error(f"Comprehensive analysis error: {str(e)}")
        raise


def process_trend_analysis(geometry, start_date, end_date, analysis_type='ndvi', satellite="landsat", cloud_cover=20, time_window='monthly'):
    """Process trend analysis over time for specified indicator"""
    try:
        logger.info(f"Processing {analysis_type} trend analysis from {start_date} to {end_date}")
        
        # Generate time periods based on time_window
        time_periods = generate_time_periods(start_date, end_date, time_window)
        
        trend_data = []
        
        for period in time_periods:
            period_start = period['start']
            period_end = period['end']
            
            try:
                if analysis_type.lower() == 'ndvi':
                    if satellite.lower() == "landsat":
                        result = process_landsat_ndvi_analysis(geometry, period_start, period_end, cloud_cover)
                    else:
                        result = process_sentinel2_ndvi_analysis(geometry, period_start, period_end, cloud_cover)
                    
                    if result.get('success') and result.get('statistics'):
                        trend_data.append({
                            "period": period['label'],
                            "start_date": period_start,
                            "end_date": period_end,
                            "mean_value": result['statistics'].get('mean_ndvi', 0),
                            "min_value": result['statistics'].get('min_ndvi', 0),
                            "max_value": result['statistics'].get('max_ndvi', 0),
                            "std_value": result['statistics'].get('std_ndvi', 0),
                            "data_points": len(result.get('data', [])),
                            "analysis_type": "NDVI"
                        })
                
                elif analysis_type.lower() == 'lst':
                    result = process_lst_analysis(geometry, period_start, period_end, cloud_cover, use_cloud_masking, strict_masking)
                    
                    if result.get('success') and result.get('statistics'):
                        trend_data.append({
                            "period": period['label'],
                            "start_date": period_start,
                            "end_date": period_end,
                            "mean_value": result['statistics'].get('mean_lst', 0),
                            "min_value": result['statistics'].get('min_lst', 0),
                            "max_value": result['statistics'].get('max_lst', 0),
                            "std_value": result['statistics'].get('std_lst', 0),
                            "data_points": len(result.get('data', [])),
                            "analysis_type": "LST"
                        })
                
            except Exception as period_error:
                logger.warning(f"Failed to process period {period['label']}: {str(period_error)}")
                continue
        
        # Calculate trend statistics
        trend_stats = calculate_trend_statistics(trend_data)
        
        return {
            "success": True,
            "demo_mode": False,
            "analysis_type": f"{analysis_type.upper()} Trends",
            "satellite": satellite.title(),
            "time_window": time_window,
            "data": trend_data,
            "statistics": trend_stats,
            "message": f"Trend analysis completed with {len(trend_data)} time periods",
            "timestamp": datetime.now().isoformat(),
        }
        
    except Exception as e:
        logger.error(f"Trend analysis error: {str(e)}")
        raise


def process_composite_analysis(geometry, start_date, end_date, satellite="landsat", cloud_cover=20, composite_method='median'):
    """Process composite analysis using multiple time periods"""
    try:
        logger.info(f"Processing {composite_method} composite analysis from {start_date} to {end_date}")
        
        if satellite.lower() == "landsat":
            collection = get_landsat_collection(geometry, start_date, end_date, cloud_cover)
        else:
            collection = get_sentinel2_collection(geometry, start_date, end_date, cloud_cover)
        
        # Apply composite method
        if composite_method == 'median':
            composite = collection.median()
        elif composite_method == 'mean':
            composite = collection.mean()
        elif composite_method == 'max':
            composite = collection.max()
        elif composite_method == 'min':
            composite = collection.min()
        else:
            composite = collection.median()  # Default to median
        
        # Calculate multiple indices for the composite
        if satellite.lower() == "landsat":
            indices = calculate_landsat_indices(composite)
        else:
            indices = calculate_sentinel2_indices(composite)
        
        # Get statistics for each index
        stats = {}
        for index_name, index_image in indices.items():
            index_stats = index_image.reduceRegion(
                reducer=ee.Reducer.mean()
                .combine(reducer2=ee.Reducer.minMax(), sharedInputs=True)
                .combine(reducer2=ee.Reducer.stdDev(), sharedInputs=True),
                geometry=geometry,
                scale=30 if satellite.lower() == "landsat" else 10,
                maxPixels=1e9,
            ).getInfo()
            
            stats[index_name] = {
                "mean": round(index_stats.get(f"{index_name}_mean", 0), 4),
                "min": round(index_stats.get(f"{index_name}_min", 0), 4),
                "max": round(index_stats.get(f"{index_name}_max", 0), 4),
                "std": round(index_stats.get(f"{index_name}_stdDev", 0), 4)
            }
        
        # Calculate area statistics
        area_km2 = geometry.area().divide(1000000).getInfo()
        
        return {
            "success": True,
            "demo_mode": False,
            "analysis_type": f"{composite_method.title()} Composite",
            "satellite": satellite.title(),
            "indices": list(indices.keys()),
            "data": [],  # Could add sampling points if needed
            "statistics": {
                "composite_method": composite_method,
                "area_km2": round(area_km2, 2),
                "date_range": f"{start_date} to {end_date}",
                "indices": stats
            },
            "message": f"{composite_method.title()} composite analysis completed with {len(indices)} indices",
            "timestamp": datetime.now().isoformat(),
        }
        
    except Exception as e:
        logger.error(f"Composite analysis error: {str(e)}")
        raise


def combine_analysis_results(component_results):
    """Combine data from multiple analysis components by matching dates"""
    try:
        # Collect all unique dates from all components
        all_dates = set()
        component_data_by_date = {}
        
        for comp, result in component_results.items():
            if result.get('success') and result.get('data'):
                component_data_by_date[comp] = {}
                for data_point in result['data']:
                    date = data_point.get('date', '')
                    if date:
                        all_dates.add(date)
                        component_data_by_date[comp][date] = data_point
        
        if not all_dates:
            return []
        
        # Sort dates chronologically
        sorted_dates = sorted(list(all_dates))
        combined_data = []
        
        # Combine data points for each date
        for date in sorted_dates:
            # Get reference data point (preferably from NDVI component)
            ref_point = None
            for comp in ['ndvi', 'lst', 'sar']:  # Priority order
                if comp in component_data_by_date and date in component_data_by_date[comp]:
                    ref_point = component_data_by_date[comp][date]
                    break
            
            if not ref_point:
                continue
                
            combined_point = {
                "date": date,
                "lat": ref_point.get('lat', 0),
                "lon": ref_point.get('lon', 0),
                "image_id": ref_point.get('image_id', ''),
                "satellite": ref_point.get('satellite', '')
            }
            
            # Add values from each component for this date
            for comp, comp_data_dict in component_data_by_date.items():
                if date in comp_data_dict:
                    comp_data = comp_data_dict[date]
                    
                    if comp == 'ndvi':
                        combined_point['ndvi'] = comp_data.get('ndvi', 0)
                        combined_point['cloud_cover'] = comp_data.get('cloud_cover', 0)
                        combined_point['effective_cloud_cover'] = comp_data.get('effective_cloud_cover', 0)
                    elif comp == 'lst':
                        combined_point['lst'] = comp_data.get('lst', 0)
                    elif comp == 'sar':
                        combined_point['vv_backscatter'] = comp_data.get('vv_backscatter', 0)
                        combined_point['vh_backscatter'] = comp_data.get('vh_backscatter', 0)
                        combined_point['backscatter'] = comp_data.get('backscatter', comp_data.get('vv_backscatter', 0))
            
            combined_data.append(combined_point)
        
        logger.info(f"Combined data from {len(component_data_by_date)} components across {len(sorted_dates)} dates")
        return combined_data
        
    except Exception as e:
        logger.error(f"Error combining analysis results: {str(e)}")
        return []


def combine_time_series_data(component_results):
    """Combine time series data (annual means) from multiple analysis components"""
    try:
        # Collect all unique dates from time series data
        all_dates = set()
        component_ts_data_by_date = {}
        
        for comp, result in component_results.items():
            if result.get('success') and result.get('time_series_data'):
                component_ts_data_by_date[comp] = {}
                for data_point in result['time_series_data']:
                    date = data_point.get('date', '')
                    if date:
                        all_dates.add(date)
                        component_ts_data_by_date[comp][date] = data_point
        
        if not all_dates:
            return []
        
        # Sort dates chronologically
        sorted_dates = sorted(list(all_dates))
        combined_ts_data = []
        
        # Combine time series data points for each date
        for date in sorted_dates:
            # Get reference data point (preferably from NDVI component)
            ref_point = None
            for comp in ['ndvi', 'lst', 'sar']:  # Priority order
                if comp in component_ts_data_by_date and date in component_ts_data_by_date[comp]:
                    ref_point = component_ts_data_by_date[comp][date]
                    break
            
            if not ref_point:
                continue
                
            combined_point = {
                "date": date,
                "lat": ref_point.get('lat', 0),
                "lon": ref_point.get('lon', 0),
                "image_id": ref_point.get('image_id', ''),
                "satellite": ref_point.get('satellite', ''),
                "analysis_type": "Comprehensive Annual Mean"
            }
            
            # Add values from each component for this date
            for comp, comp_ts_data_dict in component_ts_data_by_date.items():
                if date in comp_ts_data_dict:
                    comp_data = comp_ts_data_dict[date]
                    
                    if comp == 'ndvi':
                        combined_point['ndvi'] = comp_data.get('ndvi', 0)
                        combined_point['cloud_cover'] = comp_data.get('cloud_cover', 0)
                        combined_point['annual_observations'] = comp_data.get('annual_observations', 0)
                    elif comp == 'lst':
                        combined_point['lst'] = comp_data.get('lst', 0)
                    elif comp == 'sar':
                        combined_point['vv_backscatter'] = comp_data.get('vv_backscatter', 0)
                        combined_point['vh_backscatter'] = comp_data.get('vh_backscatter', 0)
                        combined_point['backscatter'] = comp_data.get('backscatter', comp_data.get('vv_backscatter', 0))
            
            combined_ts_data.append(combined_point)
        
        logger.info(f"Combined time series data from {len(component_ts_data_by_date)} components across {len(sorted_dates)} annual points")
        return combined_ts_data
        
    except Exception as e:
        logger.error(f"Error combining time series data: {str(e)}")
        return []


def calculate_comprehensive_statistics(component_results):
    """Calculate comprehensive statistics from multiple components"""
    try:
        comp_stats = {}
        
        for comp, result in component_results.items():
            if result.get('success') and result.get('statistics'):
                comp_stats[comp] = result['statistics']
        
        # Add correlation analysis if multiple components
        if len(comp_stats) > 1:
            correlations = calculate_component_correlations(component_results)
            comp_stats['correlations'] = correlations
        
        return comp_stats
        
    except Exception as e:
        logger.error(f"Error calculating comprehensive statistics: {str(e)}")
        return {}


def calculate_component_correlations(component_results):
    """Calculate correlations between different analysis components"""
    try:
        correlations = {}
        
        # Extract data arrays for correlation
        data_arrays = {}
        for comp, result in component_results.items():
            if result.get('success') and result.get('data'):
                if comp == 'ndvi':
                    data_arrays['ndvi'] = [point.get('ndvi', 0) for point in result['data']]
                elif comp == 'lst':
                    data_arrays['lst'] = [point.get('lst', 0) for point in result['data']]
                elif comp == 'sar':
                    data_arrays['vv'] = [point.get('vv_backscatter', 0) for point in result['data']]
                    data_arrays['vh'] = [point.get('vh_backscatter', 0) for point in result['data']]
        
        # Calculate correlations between components
        components = list(data_arrays.keys())
        for i, comp1 in enumerate(components):
            for comp2 in components[i+1:]:
                if len(data_arrays[comp1]) == len(data_arrays[comp2]) and len(data_arrays[comp1]) > 1:
                    corr_coef = np.corrcoef(data_arrays[comp1], data_arrays[comp2])[0, 1]
                    correlations[f"{comp1}_vs_{comp2}"] = round(corr_coef, 4) if not np.isnan(corr_coef) else 0
        
        return correlations
        
    except Exception as e:
        logger.error(f"Error calculating correlations: {str(e)}")
        return {}


def generate_time_periods(start_date, end_date, time_window):
    """Generate time periods for trend analysis"""
    try:
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = datetime.strptime(end_date, '%Y-%m-%d')
        
        periods = []
        current_dt = start_dt
        
        if time_window == 'monthly':
            while current_dt <= end_dt:
                period_end = current_dt.replace(day=28) + timedelta(days=4)
                period_end = period_end - timedelta(days=period_end.day)
                if period_end > end_dt:
                    period_end = end_dt
                
                periods.append({
                    'start': current_dt.strftime('%Y-%m-%d'),
                    'end': period_end.strftime('%Y-%m-%d'),
                    'label': current_dt.strftime('%Y-%m')
                })
                
                # Move to next month
                if current_dt.month == 12:
                    current_dt = current_dt.replace(year=current_dt.year + 1, month=1)
                else:
                    current_dt = current_dt.replace(month=current_dt.month + 1)
        
        elif time_window == 'quarterly':
            while current_dt <= end_dt:
                quarter = (current_dt.month - 1) // 3 + 1
                quarter_end_month = quarter * 3
                period_end = current_dt.replace(month=quarter_end_month, day=28) + timedelta(days=4)
                period_end = period_end - timedelta(days=period_end.day)
                if period_end > end_dt:
                    period_end = end_dt
                
                periods.append({
                    'start': current_dt.strftime('%Y-%m-%d'),
                    'end': period_end.strftime('%Y-%m-%d'),
                    'label': f"{current_dt.year}-Q{quarter}"
                })
                
                # Move to next quarter
                if quarter == 4:
                    current_dt = current_dt.replace(year=current_dt.year + 1, month=1)
                else:
                    current_dt = current_dt.replace(month=(quarter * 3) + 1)
        
        elif time_window == 'yearly':
            while current_dt <= end_dt:
                period_end = current_dt.replace(month=12, day=31)
                if period_end > end_dt:
                    period_end = end_dt
                
                periods.append({
                    'start': current_dt.strftime('%Y-%m-%d'),
                    'end': period_end.strftime('%Y-%m-%d'),
                    'label': str(current_dt.year)
                })
                
                current_dt = current_dt.replace(year=current_dt.year + 1, month=1)
        
        return periods
        
    except Exception as e:
        logger.error(f"Error generating time periods: {str(e)}")
        return []


def calculate_trend_statistics(trend_data):
    """Calculate trend statistics from time series data"""
    try:
        if not trend_data:
            return {}
        
        values = [point['mean_value'] for point in trend_data]
        
        # Basic statistics
        stats = {
            "periods_count": len(trend_data),
            "overall_mean": round(np.mean(values), 4),
            "overall_std": round(np.std(values), 4),
            "overall_min": round(np.min(values), 4),
            "overall_max": round(np.max(values), 4),
            "value_range": round(np.max(values) - np.min(values), 4)
        }
        
        # Trend calculation
        if len(values) > 1:
            x = np.arange(len(values))
            trend_slope, trend_intercept = np.polyfit(x, values, 1)
            
            stats["trend_slope"] = round(trend_slope, 6)
            stats["trend_direction"] = "increasing" if trend_slope > 0 else "decreasing" if trend_slope < 0 else "stable"
            
            # Calculate R-squared for trend fit
            y_pred = trend_slope * x + trend_intercept
            ss_res = np.sum((values - y_pred) ** 2)
            ss_tot = np.sum((values - np.mean(values)) ** 2)
            r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
            stats["trend_r_squared"] = round(r_squared, 4)
        
        return stats
        
    except Exception as e:
        logger.error(f"Error calculating trend statistics: {str(e)}")
        return {}


def calculate_landsat_indices(image):
    """Calculate multiple vegetation and water indices for Landsat"""
    try:
        # Scale image
        scale_factor = 0.0000275
        offset = -0.2
        scaled = image.multiply(scale_factor).add(offset)
        
        # Band selections
        nir = scaled.select("SR_B5")
        red = scaled.select("SR_B4")
        green = scaled.select("SR_B3")
        blue = scaled.select("SR_B2")
        swir1 = scaled.select("SR_B6")
        swir2 = scaled.select("SR_B7")
        
        indices = {}
        
        # NDVI (Normalized Difference Vegetation Index)
        indices['NDVI'] = nir.subtract(red).divide(nir.add(red)).rename('NDVI')
        
        # NDWI (Normalized Difference Water Index)
        indices['NDWI'] = green.subtract(nir).divide(green.add(nir)).rename('NDWI')
        
        # NDBI (Normalized Difference Built-up Index)
        indices['NDBI'] = swir1.subtract(nir).divide(swir1.add(nir)).rename('NDBI')
        
        # EVI (Enhanced Vegetation Index)
        indices['EVI'] = ee.Image(2.5).multiply(
            nir.subtract(red).divide(
                nir.add(red.multiply(6)).subtract(blue.multiply(7.5)).add(1)
            )
        ).rename('EVI')
        
        return indices
        
    except Exception as e:
        logger.error(f"Error calculating Landsat indices: {str(e)}")
        return {}


def calculate_sentinel2_indices(image):
    """Calculate multiple vegetation and water indices for Sentinel-2"""
    try:
        # Band selections
        nir = image.select('B8')
        red = image.select('B4')
        green = image.select('B3')
        blue = image.select('B2')
        swir1 = image.select('B11')
        swir2 = image.select('B12')
        
        indices = {}
        
        # NDVI
        indices['NDVI'] = nir.subtract(red).divide(nir.add(red)).rename('NDVI')
        
        # NDWI
        indices['NDWI'] = green.subtract(nir).divide(green.add(nir)).rename('NDWI')
        
        # NDBI
        indices['NDBI'] = swir1.subtract(nir).divide(swir1.add(nir)).rename('NDBI')
        
        # EVI
        indices['EVI'] = ee.Image(2.5).multiply(
            nir.subtract(red).divide(
                nir.add(red.multiply(6)).subtract(blue.multiply(7.5)).add(1)
            )
        ).rename('EVI')
        
        return indices
        
    except Exception as e:
        logger.error(f"Error calculating Sentinel-2 indices: {str(e)}")
        return {}