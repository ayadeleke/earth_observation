"""
Simple view mixins for basic caching (session-only)
"""

from django.views.decorators.cache import cache_page
from django.views.decorators.vary import vary_on_headers, vary_on_cookie
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from apps.core.caching import cache_manager
import logging

logger = logging.getLogger(__name__)


class CachedAnalysisViewMixin:
    """
    Simple mixin for basic view caching.
    Currently disabled - no complex caching.
    """
    
    def get_cache_key(self, request, *args, **kwargs):
        """Generate cache key for view"""
        return f"view_{self.__class__.__name__}_{request.user.id if request.user.is_authenticated else 'anon'}"
    
    def get_cached_response(self, request, *args, **kwargs):
        """Get cached response - currently disabled"""
        return None
    
    def set_cached_response(self, request, response, *args, **kwargs):
        """Set cached response - currently disabled"""
        pass


# Simplified project list view without complex caching
class CachedProjectListView(APIView):
    """Simple project list view"""
    
    def get(self, request):
        # This would be implemented to return project list
        # without complex caching
        pass


class SmartCacheInvalidator:
    """Simple cache invalidation - currently just logs"""
    
    @staticmethod
    def invalidate_analysis_caches(analysis_type=None, user_id=None):
        """Log cache invalidation requests"""
        logger.info(f"Cache invalidation requested for analysis_type={analysis_type}, user_id={user_id}")
    
    @staticmethod
    def invalidate_user_caches(user_id):
        """Log user cache invalidation"""
        logger.info(f"User cache invalidation requested for user_id={user_id}")
    
    @staticmethod
    def invalidate_project_caches(project_id=None, user_id=None):
        """Log project cache invalidation"""
        logger.info(f"Project cache invalidation requested for project_id={project_id}, user_id={user_id}")
    
    @staticmethod
    def clear_all_caches():
        """Log cache clearing"""
        logger.info("All cache clearing requested")