"""Vistas de la API de clima.

Endpoints expuestos bajo /api/:

- estado/                    GET    batería de diagnóstico del taller.
- ciudades/                  GET    listado de ciudades monitorizadas.
- mediciones/                GET    listado paginado con búsqueda, orden y filtros.
- mediciones/{id}/           GET    detalle de una medición.
- mediciones/                POST   crear una medición (requiere token).
- mediciones/{id}/           PUT    editar (requiere token).
- mediciones/{id}/           DELETE borrar (requiere token).
- mediciones/exportar/       GET    descarga CSV con los mismos filtros del listado.
- mediciones/comparador/     GET    serie mensual de temp_media para varias ciudades.
- mediciones/inyeccion/      POST   descarga masiva desde Open-Meteo (requiere token).
- mediciones/estadisticas/   GET    métricas con aggregate y annotate.
- mediciones/clima-actual/   GET    condiciones actuales de una ciudad (Open-Meteo).
- mediciones/limpieza/       DELETE vaciar la tabla (requiere token + confirmar).
- auth/login/                POST   recibe usuario/clave, devuelve token.
"""
import csv
import time

from django.contrib.auth import authenticate
from django.http import HttpResponse
from rest_framework import filters, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token

from .fuente_open_meteo import consultar_actual, descargar_mediciones
from .models import Ciudad, Medicion
from .serializers import CiudadSerializer, MedicionSerializer


# ==============================================================================
# Batería de diagnóstico: GET /api/estado/
# Responde banderas que el panel de React traduce a "operativo / pendiente".
# ==============================================================================
class EstadoView(APIView):
    """Diagnóstico del backend: conexión, motor, tablas y registros."""

    def get(self, request):
        from django.db import connection

        # 1. ¿El motor de la base de datos responde?
        try:
            connection.ensure_connection()
            base_datos_ok = True
        except Exception:
            base_datos_ok = False

        motor = connection.settings_dict.get('ENGINE', '')
        motor_postgres = base_datos_ok and 'postgresql' in motor

        # 2. ¿Las tablas del modelo ya migraron?
        tablas = connection.introspection.table_names()
        tabla_ciudades = 'clima_ciudad' in tablas
        tabla_mediciones = 'clima_medicion' in tablas

        # 3. ¿Cuántos registros hay?
        total_ciudades = Ciudad.objects.count() if tabla_ciudades else 0
        total_mediciones = Medicion.objects.count() if tabla_mediciones else 0

        return Response({
            'base_datos': base_datos_ok,
            'motor_postgres': motor_postgres,
            'tabla_ciudades': tabla_ciudades,
            'tabla_mediciones': tabla_mediciones,
            'ciudades_registradas': total_ciudades,
            'mediciones_registradas': total_mediciones,
        })


# ==============================================================================
# Ciudades: listado simple (no paginado, son pocas decenas).
# ==============================================================================
class CiudadViewSet(viewsets.ReadOnlyModelViewSet):
    """Listado y detalle de ciudades monitorizadas (GET)."""

    queryset = Ciudad.objects.all()
    serializer_class = CiudadSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre', 'pais']
    ordering_fields = ['nombre', 'pais', 'latitud']


# ==============================================================================
# Mediciones: ViewSet completo (lista, detalle, crea, edita, borra) con
# búsqueda, orden y filtrado por ciudad, rango de fechas y código de clima.
# ==============================================================================
class MedicionViewSet(viewsets.ModelViewSet):
    """CRUD de mediciones con búsqueda, orden y filtros en la consulta SQL."""

    queryset = Medicion.objects.select_related('ciudad').all()
    serializer_class = MedicionSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['ciudad__nombre', 'ciudad__pais']
    ordering_fields = ['fecha', 'temp_max', 'temp_min', 'temp_media', 'precipitacion']

    def get_queryset(self):
        """Aplica los filtros opcionales enviados por query string.

        - ciudad: id de la ciudad.
        - fecha_inicio / fecha_fin: rango de fechas (inclusive).
        - codigo_clima: filtrar por código WMO exacto.
        - pais: filtrar por país de la ciudad (cruza por FK).
        """
        qs = super().get_queryset()
        params = self.request.query_params

        ciudad_id = params.get('ciudad')
        if ciudad_id:
            qs = qs.filter(ciudad_id=ciudad_id)

        fecha_inicio = params.get('fecha_inicio')
        if fecha_inicio:
            qs = qs.filter(fecha__gte=fecha_inicio)

        fecha_fin = params.get('fecha_fin')
        if fecha_fin:
            qs = qs.filter(fecha__lte=fecha_fin)

        codigo = params.get('codigo_clima')
        if codigo:
            qs = qs.filter(codigo_clima=codigo)

        pais = params.get('pais')
        if pais:
            qs = qs.filter(ciudad__pais__iexact=pais)

        return qs


