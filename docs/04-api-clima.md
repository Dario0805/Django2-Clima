# API de clima

Base URL: `/api/` (relativa al host de Django).

Todas las rutas de listado y estadísticas aceptan los filtros descritos.
Las rutas marcadas con **(token)** requieren la cabecera
`Authorization: Token <llave>` obtenida en `/api/auth/login/`.

## Diagnóstico

### `GET /api/estado/`

Batería de diagnóstico del backend. No requiere autenticación.

**Respuesta:**
```json
{
  "base_datos": true,
  "motor_postgres": true,
  "tabla_ciudades": true,
  "tabla_mediciones": true,
  "ciudades_registradas": 10,
  "mediciones_registradas": 7300
}
```

## Ciudades

### `GET /api/ciudades/`

Listado (sin paginar) de ciudades monitorizadas.

**Query params:**
- `search=` — busca en `nombre` y `pais`.
- `ordering=` — `nombre`, `pais`, `latitud` (con `-` para descendente).

**Respuesta:**
```json
[
  {"id": 1, "nombre": "Bogotá", "pais": "Colombia",
   "latitud": "4.711", "longitud": "-74.072", "altitud": 2640},
  {"id": 2, "nombre": "Medellín", "pais": "Colombia", …}
]
```

### `GET /api/ciudades/{id}/`

Detalle de una ciudad.

## Mediciones

### `GET /api/mediciones/`

Listado paginado con búsqueda, orden y filtros.

**Query params:**
- `search=` — busca en `ciudad__nombre` y `ciudad__pais`.
- `ordering=` — `fecha`, `temp_max`, `temp_min`, `temp_media`, `precipitacion`
  (con `-` para descendente).
- `ciudad=` — id de la ciudad.
- `fecha_inicio=` y `fecha_fin=` — rango (YYYY-MM-DD, inclusive).
- `pais=` — filtra por país de la ciudad (case-insensitive).
- `codigo_clima=` — código WMO exacto.
- `page=` y `page_size=` (por defecto 50, máx 500).

**Respuesta (DRF paginada):**
```json
{
  "count": 7300,
  "next": "http://…/api/mediciones/?page=2",
  "previous": null,
  "results": [
    {
      "id": 42,
      "ciudad": 1,
      "ciudad_nombre": "Bogotá",
      "ciudad_pais": "Colombia",
      "fecha": "2024-05-13",
      "temp_max": "19.40",
      "temp_min": "10.20",
      "temp_media": "14.80",
      "precipitacion": "2.10",
      "velocidad_viento": "12.30",
      "codigo_clima": 61
    }
  ]
}
```

### `GET /api/mediciones/{id}/`

Detalle de una medición.

### `POST /api/mediciones/` **(token)**

Crea una medición. Valida rangos (temp ≥ -90, precipitación ≥ 0, etc.).

### `PUT /api/mediciones/{id}/` **(token)**

Edita una medición existente.

### `DELETE /api/mediciones/{id}/` **(token)**

Borra una medición.

## Ingesta masiva

### `POST /api/mediciones/inyeccion/` **(token)**

Descarga el histórico de Open-Meteo para una o varias ciudades y lo inserta
en bloque. Si la combinación `(ciudad, fecha)` ya existe, se omite
(`ignore_conflicts=True`).

**Cuerpo (opcional):**
```json
{
  "ciudades": [1, 2, 3],
  "fecha_inicio": "2023-01-01",
  "fecha_fin": "2023-12-31"
}
```

Si `ciudades` no se envía, descarga para todas. Si falta el rango, usa los
últimos 365 días.

**Respuesta:**
```json
{
  "ciudades_procesadas": 3,
  "filas_recibidas": 1095,
  "creadas": 1095,
  "filas_omitidas_o_duplicadas": 0,
  "total_mediciones": 8395,
  "ms": 4123
}
```

## Estadísticas

### `GET /api/mediciones/estadisticas/`

Métricas calculadas en el motor con `aggregate` y `annotate`, agrupadas por
ciudad (dimensión geográfica) y por mes (dimensión temporal).

**Query params (filtros):** `ciudad`, `fecha_inicio`, `fecha_fin`, `pais`.

