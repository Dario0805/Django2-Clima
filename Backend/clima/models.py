"""Modelos del dominio meteorológico.

Dos modelos relacionados por llave foránea:
- Ciudad: cada sitio geográfico monitorizado (nombre, país, latitud, longitud).
- Medicion: una observación diaria para esa ciudad (temperatura, precipitación,
  viento y código de clima). El par (ciudad, fecha) es único, así la ingesta
  masiva se puede repetir sin duplicar filas (bulk_create + ignore_conflicts).

Con esto las agregaciones del ORM pueden agrupar por ciudad (dimensión
geográfica) y por fecha (dimensión temporal: año, mes), cumpliendo el requisito
del taller de cruzar al menos dos dimensiones.
"""
from django.db import models


class Ciudad(models.Model):
    """Sitio geográfico monitorizado por Open-Meteo."""

    nombre = models.CharField(max_length=120)
    pais = models.CharField(max_length=80)
    latitud = models.DecimalField(max_digits=5, decimal_places=3)
    longitud = models.DecimalField(max_digits=6, decimal_places=3)
    altitud = models.IntegerField(default=0, help_text='metros sobre el nivel del mar')

    class Meta:
        ordering = ['pais', 'nombre']
        constraints = [
            models.UniqueConstraint(
                fields=['latitud', 'longitud'],
                name='coordenadas_unicas_ciudad',
            ),
        ]
        verbose_name = 'Ciudad'
        verbose_name_plural = 'Ciudades'

    def __str__(self):
        return f'{self.nombre} ({self.pais})'


class Medicion(models.Model):
    """Una observación meteorológica diaria de Open-Meteo para una ciudad.

    El par (ciudad, fecha) es único: la ingesta masiva puede ejecutarse varias
    veces y `bulk_create(ignore_conflicts=True)` evita duplicados sin leer las
    filas existentes en Python.
    """

    ciudad = models.ForeignKey(
        Ciudad,
        on_delete=models.CASCADE,
        related_name='mediciones',
    )
    fecha = models.DateField()
    temp_max = models.DecimalField(max_digits=5, decimal_places=2, help_text='°C')
    temp_min = models.DecimalField(max_digits=5, decimal_places=2, help_text='°C')
    temp_media = models.DecimalField(max_digits=5, decimal_places=2, help_text='°C')
    precipitacion = models.DecimalField(max_digits=7, decimal_places=2, help_text='mm')
    velocidad_viento = models.DecimalField(
        max_digits=6, decimal_places=2, help_text='km/h', default=0
    )
    codigo_clima = models.PositiveSmallIntegerField(
        default=0,
        help_text='Código WMO de Open-Meteo (0 = despejado)',
    )

    class Meta:
        ordering = ['ciudad', '-fecha']
        constraints = [
            models.UniqueConstraint(
                fields=['ciudad', 'fecha'],
                name='ciudad_fecha_unicas',
            ),
        ]
        indexes = [
            models.Index(fields=['fecha']),
            models.Index(fields=['ciudad', 'fecha']),
        ]
        verbose_name = 'Medición'
        verbose_name_plural = 'Mediciones'

    def __str__(self):
        return f'{self.ciudad.nombre} · {self.fecha} · media {self.temp_media}°C'
