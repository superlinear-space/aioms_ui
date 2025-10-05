"""
URL configuration for the API app.
"""
from django.urls import path
from . import views

urlpatterns = [
    path('health', views.health_check, name='health_check'),
    path('settings', views.get_app_settings, name='get_app_settings'),
    path('settings/update', views.update_settings, name='update_settings'),
    path('generate_prom_rules', views.generate_prom_rules, name='generate_prom_rules'),
    path('check_superalarm', views.check_superalarm, name='check_superalarm'),
]
