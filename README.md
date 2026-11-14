# Taller Django + React · Histórico meteorológico

Aplicación web que ingiere, almacena y analiza el **histórico meteorológico
multianual** de varias ciudades de Colombia y la región usando la API pública
de **Open-Meteo**. Backend en Django + Django REST Framework (PostgreSQL),
frontend en React + Vite con gráficas Recharts, listo para desplegar en Render.

- API REST completa en `/api/` con CRUD de mediciones, búsqueda, orden,
  filtros, paginación y agregaciones del ORM.
- **Comparador de ciudades** — gráfica de líneas con varias ciudades
  superpuestas sobre la temperatura media mensual.
- **Apartado «Acerca de»** — indica quién desarrolló el proyecto y describe la
  funcionalidad agregada (el comparador de ciudades). El texto se edita en
  `Frontend/src/features/acerca/datosProyecto.js`.
- **Exportar a CSV** — descarga las mediciones filtradas como archivo CSV
  (compatible con Excel, UTF-8 con BOM).
- **Formulario modal de creación/edición** — alta y edición de mediciones
  desde el panel (no solo desde `/admin/`).
- Ingesta masiva desde Open-Meteo con `bulk_create` y limpieza de nulos.
- Estadísticas dinámicas con `aggregate` y `annotate` agrupadas por ciudad
  (dimensión geográfica) y por mes (dimensión temporal).
- Autenticación por token (`Authorization: Token …`) y operación protegida
  para la inyección masiva, el CRUD y el vaciado de la tabla.
- Clima actual en vivo desde Open-Meteo (`current`).
- Panel de React integrado dentro de Django (misma URL en producción).
- **50 ciudades en los 5 continentes** — ~36 500 mediciones por 2 años.

## Requisitos

- Python 3.13 o superior
- Node.js 20.19+ o 22.12+
- PostgreSQL 16+

## Primera vez

Sigue la [guía de inicio rápido](docs/01-inicio-rapido.md). Explica cómo crear
la base, configurar el archivo `.env`, sembrar ciudades y descargar el
histórico.

## Arrancar después de la instalación

Abre dos terminales.

En la primera, desde la carpeta del proyecto:

```powershell
cd Backend
.\venv\Scripts\Activate.ps1        # Linux/macOS: source venv/bin/activate
python manage.py migrate
python manage.py crear_admin
python manage.py descargar_clima --sembrar-ciudades --cantidad-anios 2
python manage.py runserver
```

En la segunda:

```powershell
cd Frontend
npm install
npm run dev
```

Abre el panel en <http://localhost:5173>. Django escucha en
<http://localhost:8000>.

## Endpoints

| Método | Ruta                                | Descripción                                   |
|--------|-------------------------------------|-----------------------------------------------|
| GET    | `/api/estado/`                      | Diagnóstico del backend                       |
| GET    | `/api/ciudades/`                    | Listado de ciudades                           |
| GET    | `/api/mediciones/`                  | Listado paginado con filtros                 |
| GET    | `/api/mediciones/{id}/`             | Detalle de una medición                      |
| POST   | `/api/mediciones/`                   | Crear (token)                                 |
| PUT    | `/api/mediciones/{id}/`              | Editar (token)                                |
| DELETE | `/api/mediciones/{id}/`              | Borrar (token)                                |
| GET    | `/api/mediciones/exportar/`         | Descarga CSV con los mismos filtros           |
| GET    | `/api/mediciones/comparador/`       | Serie mensual de temp_media para varias ciudades |
| POST   | `/api/mediciones/inyeccion/`        | Ingesta masiva Open-Meteo (token)             |
| GET    | `/api/mediciones/estadisticas/`     | Métricas ORM por ciudad y por mes             |
| GET    | `/api/mediciones/clima-actual/`     | Condiciones actuales Open-Meteo               |
| DELETE | `/api/mediciones/limpieza/`         | Vaciar tabla (token + confirmar)              |
| POST   | `/api/auth/login/`                  | Login → token                                 |

Detalle completo en [docs/04-api-clima.md](docs/04-api-clima.md).

## Guías

- [Inicio rápido](docs/01-inicio-rapido.md)
- [Arquitectura](docs/02-arquitectura.md)
- [Solución de problemas](docs/03-solucion-de-problemas.md)
- [API de clima](docs/04-api-clima.md)

## Créditos

Datos meteorológicos: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0).
Licencia MIT.
