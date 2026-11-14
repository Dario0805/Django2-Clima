"""Encapsula el acceso a la API pública de Open-Meteo.

Dos servicios:
- consultar_historico(fecha_inicio, fecha_fin, latitud, longitud):
  serie histórica diaria. Sin API key, hasta 10 000 llamadas/día.
- consultar_actual(latitud, longitud): condiciones meteorológicas actuales.

La API devuelve JSON con arrays paralelos (uno por variable meteorológica) que
convertimos en diccionarios de mediciones para que el ViewSet y el comando de
gestión los persistan con bulk_create.

Documentación:
- Histórico: https://open-meteo.com/en/docs/historical-weather-api
- Pronóstico (incluye `current`): https://open-meteo.com/en/docs
"""
from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Iterable
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings

from .models import Ciudad, Medicion


URL_HISTORICO = getattr(
    settings, 'OPEN_METEO_BASE_HISTORICO', 'https://archive-api.open-meteo.com/v1/archive'
)
URL_PRONOSTICO = getattr(
    settings, 'OPEN_METEO_BASE_PRONOSTICO', 'https://api.open-meteo.com/v1/forecast'
)

VARIABLES_HISTORICO = (
    'temperature_2m_max',
    'temperature_2m_min',
    'temperature_2m_mean',
    'precipitation_sum',
    'windspeed_10m_max',
    'weather_code',
)


def _get_json(url: str, timeout: int = 90) -> dict:
    """Realiza la petición GET a Open-Meteo y devuelve el JSON ya parseado.

    Open-Meteo limita a 5 peticiones/segundo en el plan gratis. Si responde
    429 (Too Many Requests) o lanza un error transitorio, reintenta con
    backoff exponencial (5s, 10s, 20s, 40s) hasta 4 intentos.
    """
    import time
    from urllib.error import HTTPError, URLError

    INTENTOS = 4
    PAUSAS = [5, 10, 20, 40]  # segundos entre reintentos ante 429

    for intento in range(INTENTOS):
        try:
            solicitud = Request(
                url,
                headers={'Accept': 'application/json', 'User-Agent': 'taller-clima/1.0'},
            )
            with urlopen(solicitud, timeout=timeout) as respuesta:
                cuerpo = respuesta.read().decode('utf-8')
            datos = json.loads(cuerpo)
            if not isinstance(datos, dict):
                raise ValueError('Open-Meteo no devolvió un objeto JSON.')
            if 'error' in datos:
                # Algunos errores de Open-Meteo vienen en el cuerpo con código 429
                raise ValueError(
                    f"Open-Meteo rechazó la petición: {datos.get('reason', datos['error'])}"
                )
            return datos
        except HTTPError as e:
            if e.code == 429 and intento < INTENTOS - 1:
                pausa = PAUSAS[intento]
                print(f'  Open-Meteo respondió 429 (Too Many Requests). '
                      f'Esperando {pausa}s antes de reintentar ({intento + 2}/{INTENTOS})…')
                time.sleep(pausa)
                continue
            raise
        except (URLError, TimeoutError, ConnectionError) as e:
            if intento < INTENTOS - 1:
                pausa = PAUSAS[intento]
                print(f'  Error de red ({e.__class__.__name__}). '
                      f'Esperando {pausa}s antes de reintentar ({intento + 2}/{INTENTOS})…')
                time.sleep(pausa)
                continue
            raise
    raise RuntimeError('Open-Meteo no respondió después de varios reintentos.')


def consultar_historico(
    ciudad: Ciudad,
    fecha_inicio,
    fecha_fin,
) -> list[Medicion]:
    """Pide el histórico diario de Open-Meteo y lo convierte en Medicion.

    Devuelve una lista de instancias NO guardadas: bulk_create se hace en el
    ViewSet/Command para garantizar atomicidad y evitar leer filas existentes.
    Las filas con datos inválidos o nulos se descartan (limpieza en ingesta).
    """
    if isinstance(fecha_inicio, date):
        fecha_inicio = fecha_inicio.isoformat()
    if isinstance(fecha_fin, date):
        fecha_fin = fecha_fin.isoformat()

    parametros = {
        'latitude': float(ciudad.latitud),
        'longitude': float(ciudad.longitud),
        'start_date': fecha_inicio,
        'end_date': fecha_fin,
        'daily': ','.join(VARIABLES_HISTORICO),
        'timezone': 'America/Bogota',
    }
    url = f'{URL_HISTORICO}?{urlencode(parametros)}'
    payload = _get_json(url)

    diario = payload.get('daily') or {}
    fechas: list[str] = diario.get('time') or []
    if not fechas:
        return []

    def _a_decimal(valor) -> Decimal | None:
        if valor is None:
            return None
        try:
            return Decimal(str(valor)).quantize(Decimal('0.01'))
        except (InvalidOperation, TypeError, ValueError):
            return None

    mediciones: list[Medicion] = []
    for i, fecha_iso in enumerate(fechas):
        temp_max = _a_decimal(diario.get('temperature_2m_max', [None])[i] if i < len(diario.get('temperature_2m_max', [])) else None)
        temp_min = _a_decimal(diario.get('temperature_2m_min', [None])[i] if i < len(diario.get('temperature_2m_min', [])) else None)
        temp_media = _a_decimal(diario.get('temperature_2m_mean', [None])[i] if i < len(diario.get('temperature_2m_mean', [])) else None)
        precip = _a_decimal(diario.get('precipitation_sum', [None])[i] if i < len(diario.get('precipitation_sum', [])) else None)
        viento = _a_decimal(diario.get('windspeed_10m_max', [None])[i] if i < len(diario.get('windspeed_10m_max', [])) else None)
        codigo = diario.get('weather_code', [None])[i] if i < len(diario.get('weather_code', [])) else None

        # Limpieza: si falta temperatura máxima y mínima, se descarta la fila.
        if temp_max is None and temp_min is None:
            continue
        # Si falta la media, se aproxima al promedio de max y min.
        if temp_media is None and temp_max is not None and temp_min is not None:
            temp_media = ((temp_max + temp_min) / 2).quantize(Decimal('0.01'))
        if temp_media is None:
            continue
        if precip is None:
            precip = Decimal('0.00')
        if viento is None:
            viento = Decimal('0.00')

        try:
            fecha_real = datetime.strptime(str(fecha_iso), '%Y-%m-%d').date()
        except ValueError:
            continue

        mediciones.append(
            Medicion(
                ciudad=ciudad,
                fecha=fecha_real,
                temp_max=temp_max,
                temp_min=temp_min,
                temp_media=temp_media,
                precipitacion=precip,
                velocidad_viento=viento,
                codigo_clima=int(codigo) if codigo is not None else 0,
            )
        )

    return mediciones


