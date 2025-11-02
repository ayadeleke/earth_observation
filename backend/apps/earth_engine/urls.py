from django.urls import path
from .views import health_check, earth_engine_status

app_name = 'earth_engine'

urlpatterns = [
    path("health/", health_check, name="earth_engine_health"),
    path("status/", earth_engine_status, name="earth_engine_status"),
]
