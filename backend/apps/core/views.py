"""
Core views for the GeoAnalysis Django application.
Provides Earth Engine authentication and basic endpoints for app functionality.
"""

import logging
from datetime import datetime
import requests
import urllib.parse
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView
from django.contrib.auth import logout
from django.contrib.auth.hashers import check_password
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from django.conf import settings
from .models import User, AnalysisProject, GeometryInput, FileUpload
from .permissions import IsOwnerOrReadOnly, IsProjectOwner, CanPerformAnalysis
from .auth_decorators import require_authentication, log_user_action
from .serializers import (
    UserRegistrationSerializer,
    UserSerializer,
    LoginSerializer,
    AnalysisProjectSerializer,
    GeometryInputSerializer,
    FileUploadSerializer,
)

logger = logging.getLogger(__name__)


# Authentication Views
@method_decorator(csrf_exempt, name='dispatch')
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "user": UserSerializer(user).data,
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            },
            status=status.HTTP_201_CREATED,
        )


@method_decorator(csrf_exempt, name='dispatch')
class LoginView(generics.GenericAPIView):
    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "user": UserSerializer(user).data,
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            }
        )


class UserProfileView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def perform_destroy(self, instance):
        """Custom delete behavior - ensure we're deleting the current user"""
        if instance != self.request.user:
            raise PermissionDenied("You can only delete your own account")
        instance.delete()


