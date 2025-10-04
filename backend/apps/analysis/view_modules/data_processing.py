"""
Data processing utilities for Earth observation analysis.
Handles data validation, CSV export, visualization, and common operations.
"""

import json
import logging
import pandas as pd
import numpy as np

# Configure matplotlib to use non-interactive backend for Django
import matplotlib
matplotlib.use('Agg')  # Use non-GUI backend
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
from django.conf import settings
import os

logger = logging.getLogger(__name__)


def validate_analysis_request(data):
    """Validate analysis request data"""
    try:
        required_fields = ['aoi_data', 'analysis_type', 'start_date', 'end_date']
        missing_fields = [field for field in required_fields if field not in data or not data[field]]

        if missing_fields:
            return False, f"Missing required fields: {', '.join(missing_fields)}"

        # Validate dates
        try:
            start_date = datetime.strptime(data['start_date'], '%Y-%m-%d')
            end_date = datetime.strptime(data['end_date'], '%Y-%m-%d')

            if start_date >= end_date:
                return False, "Start date must be before end date"

            # Support Landsat missions from 1984 onwards (Landsat 5 era)
            if start_date.year < 1984:
                return False, "Start date cannot be before 1984 (Landsat 5 launch)"

        except ValueError as e:
            return False, f"Invalid date format: {str(e)}"

        # Validate analysis type
        valid_types = ['ndvi', 'lst', 'sar', 'trends', 'composite']
        if data['analysis_type'].lower() not in valid_types:
            return False, f"Invalid analysis type. Must be one of: {', '.join(valid_types)}"

        # Validate AOI data
        try:
            if isinstance(data['aoi_data'], str):
                aoi_json = json.loads(data['aoi_data'])
            else:
                aoi_json = data['aoi_data']

            if 'features' not in aoi_json or not aoi_json['features']:
                return False, "AOI data must contain at least one feature"

        except (json.JSONDecodeError, TypeError) as e:
            return False, f"Invalid AOI data format: {str(e)}"

        return True, "Valid request"

    except Exception as e:
        logger.error(f"Validation error: {str(e)}")
        return False, f"Validation error: {str(e)}"


def export_to_csv(data, filename_prefix, analysis_type):
    """Export analysis data to CSV file"""
    try:
        if not data:
            logger.warning("No data to export")
            return None

        # Create pandas DataFrame
        df = pd.DataFrame(data)

        # Generate filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{filename_prefix}_{timestamp}.csv"

        # Ensure media directory exists
        csv_dir = os.path.join(settings.MEDIA_ROOT, 'csv')
        os.makedirs(csv_dir, exist_ok=True)

        # Full file path
        file_path = os.path.join(csv_dir, filename)

        # Export to CSV
        df.to_csv(file_path, index=False)

        logger.info(f"Data exported to {filename}")

        # Return relative path for URL generation
        return os.path.join('csv', filename)

    except Exception as e:
        logger.error(f"CSV export error: {str(e)}")
        return None


def create_plot(data, analysis_type, filename_prefix):
    """Create visualization plot for analysis data"""
    try:
        if not data:
            logger.warning("No data to plot")
            return None

        # Create pandas DataFrame
        df = pd.DataFrame(data)

        # Set up the plot
        plt.figure(figsize=(12, 8))

        if analysis_type.lower() == 'ndvi':
            create_ndvi_plot(df)
        elif analysis_type.lower() == 'lst':
            create_lst_plot(df)
        elif analysis_type.lower() == 'sar':
            create_sar_plot(df)
        else:
            create_generic_plot(df, analysis_type)

        # Generate filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{filename_prefix}_plot_{timestamp}.png"

        # Ensure plots directory exists
        plots_dir = os.path.join(settings.MEDIA_ROOT, 'plots')
        os.makedirs(plots_dir, exist_ok=True)

        # Full file path
        file_path = os.path.join(plots_dir, filename)

        # Save plot
        plt.tight_layout()
        plt.savefig(file_path, dpi=300, bbox_inches='tight')
        plt.close()

        logger.info(f"Plot saved to {filename}")

        # Return relative path for URL generation
        return os.path.join('plots', filename)

    except Exception as e:
        logger.error(f"Plot creation error: {str(e)}")
        plt.close()  # Ensure plot is closed even on error
        return None


