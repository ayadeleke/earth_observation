"""
Authentication decorators and utilities for the GeoAnalysis application.
"""

from functools import wraps
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from rest_framework.decorators import permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.authentication import SessionAuthentication
import logging

logger = logging.getLogger(__name__)


def require_authentication(view_func):
    """
    Decorator to require authentication for API views.
    Works with both function-based and class-based views.
    """
    @wraps(view_func)
    def wrapped_view(request, *args, **kwargs):
        # Check if user is authenticated
        if not request.user.is_authenticated:
            return JsonResponse({
                'error': 'Authentication required',
                'message': 'You must be logged in to access this endpoint',
                'status_code': 401
            }, status=401)
        
        return view_func(request, *args, **kwargs)
    
    return wrapped_view


def require_earth_engine_auth(view_func):
    """
    Decorator to require Earth Engine authentication for analysis operations.
    """
    @wraps(view_func)
    def wrapped_view(request, *args, **kwargs):
        # First check user authentication
        if not request.user.is_authenticated:
            return JsonResponse({
                'error': 'Authentication required',
                'message': 'You must be logged in to perform analysis',
                'status_code': 401
            }, status=401)
        
        # Check Earth Engine authentication
        if not getattr(request.user, 'is_earth_engine_authenticated', False):
            return JsonResponse({
                'error': 'Earth Engine authentication required',
                'message': 'You must authenticate with Google Earth Engine to perform analysis',
                'status_code': 403,
                'requires_ee_auth': True
            }, status=403)
        
        return view_func(request, *args, **kwargs)
    
    return wrapped_view


def api_auth_required(view_func):
    """
    Decorator for API views that require JWT or Session authentication.
    """
    @authentication_classes([JWTAuthentication, SessionAuthentication])
    @permission_classes([IsAuthenticated])
    @wraps(view_func)
    def wrapped_view(*args, **kwargs):
        return view_func(*args, **kwargs)
    
    return wrapped_view


def log_user_action(action_type):
    """
    Decorator to log user actions for audit purposes.
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(request, *args, **kwargs):
            user = getattr(request, 'user', None)
            user_id = user.id if user and user.is_authenticated else 'anonymous'
            
            logger.info(f"User action: {action_type} by user {user_id} from IP {request.META.get('REMOTE_ADDR', 'unknown')}")
            
            try:
                response = view_func(request, *args, **kwargs)
                logger.info(f"User action: {action_type} completed successfully for user {user_id}")
                return response
            except Exception as e:
                logger.error(f"User action: {action_type} failed for user {user_id}: {str(e)}")
                raise
        
        return wrapped_view
    return decorator


def rate_limit_user(max_requests_per_minute=60):
    """
    Simple rate limiting decorator.
    In production, consider using django-ratelimit or similar.
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(request, *args, **kwargs):
            # This is a placeholder for rate limiting logic
            # In production, implement proper rate limiting here
            return view_func(request, *args, **kwargs)
        
        return wrapped_view
    return decorator


def demo_or_authenticated(view_func):
    """
    Decorator that allows access for demo mode or authenticated users.
    """
    @wraps(view_func)
    def wrapped_view(request, *args, **kwargs):
        # Check if this is a demo request
        is_demo = request.GET.get('demo', '').lower() == 'true' or \
                  request.POST.get('demo', '').lower() == 'true'
        
        if is_demo:
            # Allow demo access without authentication
            logger.info(f"Demo access from IP {request.META.get('REMOTE_ADDR', 'unknown')}")
            return view_func(request, *args, **kwargs)
        
        # Require authentication for non-demo requests
        if not request.user.is_authenticated:
            return JsonResponse({
                'error': 'Authentication required',
                'message': 'You must be logged in or use demo mode',
                'status_code': 401,
                'demo_available': True
            }, status=401)
        
        return view_func(request, *args, **kwargs)
    
    return wrapped_view


def owner_required(model_class, lookup_field='id'):
    """
    Decorator to ensure user owns the object being accessed.
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return JsonResponse({
                    'error': 'Authentication required',
                    'status_code': 401
                }, status=401)
            
            # Get the object ID from URL kwargs
            obj_id = kwargs.get(lookup_field)
            if obj_id:
                try:
                    obj = model_class.objects.get(id=obj_id)
                    if hasattr(obj, 'user') and obj.user != request.user:
                        return JsonResponse({
                            'error': 'Permission denied',
                            'message': 'You can only access your own resources',
                            'status_code': 403
                        }, status=403)
                except model_class.DoesNotExist:
                    return JsonResponse({
                        'error': 'Object not found',
                        'status_code': 404
                    }, status=404)
            
            return view_func(request, *args, **kwargs)
        
        return wrapped_view
    return decorator