"""
Database operations module for analysis requests and results.
Handles persistence, retrieval, and management of analysis data.
"""

import logging
from datetime import datetime
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from ..models import AnalysisRequest, AnalysisResult

logger = logging.getLogger(__name__)


def save_analysis_to_database(request_data, analysis_results, analysis_type, user=None):
    """Save analysis request and results to database."""
    try:
        # Extract parameters from request_data to match model fields
        analysis_request = AnalysisRequest.objects.create(
            user=user,
            name=f"{analysis_type.upper()} Analysis {timezone.now().strftime('%Y-%m-%d %H:%M')}",
            analysis_type=analysis_type,
            satellite=request_data.get('satellite', 'landsat'),
            geometry_data=request_data.get('aoi_data', {}),
            start_date=request_data.get('start_date'),
            end_date=request_data.get('end_date'),
            cloud_cover=int(request_data.get('cloud_cover', 20)),
            status='completed',
            completed_at=timezone.now()
        )

        # Create AnalysisResult record
        AnalysisResult.objects.create(
            analysis_request=analysis_request,
            data=analysis_results,
            total_observations=analysis_results.get('total_images', 0)
        )

        logger.info(f"Saved {analysis_type} analysis to database with ID {analysis_request.id}")
        return analysis_request.id

    except Exception as e:
        logger.error(f"Database save error: {str(e)}")
        return None


def get_analysis_history():
    """Get analysis history from database"""
    try:
        # Get recent analysis requests
        recent_analyses = AnalysisRequest.objects.order_by('-created_at')[:10]

        history = []
        for analysis in recent_analyses:
            history.append({
                "id": analysis.id,
                "name": analysis.name,
                "analysis_type": analysis.analysis_type,
                "satellite": analysis.satellite,
                "status": analysis.status,
                "created_at": analysis.created_at.isoformat(),
                "start_date": analysis.start_date.isoformat() if analysis.start_date else None,
                "end_date": analysis.end_date.isoformat() if analysis.end_date else None,
                "cloud_cover": analysis.cloud_cover
            })

        return {
            "success": True,
            "history": history,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Error retrieving history: {str(e)}"
        }


def get_analysis_result_by_id(analysis_id):
    """Get specific analysis result by ID"""
    try:
        analysis_request = AnalysisRequest.objects.get(id=analysis_id)
        result = AnalysisResult.objects.get(analysis_request=analysis_request)

        return {
            "success": True,
            "analysis_request": {
                "id": analysis_request.id,
                "name": analysis_request.name,
                "analysis_type": analysis_request.analysis_type,
                "satellite": analysis_request.satellite,
                "status": analysis_request.status,
                "created_at": analysis_request.created_at.isoformat(),
                "start_date": analysis_request.start_date.isoformat() if analysis_request.start_date else None,
                "end_date": analysis_request.end_date.isoformat() if analysis_request.end_date else None,
                "cloud_cover": analysis_request.cloud_cover
            },
            "results": result.data,
            "timestamp": datetime.now().isoformat()
        }

    except AnalysisRequest.DoesNotExist:
        return {
            "success": False,
            "error": f"Analysis request {analysis_id} not found",
            "status_code": status.HTTP_404_NOT_FOUND
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error retrieving result: {str(e)}",
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR
        }


def delete_analysis_by_id(analysis_id):
    """Delete analysis by ID"""
    try:
        analysis_request = AnalysisRequest.objects.get(id=analysis_id)
        analysis_request.delete()

        return {
            "success": True,
            "message": f"Analysis {analysis_id} deleted successfully",
            "timestamp": datetime.now().isoformat()
        }

    except AnalysisRequest.DoesNotExist:
        return {
            "success": False,
            "error": f"Analysis request {analysis_id} not found",
            "status_code": status.HTTP_404_NOT_FOUND
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error deleting analysis: {str(e)}",
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR
        }


def update_analysis_status(analysis_id, new_status):
    """Update analysis status"""
    try:
        analysis_request = AnalysisRequest.objects.get(id=analysis_id)
        analysis_request.status = new_status
        analysis_request.save()

        logger.info(f"Updated analysis {analysis_id} status to {new_status}")
        return True

    except AnalysisRequest.DoesNotExist:
        logger.error(f"Analysis request {analysis_id} not found for status update")
        return False
    except Exception as e:
        logger.error(f"Error updating analysis status: {str(e)}")
        return False


def get_analysis_statistics():
    """Get database statistics for analyses"""
    try:
        total_analyses = AnalysisRequest.objects.count()
        completed_analyses = AnalysisRequest.objects.filter(status='completed').count()
        failed_analyses = AnalysisRequest.objects.filter(status='failed').count()

        # Get analysis type breakdown
        type_breakdown = {}
        for analysis_type in ['ndvi', 'lst', 'backscatter', 'sentinel1', 'sentinel2', 'comprehensive']:
            count = AnalysisRequest.objects.filter(analysis_type=analysis_type).count()
            if count > 0:
                type_breakdown[analysis_type] = count

        return {
            "total_analyses": total_analyses,
            "completed_analyses": completed_analyses,
            "failed_analyses": failed_analyses,
            "success_rate": round((completed_analyses / total_analyses * 100), 2) if total_analyses > 0 else 0,
            "type_breakdown": type_breakdown,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Error getting analysis statistics: {str(e)}")
        return {
            "total_analyses": 0,
            "completed_analyses": 0,
            "failed_analyses": 0,
            "success_rate": 0,
            "type_breakdown": {},
            "error": str(e)
        }
