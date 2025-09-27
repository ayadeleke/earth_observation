from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from .ee_config import get_authentication_info, is_initialized

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    return Response({'status': 'OK'}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def earth_engine_status(request):
    """
    Get Earth Engine authentication status and project information.
    """
    try:
        auth_info = get_authentication_info()
        
        return Response({
            'success': True,
            'earth_engine': {
                'initialized': auth_info['initialized'],
                'project_id': auth_info['project_id'],
                'authentication_method': auth_info['authentication_method'],
                'app_mode': auth_info['app_mode'],
                'app_url': auth_info['app_url']
            },
            'status': 'ready' if auth_info['initialized'] else 'not_initialized',
            'message': 'Earth Engine is ready for analysis' if auth_info['initialized'] else 'Earth Engine not initialized'
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': f'Earth Engine status error: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
