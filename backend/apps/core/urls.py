"""
URL patterns for the core app for authentication and basic functionality.
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from . import views
from . import ai_views

urlpatterns = [
    # Authentication endpoints
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("profile/", views.UserProfileView.as_view(), name="profile"),
    path("auth/google/", views.GoogleOAuthView.as_view(), name="google_oauth"),
    
    # JWT Token management
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("change-password/", views.ChangePasswordView.as_view(), name="change_password"),
    
    # Earth Engine authentication endpoints
    path("check_ee/", views.check_earth_engine, name="check_earth_engine"),
    path("auth/ee/check/", views.check_auth, name="check_auth"),
    path("auth/ee/status/", views.auth_status, name="auth_status"),
    path("auth/ee/clear/", views.clear_auth, name="clear_auth"),
    path("auth/ee/authenticate/", views.authenticate_earth_engine, name="authenticate_earth_engine"),
    
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
    
    # User management
    path("users/me/", views.CurrentUserView.as_view(), name="current_user"),
    path("users/me/projects/", views.UserProjectsView.as_view(), name="user_projects"),
    path("users/me/analyses/", views.UserAnalysesView.as_view(), name="user_analyses"),
    
    # Project-specific endpoints
    path("projects/<int:project_id>/analyses/", views.get_project_analyses, name="project_analyses"),
    
    # AI Assistant endpoints
    path("ai/query/", ai_views.AIQueryView.as_view(), name="ai_query"),
    
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
