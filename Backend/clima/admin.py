"""Registro del modelo en el panel de administración de Django."""
from django.contrib import admin

from .models import Ciudad, Medicion


@admin.register(Ciudad)
class CiudadAdmin(admin.ModelAdmin):
    list_display = ('id', 'nombre', 'pais', 'latitud', 'longitud', 'altitud')
    search_fields = ('nombre', 'pais')
    list_filter = ('pais',)
    ordering = ('pais', 'nombre')


@admin.register(Medicion)
class MedicionAdmin(admin.ModelAdmin):
    list_display = (
        'ciudad',
        'fecha',
        'temp_max',
        'temp_min',
        'temp_media',
        'precipitacion',
        'velocidad_viento',
        'codigo_clima',
    )
    search_fields = ('ciudad__nombre', 'ciudad__pais')
    list_filter = ('ciudad__pais', 'ciudad', 'codigo_clima')
    date_hierarchy = 'fecha'
    ordering = ('-fecha',)