def create_ndvi_plot(df):
    """Create NDVI-specific plot"""
    try:
        # Filter out any invalid dates before processing
        if 'date' in df.columns:
            # Remove rows with invalid dates
            df = df[df['date'] != 'Unknown']
            df = df.dropna(subset=['date'])

            if df.empty:
                raise ValueError("No valid dates found in NDVI data")

            # Convert date strings to datetime with error handling
            df['date'] = pd.to_datetime(df['date'], errors='coerce')
            # Remove any rows that failed to parse
            df = df.dropna(subset=['date'])
            df = df.sort_values('date')

        # Create subplots
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))

        # Time series plot
        if 'date' in df.columns and 'ndvi' in df.columns:
            axes[0, 0].plot(df['date'], df['ndvi'], marker='o', linewidth=2, markersize=6)
            axes[0, 0].set_title('NDVI Time Series', fontsize=14, fontweight='bold')
            axes[0, 0].set_xlabel('Date')
            axes[0, 0].set_ylabel('NDVI')
            axes[0, 0].grid(True, alpha=0.3)

        # NDVI distribution
        if 'ndvi' in df.columns:
            axes[0, 1].hist(df['ndvi'], bins=20, alpha=0.7, color='green', edgecolor='black')
            axes[0, 1].set_title('NDVI Distribution', fontsize=14, fontweight='bold')
            axes[0, 1].set_xlabel('NDVI')
            axes[0, 1].set_ylabel('Frequency')
            axes[0, 1].grid(True, alpha=0.3)

        # Spatial distribution
        if 'lat' in df.columns and 'lon' in df.columns and 'ndvi' in df.columns:
            scatter = axes[1, 0].scatter(df['lon'], df['lat'], c=df['ndvi'],
                                       cmap='RdYlGn', s=100, alpha=0.7)
            axes[1, 0].set_title('NDVI Spatial Distribution', fontsize=14, fontweight='bold')
            axes[1, 0].set_xlabel('Longitude')
            axes[1, 0].set_ylabel('Latitude')
            plt.colorbar(scatter, ax=axes[1, 0], label='NDVI')

        # Cloud cover vs NDVI
        if 'cloud_cover' in df.columns and 'ndvi' in df.columns:
            axes[1, 1].scatter(df['cloud_cover'], df['ndvi'], alpha=0.7, s=60)
            axes[1, 1].set_title('Cloud Cover vs NDVI', fontsize=14, fontweight='bold')
            axes[1, 1].set_xlabel('Cloud Cover (%)')
            axes[1, 1].set_ylabel('NDVI')
            axes[1, 1].grid(True, alpha=0.3)

        plt.suptitle('NDVI Analysis Results', fontsize=16, fontweight='bold')

    except Exception as e:
        logger.error(f"NDVI plot creation error: {str(e)}")
        raise


