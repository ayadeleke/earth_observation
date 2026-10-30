"""
Main URL configuration for GeoAnalysis project.
"""

from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.visualization.views import serve_generated_map

urlpatterns = [
    # Admin interface
    path("admin/", admin.site.urls),
    # Maps generated at runtime, at the /static/ URLs the analysis endpoints return
    re_path(r"^static/(?P<filename>(?:interactive|simple_analysis)_map_[0-9_]+\.html)$", serve_generated_map),
    # API Documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/swagger/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    # Core routes at root level  
    path("", include("apps.core.urls")),
    path("", include("apps.analysis.urls")),
    # API endpoints with versioning
    path("api/v1/", include("apps.core.urls")),
    path("api/v1/analysis/", include("apps.analysis.urls")),
    path("api/v1/earth-engine/", include("apps.earth_engine.urls")),
    path("api/v1/visualization/", include("apps.visualization.urls")),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
