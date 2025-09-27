"""
Core views for the GeoAnalysis Django application.
Provides Earth Engine authentication and basic endpoints that match the Flask app functionality.
"""
import logging
from datetime import datetime
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import login
from django.conf import settings
from .models import User, AnalysisProject, GeometryInput, FileUpload
from .serializers import (
    UserRegistrationSerializer, UserSerializer, LoginSerializer,
    AnalysisProjectSerializer, GeometryInputSerializer, FileUploadSerializer
)

logger = logging.getLogger(__name__)


# Authentication Views
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
        
        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }, status=status.HTTP_201_CREATED)


class LoginView(generics.GenericAPIView):
    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


# Project Management Views
class AnalysisProjectListCreateView(generics.ListCreateAPIView):
    serializer_class = AnalysisProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AnalysisProject.objects.filter(user=self.request.user)


class AnalysisProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AnalysisProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AnalysisProject.objects.filter(user=self.request.user)


class GeometryInputListCreateView(generics.ListCreateAPIView):
    serializer_class = GeometryInputSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return GeometryInput.objects.filter(user=self.request.user)


class FileUploadListCreateView(generics.ListCreateAPIView):
    serializer_class = FileUploadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return FileUpload.objects.filter(user=self.request.user)


# Earth Engine Authentication Views (matching Flask routes)
@api_view(['GET', 'POST'])
@permission_classes([permissions.AllowAny])
def check_earth_engine(request):
    """
    Check Earth Engine initialization status.
    Matches Flask /check_ee endpoint.
    """
    try:
        project_id = None
        
        # Get project ID from request
        if request.method == 'POST':
            if hasattr(request, 'data') and request.data:
                project_id = request.data.get('project_id')
            else:
                project_id = request.POST.get('project_id')
        
        # Store project_id in session for future requests
        if project_id:
            request.session['ee_project_id'] = project_id
            request.session['ee_initialized'] = True
            request.session['ee_auth_time'] = datetime.now().isoformat()
            return Response({
                'status': 'initialized', 
                'project_id': project_id,
                'timestamp': datetime.now().isoformat()
            })
        
        # Check stored status
        if not request.session.get('ee_initialized'):
            return Response({
                'error': 'Earth Engine not initialized. Please provide a project ID.',
                'timestamp': datetime.now().isoformat()
            })
        
        return Response({
            'status': 'initialized', 
            'project_id': request.session.get('ee_project_id'),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in check_earth_engine: {str(e)}")
        return Response(
            {'error': f'Earth Engine check failed: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def check_auth(request):
    """
    Check Earth Engine authentication status.
    Matches Flask /auth/ee/check endpoint.
    """
    try:
        is_authenticated = request.session.get('ee_initialized', False)
        return Response({
            'authenticated': is_authenticated,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return Response({
            'authenticated': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def auth_status(request):
    """
    Get detailed authentication status.
    Matches Flask /auth/ee/status endpoint.
    """
    try:
        is_authenticated = request.session.get('ee_initialized', False)
        
        status_info = {
            'authenticated': is_authenticated,
            'session_data': {
                'has_auth_flag': 'ee_initialized' in request.session,
                'auth_time': request.session.get('ee_auth_time'),
                'project_id': request.session.get('ee_project_id')
            },
            'timestamp': datetime.now().isoformat()
        }
        
        return Response(status_info)
        
    except Exception as e:
        logger.error(f"Error in auth_status: {str(e)}")
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def clear_auth(request):
    """
    Clear Earth Engine authentication.
    Matches Flask /auth/ee/clear endpoint.
    """
    try:
        # Clear session data
        request.session.pop('ee_initialized', None)
        request.session.pop('ee_project_id', None)
        request.session.pop('ee_auth_time', None)
        
        return Response({
            'success': True, 
            'message': 'Authentication cleared',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in clear_auth: {str(e)}")
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def get_analysis_capabilities(request):
    """
    Get available analysis capabilities.
    Matches Flask /get_analysis_capabilities endpoint.
    """
    return Response({
        'available_analyses': [
            {
                'type': 'ndvi',
                'name': 'NDVI Time Series',
                'description': 'Vegetation index analysis using Landsat data',
                'parameters': ['coordinates', 'date_range', 'cloud_cover']
            },
            {
                'type': 'lst',
                'name': 'Land Surface Temperature',
                'description': 'Temperature analysis using Landsat thermal bands',
                'parameters': ['coordinates', 'date_range', 'cloud_cover']
            },
            {
                'type': 'sentinel1',
                'name': 'Sentinel-1 SAR Backscatter',
                'description': 'Radar backscatter analysis for surface monitoring',
                'parameters': ['coordinates', 'date_range', 'polarization']
            },
            {
                'type': 'sentinel2',
                'name': 'Sentinel-2 NDVI',
                'description': 'High-resolution vegetation analysis using Sentinel-2',
                'parameters': ['coordinates', 'date_range', 'cloud_cover']
            },
            {
                'type': 'comprehensive',
                'name': 'Comprehensive Analysis',
                'description': 'Combined NDVI, LST, and Sentinel analysis',
                'parameters': ['coordinates', 'date_range', 'analysis_types']
            }
        ],
        'supported_satellites': ['Landsat', 'Sentinel-1', 'Sentinel-2'],
        'output_formats': ['JSON', 'CSV', 'PNG plots'],
        'statistical_features': [
            'Basic statistics (mean, median, std)',
            'Trend analysis',
            'Seasonal decomposition',
            'NDVI categorization',
            'Anomaly detection'
        ],
        'date_range_types': ['years', 'dates'],
        'cloud_cover_range': [0, 100],
        'max_file_size': getattr(settings, 'FILE_UPLOAD_MAX_MEMORY_SIZE', 16777216)
    })


@api_view(['GET', 'POST'])
@permission_classes([permissions.AllowAny])
def demo_endpoint(request):
    """
    Demo mode endpoint for testing without Earth Engine.
    Matches Flask /demo endpoint.
    """
    try:
        # Default demo parameters
        default_params = {
            'start_date': '2020-01-01',
            'end_date': '2023-12-31',
            'date_range_type': 'years',
            'cloud_cover': 20,
            'analysis_type': 'ndvi'
        }
        
        # Extract parameters from query params or POST data
        if request.method == 'POST':
            if hasattr(request, 'data') and request.data:
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
        if default_params['analysis_type'] == 'lst':
            demo_data = [
                {'date': '2020-06-15', 'lst': 298.5, 'count': 150},
                {'date': '2021-06-15', 'lst': 301.2, 'count': 142},
                {'date': '2022-06-15', 'lst': 299.8, 'count': 138},
                {'date': '2023-06-15', 'lst': 302.1, 'count': 155}
            ]
            stats = {'mean': 300.4, 'median': 300.0, 'std': 1.6, 'min': 298.5, 'max': 302.1, 'count': 4}
        elif default_params['analysis_type'] == 'sentinel1':
            demo_data = [
                {'date': '2020-06-15', 'backscatter_vv': -12.5, 'count': 150},
                {'date': '2021-06-15', 'backscatter_vv': -11.8, 'count': 142},
                {'date': '2022-06-15', 'backscatter_vv': -12.2, 'count': 138},
                {'date': '2023-06-15', 'backscatter_vv': -11.5, 'count': 155}
            ]
            stats = {'mean': -12.0, 'median': -12.0, 'std': 0.4, 'min': -12.5, 'max': -11.5, 'count': 4}
        else:  # Default to NDVI
            demo_data = [
                {'date': '2020-06-15', 'ndvi': 0.65, 'count': 150},
                {'date': '2021-06-15', 'ndvi': 0.72, 'count': 142},
                {'date': '2022-06-15', 'ndvi': 0.68, 'count': 138},
                {'date': '2023-06-15', 'ndvi': 0.74, 'count': 155}
            ]
            stats = {'mean': 0.6975, 'median': 0.695, 'std': 0.0387, 'min': 0.65, 'max': 0.74, 'count': 4}
        
        demo_result = {
            'success': True,
            'demo_mode': True,
            'analysis_type': default_params['analysis_type'],
            'parameters': default_params,
            'data': demo_data,
            'statistics': stats,
            'message': f'Demo {default_params["analysis_type"].upper()} analysis completed',
            'timestamp': datetime.now().isoformat()
        }
        
        return Response(demo_result)
        
    except Exception as e:
        logger.error(f"Error in demo_endpoint: {str(e)}")
        return Response(
            {'error': f'Demo mode error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# Legacy authentication methods (for backward compatibility)
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def update_earth_engine_auth(request):
    """Update user's Earth Engine authentication status"""
    user = request.user
    project_id = request.data.get('project_id')
    is_authenticated = request.data.get('is_authenticated', False)
    
    if project_id:
        user.earth_engine_project_id = project_id
    
    user.is_earth_engine_authenticated = is_authenticated
    user.save()
    
    return Response({
        'message': 'Earth Engine authentication updated',
        'user': UserSerializer(user).data
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def check_earth_engine_auth(request):
    """Check user's Earth Engine authentication status"""
    user = request.user
    return Response({
        'is_authenticated': user.is_earth_engine_authenticated,
        'project_id': user.earth_engine_project_id
    })