**Respuesta:**
```json
{
  "filtros": {"ciudad": "1", "fecha_inicio": "2023-01-01", …},
  "metricas": {
    "total_mediciones": 365,
    "temp_media_promedio": "14.85",
    "temp_maxima": "23.10",
    "temp_minima": "5.20",
    "precipitacion_total": "1043.20",
    "precipitacion_promedio": "2.86",
    "viento_maximo": "41.70"
  },
  "por_ciudad": [
    {
      "ciudad__nombre": "Bogotá",
      "ciudad__pais": "Colombia",
      "mediciones": 365,
      "temp_media_promedio": "14.85",
      "temp_maxima": "23.10",
      "temp_minima": "5.20",
      "precipitacion_total": "1043.20"
    }
  ],
  "por_mes": [
    {
      "mes": "2023-01-01",
      "mediciones": 31,
      "temp_media_promedio": "13.40",
      "temp_maxima": "21.10",
      "temp_minima": "5.20",
      "precipitacion_total": "85.30"
    }
  ]
}
```

## Comparador

### `GET /api/mediciones/comparador/`

Serie mensual de `temp_media` para varias ciudades, pensada para dibujar varias
líneas en un mismo gráfico Recharts.

**Query params:**
- `ciudades=1,2,3` (obligatorio, ids separados por coma, máximo 6).
- `fecha_inicio=` y `fecha_fin=` (opcional, por defecto últimos 12 meses).

**Respuesta:**
```json
{
  "ciudades": 3,
  "fecha_inicio": "2023-11-12",
  "fecha_fin": "2024-11-12",
  "series": [
    {
      "ciudad_id": 1,
      "ciudad": "Bogotá",
      "pais": "Colombia",
      "datos": [
        {"mes": "2023-11-01", "temp_media": 13.4},
        {"mes": "2023-12-01", "temp_media": 13.1}
      ]
    },
    {"ciudad_id": 2, "ciudad": "Tokio", "pais": "Japón", "datos": [...]}
  ]
}
```

## Exportar CSV

### `GET /api/mediciones/exportar/`

Devuelve las mediciones filtradas como archivo CSV (UTF-8 con BOM, para que
Excel lea correctamente las tildes). Acepta los mismos filtros que el listado
(`search`, `ciudad`, `fecha_inicio`, `fecha_fin`, `pais`, `codigo_clima`,
`ordering`) y devuelve el CSV con columnas:

```
ciudad, pais, fecha, temp_max_c, temp_min_c, temp_media_c,
precipitacion_mm, velocidad_viento_kmh, codigo_clima
```

No requiere token. Ejemplo para descargar desde el navegador:

```
http://127.0.0.1:8000/api/mediciones/exportar/?ciudad=1&fecha_inicio=2024-01-01
```

## Clima actual

### `GET /api/mediciones/clima-actual/?ciudad={id}`

Condiciones meteorológicas actuales (live) desde Open-Meteo. No lee la base.

**Respuesta:**
```json
{
  "ciudad": "Bogotá",
  "pais": "Colombia",
  "latitud": 4.711,
  "longitud": -74.072,
  "tiempo": "2024-11-12T14:00",
  "temperatura": 17.4,
  "humedad_relativa": 68,
  "precipitacion": 0.0,
  "codigo_clima": 3,
  "velocidad_viento": 9.8,
  "unidades": {
    "temperatura": "°C",
    "humedad_relativa": "%",
    "precipitacion": "mm",
    "velocidad_viento": "km/h"
  }
}
```

## Limpieza masiva

### `DELETE /api/mediciones/limpieza/` **(token)**

Vacía la tabla de mediciones. Solo para depurar la ingesta. Requiere:

```json
{ "confirmar": true }
```

**Respuesta:**
```json
{ "eliminados": 7300, "ms": 124 }
```

## Autenticación

### `POST /api/auth/login/`

**Cuerpo:**
```json
{ "username": "admin", "password": "admin123" }
```

**Respuesta 200:**
```json
{ "token": "abc123…", "username": "admin", "is_superuser": true }
```

**Respuesta 401:**
```json
{ "detalle": "Credenciales inválidas." }
```

## Códigos WMO de Open-Meteo

| Código | Descripción              |
|--------|--------------------------|
| 0      | Despejado                |
| 1–3    | Parcialmente nublado     |
| 45–48  | Niebla / escarcha        |
| 51–57  | Llovizna                 |
| 61–67  | Lluvia                   |
| 71–77  | Nieve                    |
| 80–82  | Chubascos                |
| 85–86  | Chubascos de nieve       |
| 95–99  | Tormenta / granizo       |
