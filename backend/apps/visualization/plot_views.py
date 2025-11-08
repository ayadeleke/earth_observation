"""
Time series plot generation endpoint for download functionality
"""
import logging
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.http import FileResponse, Http404
from django.conf import settings
import matplotlib.pyplot as plt
import matplotlib
import pandas as pd
import os
import tempfile
from datetime import datetime

# Use non-interactive backend for web applications
matplotlib.use('Agg')

logger = logging.getLogger(__name__)


@api_view(["POST"])
@permission_classes([AllowAny])
def generate_time_series_plot(request):
    """Generate and return a downloadable time series plot"""
    try:
        data = request.data
        analysis_type = data.get('analysis_type', 'ndvi').lower()
        time_series_data = data.get('time_series_data', [])
        title = data.get('title', f'{analysis_type.upper()} Time Series Analysis')
        satellite = data.get('satellite', 'landsat')
        start_date = data.get('start_date', '')
        end_date = data.get('end_date', '')
        polarization = data.get('polarization', 'VV')  # Get selected polarization for SAR

        if not time_series_data:
            return Response(
                {"error": "No time series data provided"},
                status=status.HTTP_400_BAD_REQUEST
            )

        logger.info(f"=== Plot Generation Debug ===")
        logger.info(f"Analysis type: {analysis_type}")
        logger.info(f"Polarization: {polarization}")
        logger.info(f"Time series data length: {len(time_series_data)}")
        logger.info(f"First 2 data points: {time_series_data[:2] if time_series_data else 'None'}")

        # Convert to DataFrame for easier plotting
        df = pd.DataFrame(time_series_data)

        logger.info(f"DataFrame columns: {df.columns.tolist()}")
        logger.info(f"DataFrame shape: {df.shape}")
        logger.info(f"DataFrame head:\n{df.head()}")

        if df.empty:
            return Response(
                {"error": "Empty time series data"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create the plot with aspect ratio matching the frontend display
        # Frontend uses ResponsiveContainer with height 400px, typical width ~1200px
        # This gives an aspect ratio of ~3:1 (12:4 in inches)
        plt.figure(figsize=(12, 5))

        # Convert date strings to datetime if needed and extract years
        if 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date'])
            # Extract year for x-axis to match frontend display
            df['year'] = df['date'].dt.year
        
        # Determine which column to aggregate
        value_column = None
        if analysis_type == 'ndvi':
            value_column = 'ndvi' if 'ndvi' in df.columns else 'value' if 'value' in df.columns else None
        elif analysis_type == 'lst':
            value_column = 'lst' if 'lst' in df.columns else 'value' if 'value' in df.columns else None
        elif analysis_type in ['backscatter', 'sentinel1', 'sar']:
            # For SAR, use the selected polarization
            polarization_lower = polarization.lower()
            # Try multiple field naming conventions
            possible_columns = [
                f'backscatter_{polarization_lower}',  # backscatter_vv, backscatter_vh
                f'{polarization_lower}_backscatter',  # vv_backscatter, vh_backscatter
                'backscatter',  # fallback to default backscatter
                'value'  # ultimate fallback
            ]
            for col in possible_columns:
                if col in df.columns:
                    value_column = col
                    logger.info(f"Using SAR column: {col} for polarization {polarization}")
                    break
        
        # Group by year and calculate mean to handle multiple data points per year
        if 'year' in df.columns and value_column:
            df_grouped = df.groupby('year')[value_column].mean().reset_index()
            x_values = df_grouped['year']
            y_values = df_grouped[value_column]
        else:
            x_values = range(len(df))
            y_values = df[value_column] if value_column else None

        # Plot based on analysis type
        if analysis_type == 'ndvi':
            if 'ndvi' in df.columns or 'value' in df.columns:
                plt.plot(x_values, y_values, color='#4CAF50', linewidth=2, marker='o', markersize=6, label='Mean NDVI', markeredgecolor='#4CAF50', markeredgewidth=2)
                plt.ylabel('NDVI Value', fontsize=12, fontweight='bold')
                plt.ylim(-0.1, 1.1)
                # Add value labels to each point
                for x, y in zip(x_values, y_values):
                    plt.annotate(f'{y:.3f}', (x, y), textcoords="offset points", xytext=(0,8), ha='center', fontsize=9, fontweight='bold')
            else:
                return Response(
                    {"error": "No NDVI data found in time series"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        elif analysis_type == 'lst':
            if 'lst' in df.columns or 'value' in df.columns:
                plt.plot(x_values, y_values, color='#FF6B6B', linewidth=2, marker='o', markersize=6, label='Mean LST', markeredgecolor='#FF6B6B', markeredgewidth=2)
                plt.ylabel('Temperature (°C)', fontsize=12, fontweight='bold')
                # Add value labels to each point
                for x, y in zip(x_values, y_values):
                    plt.annotate(f'{y:.2f}', (x, y), textcoords="offset points", xytext=(0,8), ha='center', fontsize=9, fontweight='bold')
            else:
                return Response(
                    {"error": "No LST data found in time series"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        elif analysis_type == 'backscatter' or analysis_type == 'sentinel1' or analysis_type == 'sar':
            if 'backscatter' in df.columns or 'value' in df.columns or value_column:
                label = f'Mean SAR {polarization}' if polarization else 'Mean SAR'
                plt.plot(x_values, y_values, color='#4ECDC4', linewidth=2, marker='o', markersize=6, label=label, markeredgecolor='#4ECDC4', markeredgewidth=2)
                plt.ylabel('Backscatter (dB)', fontsize=12, fontweight='bold')
                # Add value labels to each point
                for x, y in zip(x_values, y_values):
                    plt.annotate(f'{y:.2f}', (x, y), textcoords="offset points", xytext=(0,8), ha='center', fontsize=9, fontweight='bold')
            else:
                return Response(
                    {"error": "No backscatter data found in time series"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Customize the plot to match frontend styling
        plt.title(f'{title}\n{satellite.upper()} | {start_date} to {end_date}', fontsize=14, fontweight='bold', pad=15)
        plt.xlabel('Year', fontsize=12, fontweight='bold')
        plt.legend(fontsize=11, loc='best', framealpha=0.9)
        plt.grid(True, alpha=0.2, linestyle='--', linewidth=0.5, color='#f0f0f0')

        # Format x-axis
        if 'year' in df.columns:
            # Display years on x-axis from the grouped data
            if 'df_grouped' in locals():
                years = sorted(df_grouped['year'].unique())
            else:
                years = sorted(df['year'].unique())
            plt.xticks(years, rotation=-45, ha='left')
            # Add some spacing around the data
            plt.margins(x=0.02)
        
        # Set background color
        ax = plt.gca()
        ax.set_facecolor('white')
        
        plt.tight_layout()

        # Save plot to temporary file
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'{analysis_type}_time_series_plot_{timestamp}.png'

        # Create temporary file
        temp_dir = tempfile.mkdtemp()
        temp_path = os.path.join(temp_dir, filename)

        # Save plot with higher DPI for better quality but matching frontend style
        plt.savefig(temp_path, dpi=200, bbox_inches='tight', facecolor='white', edgecolor='none')
        plt.close()  # Important: close the figure to free memory

        logger.info(f"Generated time series plot: {filename}")

        # Return file response for download
        try:
            response = FileResponse(
                open(temp_path, 'rb'),
                as_attachment=True,
                filename=filename,
                content_type='image/png'
            )

            # Clean up temp file after response (Django will handle this)
            def cleanup():
                try:
                    os.unlink(temp_path)
                    os.rmdir(temp_dir)
                except BaseException:
                    pass

            # Schedule cleanup
            response.close_callback = cleanup

            return response

        except Exception as e:
            logger.error(f"Error creating file response: {e}")
            return Response(
                {"error": "Failed to create plot file"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    except Exception as e:
        logger.error(f"Error generating time series plot: {str(e)}")
        return Response(
            {"error": f"Plot generation error: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
