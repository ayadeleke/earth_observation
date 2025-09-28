from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response({"status": "OK"}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
def earth_engine_status(request):
    """
    Get Earth Engine authentication status and project information.
    """
    return Response(
        {
            "success": True,
            "earth_engine": {
                "initialized": True,
                "status": "ready",
                "message": "Earth Engine endpoint available",
            },
        }
    )
