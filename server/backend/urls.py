"""
URL configuration for aioms_backend project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from api.views import avue_index

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('avue/', avue_index, name='avue_index'),
]

# Serve static files in development
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    # Add specific pattern for avue static files to maintain relative paths
    urlpatterns += static('/avue/', document_root=settings.BASE_DIR / 'static' / 'avue')
