# Arquitectura

## Estructura de carpetas

```
Taller-Django-Final/
├── Backend/                          # Django + DRF
│   ├── config/                       # settings, urls, wsgi, asgi
│   ├── clima/                        # app del dominio meteorológico
│   │   ├── models.py                 # Ciudad (FK target) + Medicion
│   │   ├── serializers.py            # CiudadSerializer + MedicionSerializer
│   │   ├── views.py                  # ViewSet, estadísticas, auth, ingesta
│   │   ├── urls.py                   # rutas de /api/
│   │   ├── paginacion.py             # paginador global
│   │   ├── admin.py                  # panel /admin/ con columnas, search, filtros
│   │   ├── fuente_open_meteo.py     # cliente de la API pública Open-Meteo
│   │   └── management/commands/
│   │       ├── descargar_clima.py   # ingesta masiva desde terminal
│   │       └── crear_admin.py       # crea superusuario demo
│   ├── static_frontend/              # build de producción de React
│   ├── .env / .env.example
│   ├── requirements.txt
│   ├── Procfile                      # gunicorn para Render
│   └── manage.py
├── Frontend/                         # React + Vite
│   ├── public/
│   ├── src/
│   │   ├── main.jsx                  # entrada
│   │   ├── app/App.jsx               # shell con tabs y footer sticky
│   │   ├── shared/
│   │   │   ├── api.js                # cliente HTTP + token + errores
│   │   │   └── styles.css            # estilos globales
│   │   └── features/
│   │       ├── auth/Sesion.jsx
│   │       ├── ciudades/CiudadSelector.jsx
│   │       ├── mediciones/Listado.jsx
│   │       ├── estadisticas/{Tablero,GraficaMes,GraficaCiudades}.jsx
│   │       ├── ingesta/InyeccionMasiva.jsx
│   │       └── clima-actual/ClimaActual.jsx
│   ├── vite.config.js
│   ├── package.json
│   └── index.html
├── docs/                              # guías
├── render.yaml                        # configuración de despliegue
├── .gitignore
└── README.md
```

## Modelo de datos

```
Ciudad (1) ─── (N) Medicion
```

- `Ciudad`: `nombre, pais, latitud, longitud, altitud`. Unique en `(latitud, longitud)`.
- `Medicion`: `ciudad (FK), fecha, temp_max, temp_min, temp_media,
  precipitacion, velocidad_viento, codigo_clima`. Unique en `(ciudad, fecha)`
  → la ingesta puede repetirse sin duplicados.

Las agregaciones del ORM trabajan sobre dos dimensiones:
- **Geográfica**: `values('ciudad__nombre')` + `annotate(…)`.
- **Temporal**: `TruncMonth('fecha')` + `annotate(…)`.

## Flujo de la ingesta masiva

1. El operador (autenticado con token) dispara
   `POST /api/mediciones/inyeccion/` o ejecuta
   `python manage.py descargar_clima`.
2. `fuente_open_meteo.consultar_historico(ciudad, inicio, fin)` pide a
   `https://archive-api.open-meteo.com/v1/archive` el rango diario.
3. Cada fila del JSON se valida: se descartan filas sin temperaturas, se
   rellena `temp_media` con el promedio si falta, se sustituyen nulos por 0
   en precipitación y viento. Las fechas inválidas se omiten.
4. `descargar_mediciones` acumula todas las filas en una lista y hace un único
   `Medicion.objects.bulk_create(lista, batch_size=1000, ignore_conflicts=True)`.
   El constraint `(ciudad, fecha)` evita duplicados sin leer la tabla previa.
5. La respuesta informa filas recibidas, creadas, omitidas, total y tiempo.

## Autenticación por token

- `POST /api/auth/login/` valida contra `django.contrib.auth.models.User` y
  devuelve `{token, username, is_superuser}`.
- El token se guarda en `localStorage` (`taller-clima-token`).
- Las vistas protegidas (`InyeccionMasivaView`, `LimpiezaMasivaView`) declaran
  `permission_classes = [IsAuthenticated]` → 401 sin cabecera válida.
- El frontend adjunta `Authorization: Token <key>` con `authHeader()`.

## Producción (Render)

1. Render crea un PostgreSQL y une `DATABASE_URL` al servicio web.
2. Build: `pip install`, `npm ci && npm run build` (Vite vuelca a
   `Backend/static_frontend`), `collectstatic`, `migrate`.
3. Start: `gunicorn config.wsgi:application` + WhiteNoise sirve estáticos.
4. Django entrega el panel de React en la raíz `/`, la API en `/api/` y el
   admin en `/admin/` desde la misma URL pública.

## CORS y CSRF

- En desarrollo: `CORS_ALLOWED_ORIGINS = ['http://localhost:5173', …]`.
- En producción: `CSRF_TRUSTED_ORIGINS` con la URL pública de Render.
- `CorsMiddleware` se incluye antes de `CommonMiddleware`.
