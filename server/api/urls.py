"""
URL configuration for the API app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
import monitor.views

# Create router for DRF ViewSets
router = DefaultRouter()
router.register(r'custom_bigscreen_list', monitor.views.CustomBigScreenListViewSet, 'custom_bigscreen_list')
router.register(r'custom_bigscreen_bus_com', monitor.views.CustomBigScreenBusComViewSet, 'custom_bigscreen_bus_com')
router.register(r'custom_bigscreen', monitor.views.CustomBigScreenViewSet, 'custom_bigscreen')
router.register(r'custom_query', monitor.views.CustomQueryViewSet, 'custom_query')

urlpatterns = [
    path('health', views.health_check, name='health_check'),
    path('settings', views.get_app_settings, name='get_app_settings'),
    path('settings/update', views.update_settings, name='update_settings'),
    path('generate_prom_rules', views.generate_prom_rules, name='generate_prom_rules'),
    path('check_superalarm', views.check_superalarm, name='check_superalarm'),
    # Include DRF router URLs
    path('', include(router.urls)),
]
