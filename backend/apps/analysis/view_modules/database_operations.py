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


def save_analysis_to_database(request_data, analysis_results, analysis_type, user=None, project=None):
    """Save analysis request and results to database with duplicate checking."""
    try:
        # Extract parameters for duplicate checking
        satellite = request_data.get('satellite', 'landsat')
        start_date = request_data.get('start_date')
        end_date = request_data.get('end_date')
        cloud_cover = int(request_data.get('cloud_cover', 20))
        geometry_data = request_data.get('aoi_data', {})
        use_cloud_masking = request_data.get('use_cloud_masking', True)
        strict_masking = request_data.get('strict_masking', False)
        polarization = request_data.get('polarization', 'VV')
        
        # Check for existing analysis with same parameters
        existing_analysis = AnalysisRequest.objects.filter(
            user=user,
            project=project,
            analysis_type=analysis_type,
            satellite=satellite,
            start_date=start_date,
            end_date=end_date,
            cloud_cover=cloud_cover,
            use_cloud_masking=use_cloud_masking,
            strict_masking=strict_masking,
            polarization=polarization if analysis_type in ['sar', 'backscatter', 'comprehensive'] else None,
            status='completed'
        ).first()
        
        if existing_analysis:
            # Check if geometry is similar (within a reasonable tolerance)
            if _geometries_are_similar(existing_analysis.geometry_data, geometry_data):
                logger.info(f"Found duplicate {analysis_type} analysis with ID {existing_analysis.id}")
                return {
                    'analysis_id': existing_analysis.id,
                    'is_duplicate': True,
                    'message': f'Similar {analysis_type.upper()} analysis already exists'
                }
        
        # Create new analysis if no duplicate found
        analysis_request = AnalysisRequest.objects.create(
            user=user,
            project=project,
            name=f"{analysis_type.upper()} Analysis {timezone.now().strftime('%Y-%m-%d %H:%M')}",
            analysis_type=analysis_type,
            satellite=satellite,
            geometry_data=geometry_data,
            start_date=start_date,
            end_date=end_date,
            cloud_cover=cloud_cover,
            use_cloud_masking=use_cloud_masking,
            strict_masking=strict_masking,
            polarization=polarization if analysis_type in ['sar', 'backscatter', 'comprehensive'] else None,
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
        return {
            'analysis_id': analysis_request.id,
            'is_duplicate': False,
            'message': f'{analysis_type.upper()} analysis saved successfully'
        }

    except Exception as e:
        logger.error(f"Database save error: {str(e)}")
        return None


def _geometries_are_similar(geom1, geom2, tolerance=0.001):
    """
    Check if two geometries are similar within a tolerance.
    This is a simple comparison - in production you might want more sophisticated geometry comparison.
    """
    try:
        if not geom1 or not geom2:
            return False
            
        # Extract coordinates from both geometries
        coords1 = _extract_coordinates(geom1)
        coords2 = _extract_coordinates(geom2)
        
        if not coords1 or not coords2 or len(coords1) != len(coords2):
            return False
            
        # Check if all coordinate pairs are within tolerance
        for (x1, y1), (x2, y2) in zip(coords1, coords2):
            if abs(x1 - x2) > tolerance or abs(y1 - y2) > tolerance:
                return False
                
        return True
    except Exception:
        return False


def _extract_coordinates(geometry):
    """Extract coordinate pairs from various geometry formats."""
    try:
        if isinstance(geometry, dict):
            if geometry.get('type') == 'FeatureCollection':
                features = geometry.get('features', [])
                if features:
                    return _extract_coordinates(features[0].get('geometry', {}))
            elif geometry.get('type') == 'Feature':
                return _extract_coordinates(geometry.get('geometry', {}))
            elif geometry.get('type') == 'Polygon':
                coords = geometry.get('coordinates', [])
                if coords:
                    return coords[0]  # First ring of polygon
            elif geometry.get('coordinates'):
                return geometry.get('coordinates')
        return []
    except Exception:
        return []


def get_analysis_history(user_id=None):
    """Get analysis history from database"""
    try:
        # Get recent analysis requests, filtered by user if provided
        if user_id:
            recent_analyses = AnalysisRequest.objects.filter(user_id=user_id).order_by('-created_at')[:20]
        else:
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
                "cloud_cover": analysis.cloud_cover,
                "geometry_data": analysis.geometry_data
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


def get_analysis_result_by_id(analysis_id, user_id=None):
    """Get specific analysis result by ID"""
    try:
        # Filter by user if provided
        if user_id:
            analysis_request = AnalysisRequest.objects.get(id=analysis_id, user_id=user_id)
        else:
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
                "cloud_cover": analysis_request.cloud_cover,
                "geometry_data": analysis_request.geometry_data
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


def delete_analysis_by_id(analysis_id, user_id=None):
    """Delete analysis by ID"""
    try:
        # Filter by user if provided for security
        if user_id:
            analysis_request = AnalysisRequest.objects.get(id=analysis_id, user_id=user_id)
        else:
            analysis_request = AnalysisRequest.objects.get(id=analysis_id)
            
        analysis_name = analysis_request.name
        analysis_type = analysis_request.analysis_type
        
        # Delete the analysis request (this will cascade delete the result)
        analysis_request.delete()

        logger.info(f"Successfully deleted analysis {analysis_id} ({analysis_name}) for user {user_id}")
        
        return {
            "success": True,
            "message": f"Analysis '{analysis_name}' ({analysis_type.upper()}) deleted successfully",
            "deleted_analysis": {
                "id": analysis_id,
                "name": analysis_name,
                "type": analysis_type
            },
            "timestamp": datetime.now().isoformat()
        }

    except AnalysisRequest.DoesNotExist:
        return {
            "success": False,
            "error": f"Analysis request {analysis_id} not found or you don't have permission to delete it",
            "status_code": status.HTTP_404_NOT_FOUND
        }
    except Exception as e:
        logger.error(f"Error deleting analysis {analysis_id}: {str(e)}")
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
