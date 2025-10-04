from django.urls import path
from . import views
from . import plot_views

urlpatterns = [
    path('health/', views.health_check, name='visualization_health'),
    path('get_analysis_map/', views.get_analysis_map, name='get_analysis_map'),
    path('create_custom_map/', views.create_custom_map, name='create_custom_map'),
    path('generate_time_series_plot/', plot_views.generate_time_series_plot, name='generate_time_series_plot'),
]