# ==============================================================================
# Ingesta masiva: POST /api/mediciones/inyeccion/  (protegido por token)
# Descarga el histórico de Open-Meteo para todas (o algunas) ciudades.
# ==============================================================================
class InyeccionMasivaView(APIView):
    """Descarga masiva desde la API de Open-Meteo.

    Cuerpo JSON opcional:
      {
        "ciudades": [1, 2],          // ids de ciudad; si no, todas.
        "fecha_inicio": "2023-01-01",
        "fecha_fin": "2023-12-31"
      }
    Si falta el rango de fechas, se descargan los últimos 365 días.
    Requiere cabecera Authorization: Token <llave>.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from datetime import date, timedelta

        ids = request.data.get('ciudades')
        qs = Ciudad.objects.all()
        if isinstance(ids, list) and ids:
            qs = qs.filter(id__in=ids)
        ciudades = list(qs)
        if not ciudades:
            return Response(
                {'detalle': 'No hay ciudades registradas para descargar.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        hoy = date.today()
        fecha_inicio = request.data.get('fecha_inicio') or (hoy - timedelta(days=365))
        fecha_fin = request.data.get('fecha_fin') or hoy

        try:
            resultado = descargar_mediciones(ciudades, fecha_inicio, fecha_fin)
        except Exception as error:  # noqa: BLE001 - reportamos el fallo al cliente
            return Response(
                {'detalle': f'No se pudo consultar Open-Meteo: {error}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(resultado)


# ==============================================================================
# Estadísticas con aggregate + annotate:
# GET /api/mediciones/estadisticas/?ciudad=1&fecha_inicio=...&fecha_fin=...
# Métricas en la base de datos, agrupadas por ciudad y por año-mes.
# ==============================================================================
class EstadisticasView(APIView):
    """Métricas del histórico meteorológico calculadas en el motor.

    Recibe los mismos filtros que el listado (ciudad, fecha_inicio,
    fecha_fin, pais) y devuelve:
    - metricas globales: total, promedio y extremos de temp y precip.
    - por_ciudad: conteo y promedios agrupados por ciudad.
    - por_mes: serie temporal con temp_media promedio y precipitación total.
    """

    def get(self, request):
        from django.db.models import Avg, Count, Max, Min, Sum
        from django.db.models.functions import TruncMonth

        qs = Medicion.objects.all()
        params = request.query_params

        ciudad_id = params.get('ciudad')
        if ciudad_id:
            qs = qs.filter(ciudad_id=ciudad_id)

        fecha_inicio = params.get('fecha_inicio')
        if fecha_inicio:
            qs = qs.filter(fecha__gte=fecha_inicio)

        fecha_fin = params.get('fecha_fin')
        if fecha_fin:
            qs = qs.filter(fecha__lte=fecha_fin)

        pais = params.get('pais')
        if pais:
            qs = qs.filter(ciudad__pais__iexact=pais)

        # Métricas globales: una sola consulta SQL con aggregate.
        metricas = qs.aggregate(
            total_mediciones=Count('id'),
            temp_media_promedio=Avg('temp_media'),
            temp_maxima=Max('temp_max'),
            temp_minima=Min('temp_min'),
            precipitacion_total=Sum('precipitacion'),
            precipitacion_promedio=Avg('precipitacion'),
            viento_maximo=Max('velocidad_viento'),
        )

        # Agregación por ciudad (dimensión geográfica) con annotate.
        por_ciudad = (
            qs.values('ciudad__nombre', 'ciudad__pais')
            .annotate(
                mediciones=Count('id'),
                temp_media_promedio=Avg('temp_media'),
                temp_maxima=Max('temp_max'),
                temp_minima=Min('temp_min'),
                precipitacion_total=Sum('precipitacion'),
            )
            .order_by('-precipitacion_total')
        )

        # Agregación por mes (dimensión temporal) con TruncMonth + annotate.
        por_mes = (
            qs.annotate(mes=TruncMonth('fecha'))
            .values('mes')
            .annotate(
                mediciones=Count('id'),
                temp_media_promedio=Avg('temp_media'),
                temp_maxima=Max('temp_max'),
                temp_minima=Min('temp_min'),
                precipitacion_total=Sum('precipitacion'),
            )
            .order_by('mes')
        )

        return Response({
            'filtros': {
                'ciudad': ciudad_id,
                'fecha_inicio': fecha_inicio,
                'fecha_fin': fecha_fin,
                'pais': pais,
            },
            'metricas': metricas,
            'por_ciudad': list(por_ciudad),
            'por_mes': [
                {
                    'mes': fila['mes'].isoformat() if fila['mes'] else None,
                    'mediciones': fila['mediciones'],
                    'temp_media_promedio': fila['temp_media_promedio'],
                    'temp_maxima': fila['temp_maxima'],
                    'temp_minima': fila['temp_minima'],
                    'precipitacion_total': fila['precipitacion_total'],
                }
                for fila in por_mes
            ],
        })


# ==============================================================================
# Clima actual: GET /api/mediciones/clima-actual/?ciudad=1
# Pide el "current" a Open-Meteo (no lee la base de datos).
# ==============================================================================
class ClimaActualView(APIView):
    """Condiciones meteorológicas actuales desde Open-Meteo (en vivo)."""

    def get(self, request):
        ciudad_id = request.query_params.get('ciudad')
        if not ciudad_id:
            return Response(
                {'detalle': 'Parámetro "ciudad" (id) es obligatorio.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            ciudad = Ciudad.objects.get(pk=ciudad_id)
        except Ciudad.DoesNotExist:
            return Response(
                {'detalle': 'La ciudad no existe.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            datos = consultar_actual(ciudad)
        except Exception as error:  # noqa: BLE001
            return Response(
                {'detalle': f'Open-Meteo no respondió: {error}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(datos)


# ==============================================================================
# Limpieza masiva: DELETE /api/mediciones/limpieza/ (protegido por token).
# Requiere {"confirmar": true} en el cuerpo para evitar borrados accidentales.
# ==============================================================================
class LimpiezaMasivaView(APIView):
    """Vacía la tabla de mediciones. Solo para depurar la ingesta.

    Requiere cabecera Authorization: Token <llave> y el cuerpo {"confirmar": true}.
    """

    permission_classes = [IsAuthenticated]

    def delete(self, request):
        confirmar = request.data.get('confirmar') if hasattr(request.data, 'get') else None
        if confirmar is not True:
            return Response(
                {'detalle': 'El cuerpo debe traer {"confirmar": true}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        inicio = time.perf_counter()
        eliminados, _ = Medicion.objects.all().delete()
        ms = (time.perf_counter() - inicio) * 1000
        return Response({'eliminados': eliminados, 'ms': round(ms)})


# ==============================================================================
# Exportar CSV: GET /api/mediciones/exportar/
# Devuelve las mediciones filtradas como CSV para descargar del navegador.
# Acepta los mismos filtros que el listado (search, ciudad, fecha_inicio,
# fecha_fin, pais, codigo_clima, ordering) para respetar el contexto del
# usuario que pulsa "Exportar CSV".
# ==============================================================================
class ExportarCSVView(APIView):
    """Descarga las mediciones filtradas en formato CSV (UTF-8 con BOM)."""

    def get(self, request):
        qs = Medicion.objects.select_related('ciudad').all()
        params = request.query_params

        if params.get('search'):
            # Búsqueda simple OR sobre nombre y país de la ciudad.
            termino = params['search']
            qs = qs.filter(ciudad__nombre__icontains=termino) | qs.filter(
                ciudad__pais__icontains=termino
            )
        if params.get('ciudad'):
            qs = qs.filter(ciudad_id=params['ciudad'])
        if params.get('fecha_inicio'):
            qs = qs.filter(fecha__gte=params['fecha_inicio'])
        if params.get('fecha_fin'):
            qs = qs.filter(fecha__lte=params['fecha_fin'])
        if params.get('pais'):
            qs = qs.filter(ciudad__pais__iexact=params['pais'])
        if params.get('codigo_clima'):
            qs = qs.filter(codigo_clima=params['codigo_clima'])
        # Orden opcional.
        orden = params.get('ordering') or '-fecha'
        qs = qs.order_by(orden)

        respuesta = HttpResponse(content_type='text/csv; charset=utf-8')
        respuesta['Content-Disposition'] = (
            'attachment; filename="mediciones_clima.csv"'
        )
        # BOM UTF-8 para que Excel lea correctamente las tildes.
        respuesta.write('\ufeff')

        writer = csv.writer(respuesta)
        writer.writerow([
            'ciudad', 'pais', 'fecha',
            'temp_max_c', 'temp_min_c', 'temp_media_c',
            'precipitacion_mm', 'velocidad_viento_kmh', 'codigo_clima',
        ])
        for m in qs.iterator(1000):
            writer.writerow([
                m.ciudad.nombre, m.ciudad.pais, m.fecha.isoformat(),
                m.temp_max, m.temp_min, m.temp_media,
                m.precipitacion, m.velocidad_viento, m.codigo_clima,
            ])
        return respuesta


# ==============================================================================
# Comparador: GET /api/mediciones/comparador/?ciudades=1,2,3&fecha_inicio=...
# Devuelve, para cada ciudad seleccionada, la serie mensual de temp_media.
# Pensado para dibujar varias líneas en un mismo gráfico Recharts.
# ==============================================================================
class ComparadorView(APIView):
    """Serie mensual de temperatura media por ciudad (multi-ciudad).

    Parámetros:
    - ciudades=1,2,3 (obligatorio, hasta 6 ids separados por coma).
    - fecha_inicio / fecha_fin (opcional, por defecto últimos 12 meses).
    """

    def get(self, request):
        from django.db.models import Avg
        from django.db.models.functions import TruncMonth

        ids = request.query_params.get('ciudades', '')
        try:
            ciudad_ids = [int(x) for x in ids.split(',') if x.strip()]
        except ValueError:
            return Response(
                {'detalle': 'El parámetro ciudades debe ser ids numéricos separados por coma.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not ciudad_ids:
            return Response(
                {'detalle': 'Parámetro "ciudades" obligatorio (ids separados por coma).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(ciudad_ids) > 6:
            return Response(
                {'detalle': 'Máximo 6 ciudades para comparar a la vez.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from datetime import date, timedelta
        hoy = date.today()
        fecha_inicio = request.query_params.get('fecha_inicio') or (hoy - timedelta(days=365))
        fecha_fin = request.query_params.get('fecha_fin') or hoy

        ciudades = Ciudad.objects.filter(id__in=ciudad_ids)
        if not ciudades.exists():
            return Response(
                {'detalle': 'Ninguna de las ciudades existe.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        series = []
        for ciudad in ciudades:
            filas = (
                Medicion.objects.filter(ciudad=ciudad, fecha__gte=fecha_inicio, fecha__lte=fecha_fin)
                .annotate(mes=TruncMonth('fecha'))
                .values('mes')
                .annotate(temp_media=Avg('temp_media'))
                .order_by('mes')
            )
            series.append({
                'ciudad_id': ciudad.id,
                'ciudad': ciudad.nombre,
                'pais': ciudad.pais,
                'datos': [
                    {
                        'mes': f['mes'].isoformat() if f['mes'] else None,
                        'temp_media': float(f['temp_media']) if f['temp_media'] is not None else None,
                    }
                    for f in filas
                ],
            })

        return Response({
            'ciudades': len(series),
            'fecha_inicio': str(fecha_inicio),
            'fecha_fin': str(fecha_fin),
            'series': series,
        })


# ==============================================================================
# Autenticación: POST /api/auth/login/
# Recibe {"username", "password"}, valida contra usuarios reales de Django y
# entrega un token de acceso (rest_framework.authtoken).
# ==============================================================================
class LlaveView(APIView):
    """Inicia sesión y entrega el token de acceso."""

    def post(self, request):
        usuario = authenticate(
            username=request.data.get('username'),
            password=request.data.get('password'),
        )
        if usuario is None:
            return Response(
                {'detalle': 'Credenciales inválidas.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        llave, _ = Token.objects.get_or_create(user=usuario)
        return Response({
            'token': llave.key,
            'username': usuario.username,
            'is_superuser': usuario.is_superuser,
        })
