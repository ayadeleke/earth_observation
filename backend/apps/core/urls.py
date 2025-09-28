"""
URL patterns for the core app.
These match the Flask app routes for authentication and basic functionality.
"""

from django.urls import path
from . import views

urlpatterns = [
    # Authentication endpoints
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("profile/", views.UserProfileView.as_view(), name="profile"),
    # Earth Engine authentication endpoints (matching Flask routes)
    path("check_ee/", views.check_earth_engine, name="check_earth_engine"),
    path("auth/ee/check/", views.check_auth, name="check_auth"),
    path("auth/ee/status/", views.auth_status, name="auth_status"),
    path("auth/ee/clear/", views.clear_auth, name="clear_auth"),
    # Analysis capabilities
    path(
        "get_analysis_capabilities/",
        views.get_analysis_capabilities,
        name="analysis_capabilities",
    ),
    # Demo endpoint
    path("demo/", views.demo_endpoint, name="demo"),
    # Project management
    path(
        "projects/", views.AnalysisProjectListCreateView.as_view(), name="project-list"
    ),
    path(
        "projects/<int:pk>/",
        views.AnalysisProjectDetailView.as_view(),
        name="project-detail",
    ),
    # Geometry and file management
    path(
        "geometries/", views.GeometryInputListCreateView.as_view(), name="geometry-list"
    ),
    path("uploads/", views.FileUploadListCreateView.as_view(), name="upload-list"),
    # Legacy authentication endpoints (for backward compatibility)
    path(
        "earth-engine/update/",
        views.update_earth_engine_auth,
        name="update-earth-engine-auth",
    ),
    path(
        "earth-engine/check/",
        views.check_earth_engine_auth,
        name="check-earth-engine-auth",
    ),
]
