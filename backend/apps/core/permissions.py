"""
Custom permissions for the GeoAnalysis application.
"""

from rest_framework import permissions
from rest_framework.permissions import BasePermission


class IsOwnerOrReadOnly(BasePermission):
    """
    Custom permission to only allow owners of an object to edit it.
    Assumes the model instance has an `user` attribute.
    """

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed for any request,
        # so we'll always allow GET, HEAD or OPTIONS requests.
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions are only allowed to the owner of the snippet.
        return obj.user == request.user


class IsProjectOwner(BasePermission):
    """
    Custom permission to only allow project owners to access their projects.
    """

    def has_object_permission(self, request, view, obj):
        # Check if the user owns the project
        return obj.user == request.user


class IsAnalysisOwner(BasePermission):
    """
    Custom permission to only allow analysis owners to access their analyses.
    """

    def has_object_permission(self, request, view, obj):
        # Check if the user owns the analysis
        return hasattr(obj, 'user') and obj.user == request.user


class IsEarthEngineAuthenticated(BasePermission):
    """
    Custom permission to check if user has Earth Engine authentication.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Check if user has Earth Engine authentication
        # This can be expanded to check actual EE authentication status
        return hasattr(request.user, 'is_earth_engine_authenticated') and \
               request.user.is_earth_engine_authenticated


class CanPerformAnalysis(BasePermission):
    """
    Permission to check if user can perform analysis operations.
    Allows authenticated users to perform basic analysis.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            self.message = "Authentication required to perform analysis."
            return False
        
        # For demo endpoints, allow any authenticated user
        if hasattr(view, 'action') and 'demo' in view.action:
            return True
            
        # Allow any authenticated user to perform analysis
        # Earth Engine authentication is optional and handled within the analysis logic
        return True


class IsOwnerOrAdmin(BasePermission):
    """
    Permission that allows owners of objects or admin users to access them.
    """

    def has_object_permission(self, request, view, obj):
        # Admin users have full access
        if request.user.is_staff or request.user.is_superuser:
            return True
            
        # Object owners have access
        return hasattr(obj, 'user') and obj.user == request.user


class CanUploadFiles(BasePermission):
    """
    Permission to check if user can upload files.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            self.message = "Authentication required to upload files."
            return False
            
        # Add any additional checks here (e.g., quota limits, user plan, etc.)
        return True


class RateLimitPermission(BasePermission):
    """
    Basic rate limiting permission.
    Can be expanded with more sophisticated rate limiting.
    """

    def has_permission(self, request, view):
        # This is a placeholder for rate limiting logic
        # In production, you might want to use django-ratelimit or similar
        return True