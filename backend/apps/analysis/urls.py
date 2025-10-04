"""
URL patterns for the analysis app.
These match the Flask app processing routes.
"""

from django.urls import path
from . import views

urlpatterns = [
    # Health check
    path("health/", views.health_check, name="health_check"),
    # Main processing endpoints for NDVI, LST, and SAR
    path("process_ndvi/", views.process_ndvi, name="process_ndvi"),
    path("process_lst/", views.process_lst, name="process_lst"),
    path("process_sentinel/", views.process_sentinel, name="process_sentinel"),
    path(
        "process_comprehensive/",
        views.process_comprehensive,
        name="process_comprehensive",
    ),
    # Image metadata and selection
    path("get_image_metadata/", views.get_image_metadata, name="get_image_metadata"),
    # Trend analysis
    path("analyze_trends/", views.analyze_trends, name="analyze_trends"),
    # Composite analysis
    path("process_composite/", views.process_composite, name="process_composite"),
    # Database retrieval endpoints
    path("history/", views.get_analysis_history_endpoint, name="analysis_request_list"),
    path(
        "result/<int:analysis_id>/", views.get_analysis_result_endpoint, name="analysis_result"
    ),
    path("delete/<int:analysis_id>/", views.delete_analysis_result_endpoint, name="delete_analysis"),
]
