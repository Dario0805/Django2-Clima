"""Serializers de la API de clima."""

from rest_framework import serializers

from .models import Ciudad, Medicion


class CiudadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ciudad
        fields = '__all__'


class MedicionSerializer(serializers.ModelSerializer):
    ciudad_nombre = serializers.CharField(source='ciudad.nombre', read_only=True)
    ciudad_pais = serializers.CharField(source='ciudad.pais', read_only=True)

    class Meta:
        model = Medicion
        fields = '__all__'
        extra_kwargs = {
            'temp_max': {'min_value': -90},
            'temp_min': {'min_value': -90},
            'temp_media': {'min_value': -90},
            'precipitacion': {'min_value': 0},
            'velocidad_viento': {'min_value': 0},
        }
