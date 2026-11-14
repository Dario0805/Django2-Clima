"""URL configuration for config project.

La raíz sirve el panel de React compilado (TemplateView apuntando a
static_frontend/index.html). La API cuelga de /api/ y el admin de /admin/.
"""
from django.contrib import admin
from django.urls import include, path
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('clima.urls')),

    # Panel de React compilado para producción (servido por Django).
    path('', TemplateView.as_view(template_name='index.html')),
]