def consultar_actual(ciudad: Ciudad) -> dict:
    """Devuelve las condiciones meteorológicas actuales de la ciudad.

    Usa el endpoint de pronóstico con la sección `current` (no requiere API
    key). El panel de React puede mostrarlas en vivo junto al histórico.
    """
    variables = [
        'temperature_2m',
        'relative_humidity_2m',
        'precipitation',
        'weather_code',
        'wind_speed_10m',
    ]
    parametros = {
        'latitude': float(ciudad.latitud),
        'longitude': float(ciudad.longitud),
        'current': ','.join(variables),
        'timezone': 'America/Bogota',
    }
    url = f'{URL_PRONOSTICO}?{urlencode(parametros)}'
    payload = _get_json(url)
    actual = payload.get('current') or {}
    unidades = payload.get('current_units') or {}
    return {
        'ciudad': ciudad.nombre,
        'pais': ciudad.pais,
        'latitud': float(ciudad.latitud),
        'longitud': float(ciudad.longitud),
        'tiempo': actual.get('time'),
        'temperatura': actual.get('temperature_2m'),
        'humedad_relativa': actual.get('relative_humidity_2m'),
        'precipitacion': actual.get('precipitation'),
        'codigo_clima': actual.get('weather_code'),
        'velocidad_viento': actual.get('wind_speed_10m'),
        'unidades': {
            'temperatura': unidades.get('temperature_2m', '°C'),
            'humedad_relativa': unidades.get('relative_humidity_2m', '%'),
            'precipitacion': unidades.get('precipitation', 'mm'),
            'velocidad_viento': unidades.get('wind_speed_10m', 'km/h'),
        },
    }


def descargar_mediciones(ciudades_list, fecha_inicio, fecha_fin) -> dict:
    """Descarga el histórico de varias ciudades y lo inserta en bloque.

    Recorre la lista de ciudades, pide el rango de fechas a Open-Meteo y
    acumula las mediciones en una lista para hacer un único bulk_create con
    `ignore_conflicts=True`: la operación se puede repetir sin duplicar filas
    gracias al constraint UniqueConstraint(ciudad, fecha).

    `ciudades_list` debe ser una lista concreta (no un queryset ya consumido):
    se recorre dos veces (carga y conteo para el informe).
    """
    import time

    ciudades_list = list(ciudades_list)
    inicio = time.perf_counter()

    nuevas: list[Medicion] = []
    total = len(ciudades_list)
    for i, ciudad in enumerate(ciudades_list, start=1):
        # Progreso visible en consola para saber en qué ciudad va.
        print(f'  [{i}/{total}] {ciudad.nombre} ({ciudad.pais})…', flush=True)
        try:
            filas = consultar_historico(ciudad, fecha_inicio, fecha_fin)
        except Exception as error:
            # Si una ciudad falla tras todos los reintentos, se reporta y se
            # continúa con la siguiente para no perder todo el lote.
            print(f'    ! Falló {ciudad.nombre}: {error}', flush=True)
            filas = []
        nuevas.extend(filas)
        # Pausa corta entre ciudades para no golpear el límite de Open-Meteo
        # (5 peticiones/segundo en el plan gratis). 1.2s sobra.
        if i < total:
            time.sleep(1.2)
    recibidas = len(nuevas)

    total_antes = Medicion.objects.count()
    if nuevas:
        Medicion.objects.bulk_create(
            nuevas, batch_size=1000, ignore_conflicts=True,
        )
    total_despues = Medicion.objects.count()
    creados = total_despues - total_antes
    omitidos = recibidas - creados
    ms = (time.perf_counter() - inicio) * 1000

    return {
        'ciudades_procesadas': len(ciudades_list),
        'filas_recibidas': recibidas,
        'creadas': creados,
        'filas_omitidas_o_duplicadas': max(0, omitidos),
        'total_mediciones': total_despues,
        'ms': round(ms),
    }