def create_lst_plot(df):
    """Create LST-specific plot"""
    try:
        # Filter out any invalid dates before processing
        if 'date' in df.columns:
            # Remove rows with invalid dates
            df = df[df['date'] != 'Unknown']
            df = df.dropna(subset=['date'])

            if df.empty:
                raise ValueError("No valid dates found in LST data")

            # Convert date strings to datetime with error handling
            df['date'] = pd.to_datetime(df['date'], errors='coerce')
            # Remove any rows that failed to parse
            df = df.dropna(subset=['date'])
            df = df.sort_values('date')

        # Create subplots
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))

        # Time series plot
        if 'date' in df.columns and 'lst' in df.columns:
            axes[0, 0].plot(df['date'], df['lst'], marker='o', linewidth=2, markersize=6, color='red')
            axes[0, 0].set_title('LST Time Series', fontsize=14, fontweight='bold')
            axes[0, 0].set_xlabel('Date')
            axes[0, 0].set_ylabel('LST (°C)')
            axes[0, 0].grid(True, alpha=0.3)

        # LST distribution
        if 'lst' in df.columns:
            axes[0, 1].hist(df['lst'], bins=20, alpha=0.7, color='orange', edgecolor='black')
            axes[0, 1].set_title('LST Distribution', fontsize=14, fontweight='bold')
            axes[0, 1].set_xlabel('LST (°C)')
            axes[0, 1].set_ylabel('Frequency')
            axes[0, 1].grid(True, alpha=0.3)

        # Spatial distribution
        if 'lat' in df.columns and 'lon' in df.columns and 'lst' in df.columns:
            scatter = axes[1, 0].scatter(df['lon'], df['lat'], c=df['lst'],
                                       cmap='coolwarm', s=100, alpha=0.7)
            axes[1, 0].set_title('LST Spatial Distribution', fontsize=14, fontweight='bold')
            axes[1, 0].set_xlabel('Longitude')
            axes[1, 0].set_ylabel('Latitude')
            plt.colorbar(scatter, ax=axes[1, 0], label='LST (°C)')

        # Box plot
        if 'lst' in df.columns:
            axes[1, 1].boxplot(df['lst'], labels=['LST'])
            axes[1, 1].set_title('LST Statistics', fontsize=14, fontweight='bold')
            axes[1, 1].set_ylabel('LST (°C)')
            axes[1, 1].grid(True, alpha=0.3)

        plt.suptitle('Land Surface Temperature Analysis Results', fontsize=16, fontweight='bold')

    except Exception as e:
        logger.error(f"LST plot creation error: {str(e)}")
        raise


def create_sar_plot(df):
    """Create SAR-specific plot"""
    try:
        # Filter out unknown dates and convert date strings to datetime
        if 'date' in df.columns:
            # Remove rows with 'Unknown' dates
            df = df[df['date'] != 'Unknown'].copy()

            if len(df) == 0:
                logger.warning("No valid dates found in SAR data for plotting")
                return

            # Convert to datetime with error handling
            try:
                df['date'] = pd.to_datetime(df['date'], errors='coerce')
                # Remove any rows where date conversion failed (NaT values)
                df = df.dropna(subset=['date'])
                df = df.sort_values('date')

                if len(df) == 0:
                    logger.warning("No valid dates after datetime conversion for SAR plotting")
                    return
            except Exception as date_error:
                logger.error(f"Error converting SAR dates: {date_error}")
                return

        # Create subplots
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))

        # VV vs VH backscatter
        if 'vv_backscatter' in df.columns and 'vh_backscatter' in df.columns:
            axes[0, 0].scatter(df['vv_backscatter'], df['vh_backscatter'], alpha=0.7, s=60)
            axes[0, 0].set_title('VV vs VH Backscatter', fontsize=14, fontweight='bold')
            axes[0, 0].set_xlabel('VV Backscatter (dB)')
            axes[0, 0].set_ylabel('VH Backscatter (dB)')
            axes[0, 0].grid(True, alpha=0.3)

        # Backscatter time series
        if 'date' in df.columns:
            if 'vv_backscatter' in df.columns:
                axes[0, 1].plot(df['date'], df['vv_backscatter'], marker='o', label='VV', linewidth=2)
            if 'vh_backscatter' in df.columns:
                axes[0, 1].plot(df['date'], df['vh_backscatter'], marker='s', label='VH', linewidth=2)
            axes[0, 1].set_title('Backscatter Time Series', fontsize=14, fontweight='bold')
            axes[0, 1].set_xlabel('Date')
            axes[0, 1].set_ylabel('Backscatter (dB)')
            axes[0, 1].legend()
            axes[0, 1].grid(True, alpha=0.3)

        # Spatial distribution of VV
        if 'lat' in df.columns and 'lon' in df.columns and 'vv_backscatter' in df.columns:
            scatter = axes[1, 0].scatter(df['lon'], df['lat'], c=df['vv_backscatter'],
                                       cmap='viridis', s=100, alpha=0.7)
            axes[1, 0].set_title('VV Backscatter Spatial Distribution', fontsize=14, fontweight='bold')
            axes[1, 0].set_xlabel('Longitude')
            axes[1, 0].set_ylabel('Latitude')
            plt.colorbar(scatter, ax=axes[1, 0], label='VV (dB)')

        # VV/VH ratio
        if 'vv_vh_ratio' in df.columns:
            axes[1, 1].hist(df['vv_vh_ratio'], bins=20, alpha=0.7, color='purple', edgecolor='black')
            axes[1, 1].set_title('VV/VH Ratio Distribution', fontsize=14, fontweight='bold')
            axes[1, 1].set_xlabel('VV/VH Ratio')
            axes[1, 1].set_ylabel('Frequency')
            axes[1, 1].grid(True, alpha=0.3)

        plt.suptitle('SAR Analysis Results', fontsize=16, fontweight='bold')

    except Exception as e:
        logger.error(f"SAR plot creation error: {str(e)}")
        raise