class LogoutView(APIView):
    """Logout view that blacklists the refresh token"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            
            # Also perform Django logout for session-based auth
            logout(request)
            
            return Response(
                {"message": "Successfully logged out"},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"error": "Invalid token or logout failed"},
                status=status.HTTP_400_BAD_REQUEST
            )


class ChangePasswordView(APIView):
    """Change password view"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        
        if not old_password or not new_password:
            return Response(
                {"error": "Both old and new passwords are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not check_password(old_password, user.password):
            return Response(
                {"error": "Invalid old password"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(new_password) < 8:
            return Response(
                {"error": "New password must be at least 8 characters long"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.set_password(new_password)
        user.save()
        
        return Response(
            {"message": "Password changed successfully"},
            status=status.HTTP_200_OK
        )


class CurrentUserView(generics.RetrieveAPIView):
    """Get current user information"""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserProjectsView(generics.ListAPIView):
    """Get current user's projects"""
    serializer_class = AnalysisProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AnalysisProject.objects.filter(user=self.request.user).order_by('-updated_at')


class UserAnalysesView(APIView):
    """Get current user's analysis history"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # This would integrate with the analysis history from the analysis app
        return Response({
            "message": "User analysis history endpoint",
            "user_id": request.user.id,
            # Add actual analysis history query here
        })


# Project Management Views
class AnalysisProjectListCreateView(generics.ListCreateAPIView):
    serializer_class = AnalysisProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AnalysisProject.objects.filter(user=self.request.user).order_by('-updated_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class AnalysisProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AnalysisProjectSerializer
    permission_classes = [permissions.IsAuthenticated, IsProjectOwner]

    def get_queryset(self):
        return AnalysisProject.objects.filter(user=self.request.user).order_by('-updated_at')


class AnalysisProjectByNameView(APIView):
    """Get project by name for the current user"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_name):
        try:
            # Decode the project name from URL
            decoded_name = urllib.parse.unquote(project_name)
            
            # Find the project by name for the current user
            project = AnalysisProject.objects.get(
                name=decoded_name,
                user=request.user
            )
            
            serializer = AnalysisProjectSerializer(project)
            return Response({
                'success': True,
                'project': serializer.data
            })
            
        except AnalysisProject.DoesNotExist:
            return Response({
                'success': False,
                'error': f'Project "{decoded_name}" not found'
            }, status=404)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=500)


class GeometryInputListCreateView(generics.ListCreateAPIView):
    serializer_class = GeometryInputSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return GeometryInput.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class FileUploadListCreateView(generics.ListCreateAPIView):
    serializer_class = FileUploadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return FileUpload.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# Earth Engine Authentication Views
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def authenticate_earth_engine(request):
    """
    Authenticate user with Earth Engine.
    """
    try:
        project_id = request.data.get('project_id')
        service_account_key = request.data.get('service_account_key')
        
        if not project_id:
            return Response(
                {"error": "Project ID is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update user's Earth Engine authentication
        user = request.user
        user.earth_engine_project_id = project_id
        user.is_earth_engine_authenticated = True
        user.save()
        
        # Store in session as well
        request.session['ee_project_id'] = project_id
        request.session['ee_initialized'] = True
        request.session['ee_auth_time'] = datetime.now().isoformat()
        
        return Response({
            "status": "authenticated",
            "project_id": project_id,
            "message": "Earth Engine authentication successful"
        })
        
    except Exception as e:
        logger.error(f"Earth Engine authentication error: {str(e)}")
        return Response(
            {"error": "Earth Engine authentication failed", "details": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["GET", "POST"])
@permission_classes([permissions.AllowAny])
def check_earth_engine(request):
    """
    Check Earth Engine authentication status.
    """
    try:
        project_id = None

        # Get project ID from request
        if request.method == "POST":
            if hasattr(request, "data") and request.data:
                project_id = request.data.get("project_id")
            else:
                project_id = request.POST.get("project_id")

        # Store project_id in session for future requests
        if project_id:
            request.session["ee_project_id"] = project_id
            request.session["ee_initialized"] = True
            request.session["ee_auth_time"] = datetime.now().isoformat()
            return Response(
                {
                    "status": "initialized",
                    "project_id": project_id,
                    "timestamp": datetime.now().isoformat(),
                }
            )

        # Check stored status
        if not request.session.get("ee_initialized"):
            return Response(
                {
                    "error": "Earth Engine not initialized. Please provide a project ID.",
                    "timestamp": datetime.now().isoformat(),
                }
            )

        return Response(
            {
                "status": "initialized",
                "project_id": request.session.get("ee_project_id"),
                "timestamp": datetime.now().isoformat(),
            }
        )

    except Exception as e:
        logger.error(f"Error in check_earth_engine: {str(e)}")
        return Response(
            {"error": f"Earth Engine check failed: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def check_auth(request):
    """
    Check Earth Engine authentication status.
    """
    try:
        is_authenticated = request.session.get("ee_initialized", False)
        return Response(
            {"authenticated": is_authenticated, "timestamp": datetime.now().isoformat()}
        )
    except Exception as e:
        return Response(
            {"authenticated": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def auth_status(request):
    """
    Get detailed authentication status.
    """
    try:
        is_authenticated = request.session.get("ee_initialized", False)

        status_info = {
            "authenticated": is_authenticated,
            "session_data": {
                "has_auth_flag": "ee_initialized" in request.session,
                "auth_time": request.session.get("ee_auth_time"),
                "project_id": request.session.get("ee_project_id"),
            },
            "timestamp": datetime.now().isoformat(),
        }

        return Response(status_info)

    except Exception as e:
        logger.error(f"Error in auth_status: {str(e)}")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def clear_auth(request):
    """
    Clear Earth Engine authentication.
    """
    try:
        # Clear session data
        request.session.pop("ee_initialized", None)
        request.session.pop("ee_project_id", None)
        request.session.pop("ee_auth_time", None)

        return Response(
            {
                "success": True,
                "message": "Authentication cleared",
                "timestamp": datetime.now().isoformat(),
            }
        )

    except Exception as e:
        logger.error(f"Error in clear_auth: {str(e)}")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def get_analysis_capabilities(request):
    """
    Get available analysis capabilities from the endpoint.
    """
    return Response(
        {
            "available_analyses": [
                {
                    "type": "ndvi",
                    "name": "NDVI Time Series",
                    "description": "Vegetation index analysis using Landsat data",
                    "parameters": ["coordinates", "date_range", "cloud_cover"],
                },
                {
                    "type": "lst",
                    "name": "Land Surface Temperature",
                    "description": "Temperature analysis using Landsat thermal bands",
                    "parameters": ["coordinates", "date_range", "cloud_cover"],
                },
                {
                    "type": "sentinel1",
                    "name": "Sentinel-1 SAR Backscatter",
                    "description": "Radar backscatter analysis for surface monitoring",
                    "parameters": ["coordinates", "date_range", "polarization"],
                },
                {
                    "type": "sentinel2",
                    "name": "Sentinel-2 NDVI",
                    "description": "High-resolution vegetation analysis using Sentinel-2",
                    "parameters": ["coordinates", "date_range", "cloud_cover"],
                },
                {
                    "type": "comprehensive",
                    "name": "Comprehensive Analysis",
                    "description": "Combined NDVI, LST, and Sentinel analysis",
                    "parameters": ["coordinates", "date_range", "analysis_types"],
                },
            ],
            "supported_satellites": ["Landsat", "Sentinel-1", "Sentinel-2"],
            "output_formats": ["JSON", "CSV", "PNG plots"],
            "statistical_features": [
                "Basic statistics (mean, median, std)",
                "Trend analysis",
                "Seasonal decomposition",
                "NDVI categorization",
                "Anomaly detection",
            ],
            "date_range_types": ["years", "dates"],
            "cloud_cover_range": [0, 100],
            "max_file_size": getattr(settings, "FILE_UPLOAD_MAX_MEMORY_SIZE", 16777216),
        }
    )


@api_view(["GET", "POST"])
@permission_classes([permissions.AllowAny])
def demo_endpoint(request):
    """
    Demo mode endpoint for testing without Earth Engine.
    """
    try:
        # Default demo parameters
        default_params = {
            "start_date": "2020-01-01",
            "end_date": "2023-12-31",
            "date_range_type": "years",
            "cloud_cover": 20,
            "analysis_type": "ndvi",
        }

        # Extract parameters from query params or POST data
        if request.method == "POST":
            if hasattr(request, "data") and request.data:
                for key in default_params.keys():
                    if key in request.data:
                        default_params[key] = request.data[key]
            else:
                for key in default_params.keys():
                    if key in request.POST:
                        default_params[key] = request.POST[key]
        else:
            for key in default_params.keys():
                if key in request.GET:
                    default_params[key] = request.GET[key]

        # Generate demo data based on analysis type
        if default_params["analysis_type"] == "lst":
            demo_data = [
                {"date": "2020-06-15", "lst": 298.5, "count": 150},
                {"date": "2021-06-15", "lst": 301.2, "count": 142},
                {"date": "2022-06-15", "lst": 299.8, "count": 138},
                {"date": "2023-06-15", "lst": 302.1, "count": 155},
            ]
            stats = {
                "mean": 300.4,
                "median": 300.0,
                "std": 1.6,
                "min": 298.5,
                "max": 302.1,
                "count": 4,
            }
        elif default_params["analysis_type"] == "sentinel1":
            demo_data = [
                {"date": "2020-06-15", "backscatter_vv": -12.5, "count": 150},
                {"date": "2021-06-15", "backscatter_vv": -11.8, "count": 142},
                {"date": "2022-06-15", "backscatter_vv": -12.2, "count": 138},
                {"date": "2023-06-15", "backscatter_vv": -11.5, "count": 155},
            ]
            stats = {
                "mean": -12.0,
                "median": -12.0,
                "std": 0.4,
                "min": -12.5,
                "max": -11.5,
                "count": 4,
            }
        else:  # Default to NDVI
            demo_data = [
                {"date": "2020-06-15", "ndvi": 0.65, "count": 150},
                {"date": "2021-06-15", "ndvi": 0.72, "count": 142},
                {"date": "2022-06-15", "ndvi": 0.68, "count": 138},
                {"date": "2023-06-15", "ndvi": 0.74, "count": 155},
            ]
            stats = {
                "mean": 0.6975,
                "median": 0.695,
                "std": 0.0387,
                "min": 0.65,
                "max": 0.74,
                "count": 4,
            }

        demo_result = {
            "success": True,
            "demo_mode": True,
            "analysis_type": default_params["analysis_type"],
            "parameters": default_params,
            "data": demo_data,
            "statistics": stats,
            "message": f'Demo {default_params["analysis_type"].upper()} analysis completed',
            "timestamp": datetime.now().isoformat(),
        }

        return Response(demo_result)

    except Exception as e:
        logger.error(f"Error in demo_endpoint: {str(e)}")
        return Response(
            {"error": f"Demo mode error: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# Legacy authentication methods (for backward compatibility)
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def update_earth_engine_auth(request):
    """Update user's Earth Engine authentication status"""
    user = request.user
    project_id = request.data.get("project_id")
    is_authenticated = request.data.get("is_authenticated", False)

    if project_id:
        user.earth_engine_project_id = project_id

    user.is_earth_engine_authenticated = is_authenticated
    user.save()

    return Response(
        {
            "message": "Earth Engine authentication updated",
            "user": UserSerializer(user).data,
        }
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def check_earth_engine_auth(request):
    """Check user's Earth Engine authentication status"""
    user = request.user
    return Response(
        {
            "is_authenticated": user.is_earth_engine_authenticated,
            "project_id": user.earth_engine_project_id,
        }
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def get_project_analyses(request, project_id):
    """Get all analyses for a specific project"""
    try:
        # Verify project ownership
        project = AnalysisProject.objects.get(id=project_id, user=request.user)
        
        # Import AnalysisRequest model
        from apps.analysis.models import AnalysisRequest
        
        # Get all analyses for this project
        analyses = AnalysisRequest.objects.filter(project=project).order_by('-created_at')
        
        analyses_data = []
        for analysis in analyses:
            analysis_data = {
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
            }
            
            # Add result data if available
            if hasattr(analysis, 'result') and analysis.result:
                # The analysis.result.data contains the complete response structure
                saved_response = analysis.result.data
                
                # Return the complete response structure so frontend can process it normally
                analysis_data['results'] = saved_response
                
                # Also extract specific fields for backward compatibility
                if isinstance(saved_response, dict):
                    analysis_data['statistics'] = saved_response.get('statistics')
                    analysis_data['data'] = saved_response.get('data', [])
                    analysis_data['time_series_data'] = saved_response.get('time_series_data', [])
                    analysis_data['geometry'] = saved_response.get('geometry')
                    analysis_data['analysis_type'] = saved_response.get('analysis_type')
                    analysis_data['satellite'] = saved_response.get('satellite')
                
                analysis_data['total_observations'] = analysis.result.total_observations
            
            analyses_data.append(analysis_data)
        
        return Response({
            "success": True,
            "project": {
                "id": project.id,
                "name": project.name,
                "description": project.description
            },
            "analyses": analyses_data,
            "count": len(analyses_data)
        })
        
    except AnalysisProject.DoesNotExist:
        return Response(
            {"error": "Project not found or access denied"}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {"error": f"Failed to retrieve project analyses: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@method_decorator(csrf_exempt, name='dispatch')
class GoogleOAuthView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        """
        Handle Google OAuth authentication
        """
        try:
            access_token = request.data.get('access_token')
            user_info = request.data.get('user_info')
            
            if not access_token or not user_info:
                return Response(
                    {"error": "Access token and user info are required"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Verify the access token with Google
            google_response = requests.get(
                f'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token={access_token}'
            )
            
            if google_response.status_code != 200:
                return Response(
                    {"error": "Invalid access token"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            token_info = google_response.json()
            
            # Extract user information
            email = user_info.get('email')
            name = user_info.get('name', '')
            google_id = user_info.get('id')
            
            if not email:
                return Response(
                    {"error": "Email is required"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if user exists
            try:
                user = User.objects.get(email=email)
                # Update user info if needed
                if name and not user.first_name:
                    name_parts = name.split(' ', 1)
                    user.first_name = name_parts[0]
                    if len(name_parts) > 1:
                        user.last_name = name_parts[1]
                    user.save()
            except User.DoesNotExist:
                # Create new user
                name_parts = name.split(' ', 1) if name else ['', '']
                user = User.objects.create_user(
                    username=email,  # Use email as username
                    email=email,
                    first_name=name_parts[0] if name_parts else '',
                    last_name=name_parts[1] if len(name_parts) > 1 else '',
                    is_active=True
                )
                # Set an unusable password since they're using OAuth
                user.set_unusable_password()
                user.save()
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            
            # Create user response data
            user_data = {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
            }
            
            return Response({
                'message': 'Google authentication successful',
                'user': user_data,
                'token': str(refresh.access_token),
                'refresh': str(refresh),
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Google OAuth error: {str(e)}")
            return Response(
                {"error": "Authentication failed"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
