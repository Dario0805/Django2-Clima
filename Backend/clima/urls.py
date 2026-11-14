"""Rutas de la API de clima."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CiudadViewSet,
    ClimaActualView,
    ComparadorView,
    EstadoView,
    EstadisticasView,
    ExportarCSVView,
    InyeccionMasivaView,
    LimpiezaMasivaView,
    LlaveView,
    MedicionViewSet,
)

router = DefaultRouter()
router.register('ciudades', CiudadViewSet, basename='ciudad')
router.register('mediciones', MedicionViewSet, basename='medicion')

urlpatterns = [
    path('estado/', EstadoView.as_view(), name='estado-taller'),

    # Ingesta, estadísticas, comparador, exportar CSV, clima actual y limpieza
    # (rutas fijas antes del router para que el DefaultRouter no las capture).
    path('mediciones/inyeccion/', InyeccionMasivaView.as_view(), name='inyeccion-masiva'),
    path('mediciones/estadisticas/', EstadisticasView.as_view(), name='estadisticas'),
    path('mediciones/comparador/', ComparadorView.as_view(), name='comparador'),
    path('mediciones/exportar/', ExportarCSVView.as_view(), name='exportar-csv'),
    path('mediciones/clima-actual/', ClimaActualView.as_view(), name='clima-actual'),
    path('mediciones/limpieza/', LimpiezaMasivaView.as_view(), name='limpieza'),

    # Autenticación por token.
    path('auth/login/', LlaveView.as_view(), name='llave-de-acceso'),

    # CRUD de ciudades y mediciones.
    *router.urls,
]