def create_generic_plot(df, analysis_type):
    """Create generic plot for other analysis types"""
    try:
        # Simple line plot if date column exists
        if 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date'])
            df = df.sort_values('date')

            numeric_columns = df.select_dtypes(include=[np.number]).columns

            plt.figure(figsize=(12, 8))
            for col in numeric_columns:
                plt.plot(df['date'], df[col], marker='o', label=col, linewidth=2)

            plt.title(f'{analysis_type.upper()} Analysis Results', fontsize=16, fontweight='bold')
            plt.xlabel('Date')
            plt.ylabel('Value')
            plt.legend()
            plt.grid(True, alpha=0.3)
        else:
            # Simple histogram of first numeric column
            numeric_columns = df.select_dtypes(include=[np.number]).columns
            if len(numeric_columns) > 0:
                plt.hist(df[numeric_columns[0]], bins=20, alpha=0.7, edgecolor='black')
                plt.title(f'{analysis_type.upper()} Distribution', fontsize=16, fontweight='bold')
                plt.xlabel(numeric_columns[0])
                plt.ylabel('Frequency')
                plt.grid(True, alpha=0.3)

    except Exception as e:
        logger.error(f"Generic plot creation error: {str(e)}")
        raise


def calculate_statistics(data, value_column):
    """Calculate basic statistics for a data column"""
    try:
        if not data or value_column not in data[0]:
            return {}

        values = [item[value_column] for item in data if value_column in item and item[value_column] is not None]

        if not values:
            return {}

        return {
            'count': len(values),
            'mean': round(np.mean(values), 4),
            'median': round(np.median(values), 4),
            'min': round(np.min(values), 4),
            'max': round(np.max(values), 4),
            'std': round(np.std(values), 4),
            'percentile_25': round(np.percentile(values, 25), 4),
            'percentile_75': round(np.percentile(values, 75), 4)
        }

    except Exception as e:
        logger.error(f"Statistics calculation error: {str(e)}")
        return {}


def format_response_data(success, analysis_type, data, statistics=None, message=None, demo_mode=False, satellite=None):
    """Format standard response data structure"""
    try:
        response = {
            "success": success,
            "demo_mode": demo_mode,
            "analysis_type": analysis_type,
            "satellite": satellite or "Unknown",
            "data": data or [],
            "timestamp": datetime.now().isoformat(),
        }

        if statistics:
            response["statistics"] = statistics

        if message:
            response["message"] = message

        return response

    except Exception as e:
        logger.error(f"Response formatting error: {str(e)}")
        return {
            "success": False,
            "error": f"Response formatting error: {str(e)}",
            "timestamp": datetime.now().isoformat()
        }
