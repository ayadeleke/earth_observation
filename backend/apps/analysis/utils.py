"""
Analysis utilities for file generation and download functionality.
Implements Flask-style file downloads for Django backend.
"""
import os
import sys
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend for web applications
import matplotlib.pyplot as plt
from datetime import datetime
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

# Add modules path for importing plot_generator and statistics
if 'd:/webapp/modules' not in sys.path:
    sys.path.append('d:/webapp/modules')

try:
    from plot_generator import create_ndvi_plot, save_data_csv
    from statistics import calculate_advanced_statistics
    from enhanced_plotting import create_enhanced_plot
except ImportError as e:
    print(f"Warning: Could not import modules: {e}")
    create_ndvi_plot = None
    save_data_csv = None
    calculate_advanced_statistics = None
    create_enhanced_plot = None


def ensure_media_directories():
    """Ensure media directories exist for file storage"""
    media_root = settings.MEDIA_ROOT
    subdirs = ['plots', 'csv', 'maps']
    
    for subdir in subdirs:
        dir_path = os.path.join(media_root, subdir)
        os.makedirs(dir_path, exist_ok=True)
    
    return media_root


def generate_plot_file(data, plot_type, title="Analysis Plot", analysis_type="ndvi"):
    """
    Generate plot file and return download URL.
    
    Args:
        data (list): List of data dictionaries
        plot_type (str): Type of plot ('ndvi', 'lst', 'sentinel1')
        title (str): Plot title
        analysis_type (str): Analysis type for file naming
        
    Returns:
        dict: {'success': bool, 'plot_url': str, 'filename': str, 'error': str}
    """
    try:
        ensure_media_directories()
        
        # Convert data to DataFrame if needed
        if isinstance(data, list):
            df = pd.DataFrame(data)
        else:
            df = data
            
        if df.empty:
            return {'success': False, 'error': 'No data to plot'}
        
        # Generate plot using enhanced plotting if available
        if create_enhanced_plot:
            # Use enhanced plotting from modules
            result = create_enhanced_plot(data, plot_type, title)
            if result['success']:
                # Extract filename from static URL and move to media
                static_url = result.get('plot_url', '')
                if static_url.startswith('/static/'):
                    filename = static_url.replace('/static/', '')
                    static_path = os.path.join('d:/webapp/static', filename)
                    
                    if os.path.exists(static_path):
                        # Read file and save to Django media
                        with open(static_path, 'rb') as f:
                            content = f.read()
                        
                        # Save to media with timestamp
                        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                        media_filename = f"plots/{analysis_type}_plot_{timestamp}.png"
                        saved_path = default_storage.save(media_filename, ContentFile(content))
                        
                        # Clean up static file
                        try:
                            os.remove(static_path)
                        except:
                            pass
                        
                        return {
                            'success': True,
                            'plot_url': f"{settings.MEDIA_URL}{saved_path}",
                            'filename': saved_path,
                            'error': None
                        }
            
        # Fallback: Create basic plot with matplotlib
        plt.figure(figsize=(12, 8))
        
        if plot_type == 'ndvi':
            if 'date' in df.columns and 'ndvi' in df.columns:
                dates = pd.to_datetime(df['date'])
                plt.plot(dates, df['ndvi'], 'g-', linewidth=2, label='NDVI')
                plt.ylabel('NDVI Value')
            else:
                return {'success': False, 'error': 'Invalid NDVI data format'}
                
        elif plot_type == 'lst':
            if 'date' in df.columns and 'lst' in df.columns:
                dates = pd.to_datetime(df['date'])
                plt.plot(dates, df['lst'], 'r-', linewidth=2, label='LST (°C)')
                plt.ylabel('Land Surface Temperature (°C)')
            else:
                return {'success': False, 'error': 'Invalid LST data format'}
                
        elif plot_type == 'sentinel1':
            if 'date' in df.columns and 'backscatter' in df.columns:
                dates = pd.to_datetime(df['date'])
                plt.plot(dates, df['backscatter'], 'b-', linewidth=2, label='Backscatter (dB)')
                plt.ylabel('Backscatter (dB)')
            else:
                return {'success': False, 'error': 'Invalid Sentinel-1 data format'}
        
        plt.title(title)
        plt.xlabel('Date')
        plt.legend()
        plt.grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        plt.tight_layout()
        
        # Save plot to media
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"plots/{analysis_type}_plot_{timestamp}.png"
        
        # Save to temporary file first
        temp_path = os.path.join(settings.MEDIA_ROOT, filename)
        os.makedirs(os.path.dirname(temp_path), exist_ok=True)
        plt.savefig(temp_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        # Verify file exists
        if os.path.exists(temp_path):
            return {
                'success': True,
                'plot_url': f"{settings.MEDIA_URL}{filename}",
                'filename': filename,
                'error': None
            }
        else:
            return {'success': False, 'error': 'Failed to save plot file'}
            
    except Exception as e:
        plt.close()  # Cleanup on error
        return {'success': False, 'error': f'Plot generation failed: {str(e)}'}


def generate_csv_file(data, analysis_type="ndvi"):
    """
    Generate CSV file and return download URL.
    
    Args:
        data (list): List of data dictionaries
        analysis_type (str): Analysis type for file naming
        
    Returns:
        dict: {'success': bool, 'csv_url': str, 'filename': str, 'error': str}
    """
    try:
        ensure_media_directories()
        
        # Convert data to DataFrame
        if isinstance(data, list):
            df = pd.DataFrame(data)
        else:
            df = data
            
        if df.empty:
            return {'success': False, 'error': 'No data to save'}
        
        # Generate CSV content
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"csv/{analysis_type}_data_{timestamp}.csv"
        
        # Convert DataFrame to CSV string
        csv_content = df.to_csv(index=False)
        
        # Save to Django media storage
        saved_path = default_storage.save(filename, ContentFile(csv_content.encode('utf-8')))
        
        return {
            'success': True,
            'csv_url': f"{settings.MEDIA_URL}{saved_path}",
            'filename': saved_path,
            'error': None
        }
        
    except Exception as e:
        return {'success': False, 'error': f'CSV generation failed: {str(e)}'}


def integrate_advanced_statistics(data, value_column='ndvi'):
    """
    Integrate advanced statistics from modules/statistics.py
    
    Args:
        data (list): List of data dictionaries
        value_column (str): Column name for values ('ndvi', 'lst', 'backscatter')
        
    Returns:
        dict: Advanced statistics results
    """
    try:
        if calculate_advanced_statistics:
            return calculate_advanced_statistics(data, value_column)
        else:
            # Fallback basic statistics
            if isinstance(data, list):
                df = pd.DataFrame(data)
            else:
                df = data
                
            if df.empty or value_column not in df.columns:
                return {'error': 'No valid data for statistics'}
            
            values = df[value_column].dropna()
            
            return {
                'basic_stats': {
                    'count': len(values),
                    'mean': float(values.mean()),
                    'median': float(values.median()),
                    'std': float(values.std()),
                    'min': float(values.min()),
                    'max': float(values.max())
                },
                'trend_analysis': {
                    'trend_direction': 'increasing' if values.iloc[-1] > values.iloc[0] else 'decreasing',
                    'slope': None  # Would need more complex calculation
                }
            }
            
    except Exception as e:
        return {'error': f'Statistics calculation failed: {str(e)}'}


def create_response_with_downloads(data, statistics, analysis_type="ndvi", title="Analysis"):
    """
    Create Flask-style response with download URLs.
    
    Args:
        data (list): Analysis data
        statistics (dict): Statistical results
        analysis_type (str): Type of analysis
        title (str): Plot title
        
    Returns:
        dict: Complete response with download URLs
    """
    response = {
        'success': True,
        'analysis_type': analysis_type.upper(),
        'data': data,
        'statistics': statistics,
        'message': f'{analysis_type.upper()} analysis completed successfully'
    }
    
    # Generate plot file
    plot_result = generate_plot_file(data, analysis_type, title, analysis_type)
    if plot_result['success']:
        response['plot_url'] = plot_result['plot_url']
        response['plot_filename'] = plot_result['filename']
    else:
        response['plot_error'] = plot_result['error']
    
    # Generate CSV file
    csv_result = generate_csv_file(data, analysis_type)
    if csv_result['success']:
        response['csv_url'] = csv_result['csv_url']
        response['csv_filename'] = csv_result['filename']
    else:
        response['csv_error'] = csv_result['error']
    
    return response
