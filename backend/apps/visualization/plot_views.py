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

        if not time_series_data:
            return Response(
                {"error": "No time series data provided"},
                status=status.HTTP_400_BAD_REQUEST
            )

        logger.info(f"=== Plot Generation Debug ===")
        logger.info(f"Analysis type: {analysis_type}")
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

        # Create the plot
        plt.figure(figsize=(14, 8))

        # Convert date strings to datetime if needed
        if 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date'])
            x_values = df['date']
        else:
            x_values = range(len(df))

        # Plot based on analysis type
        if analysis_type == 'ndvi':
            if 'ndvi' in df.columns:
                plt.plot(x_values, df['ndvi'], 'g-', linewidth=2.5, marker='o', markersize=4, label='NDVI Values')
                plt.ylabel('NDVI Value', fontsize=12)
                plt.ylim(-0.1, 1.1)
            elif 'value' in df.columns:
                plt.plot(x_values, df['value'], 'g-', linewidth=2.5, marker='o', markersize=4, label='NDVI Values')
                plt.ylabel('NDVI Value', fontsize=12)
                plt.ylim(-0.1, 1.1)
            else:
                return Response(
                    {"error": "No NDVI data found in time series"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        elif analysis_type == 'lst':
            if 'lst' in df.columns:
                plt.plot(x_values, df['lst'], 'r-', linewidth=2.5, marker='s', markersize=4, label='LST (°C)')
                plt.ylabel('Land Surface Temperature (°C)', fontsize=12)
            elif 'value' in df.columns:
                plt.plot(x_values, df['value'], 'r-', linewidth=2.5, marker='s', markersize=4, label='LST (°C)')
                plt.ylabel('Land Surface Temperature (°C)', fontsize=12)
            else:
                return Response(
                    {"error": "No LST data found in time series"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        elif analysis_type == 'backscatter' or analysis_type == 'sentinel1' or analysis_type == 'sar':
            if 'backscatter' in df.columns:
                plt.plot(x_values, df['backscatter'], 'b-', linewidth=2.5, marker='^', markersize=4, label='Backscatter (dB)')
                plt.ylabel('Backscatter (dB)', fontsize=12)
            elif 'value' in df.columns:
                plt.plot(x_values, df['value'], 'b-', linewidth=2.5, marker='^', markersize=4, label='Backscatter (dB)')
                plt.ylabel('Backscatter (dB)', fontsize=12)
            else:
                return Response(
                    {"error": "No backscatter data found in time series"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Customize the plot
        plt.title(f'{title}\n{satellite.upper()} | {start_date} to {end_date}', fontsize=14, fontweight='bold', pad=20)
        plt.xlabel('Date', fontsize=12)
        plt.legend(fontsize=11, loc='best')
        plt.grid(True, alpha=0.3, linestyle='--')

        # Format x-axis for dates
        if 'date' in df.columns:
            plt.xticks(rotation=45)
            # Add some spacing around the data
            plt.margins(x=0.02)

        plt.tight_layout()

        # Save plot to temporary file
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'{analysis_type}_time_series_plot_{timestamp}.png'

        # Create temporary file
        temp_dir = tempfile.mkdtemp()
        temp_path = os.path.join(temp_dir, filename)

        # Save plot
        plt.savefig(temp_path, dpi=300, bbox_inches='tight', facecolor='white', edgecolor='none')
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
