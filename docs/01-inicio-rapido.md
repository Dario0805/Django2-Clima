# Inicio rápido

Sigue estos pasos una vez para preparar tu equipo.

## 1. Instala los programas necesarios

- [Python 3.13+](https://www.python.org/downloads/)
- [Node.js 20.19+ o 22.12+](https://nodejs.org/)
- [PostgreSQL 16+](https://www.postgresql.org/download/) y [pgAdmin](https://www.pgadmin.org/download/)
- [Git](https://git-scm.com/downloads)

Comprueba las versiones:

```powershell
python --version
node --version
npm --version
```

## 2. Crea la base de datos

1. Abre pgAdmin y conéctate a PostgreSQL.
2. Botón derecho sobre **Databases → Create → Database**.
3. Llámala `taller_clima` y guarda.

## 3. Prepara Django

```powershell
cd Backend
python -m venv venv
.\venv\Scripts\Activate.ps1          # Linux/macOS: source venv/bin/activate
python -m pip install -r requirements.txt
Copy-Item .env.example .env          # Linux/macOS: cp .env.example .env
```

## 4. Completa `Backend/.env`

Edita `.env` con tus valores:

- `SECRET_KEY`: ejecuta esto para generar una:
  ```powershell
  python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
  ```
- `DEBUG=True`
- `DB_NAME=taller_clima`
- `DB_USER` y `DB_PASSWORD`: tu usuario y clave de PostgreSQL.
- `DB_HOST=localhost` y `DB_PORT=5432`.

## 5. Migra y arranca Django

```powershell
python manage.py check
python manage.py migrate
python manage.py runserver
```

Comprueba que responde en <http://127.0.0.1:8000/api/estado/>.

## 6. Prepara y arranca React

Abre una segunda terminal:

```powershell
cd Frontend
npm install
npm run dev
```

Visita <http://localhost:5173>.

## 7. Crea el usuario administrador y siembra ciudades

```powershell
cd Backend
python manage.py crear_admin
python manage.py descargar_clima --sembrar-ciudades --cantidad-anios 2
```

Esto crea:
- Un superusuario `admin` con clave `admin123` (accede a `/admin/`).
- **50 ciudades en los 5 continentes**: Colombia (6), América Latina (11),
  Caribe (1), Norteamérica (4), Brasil (2), Europa (11), Asia (8), África (5)
  y Oceanía (2). Cada una con latitud, longitud y altitud reales.
- ~36 500 mediciones reales (50 ciudades × 730 días) descargadas desde
  Open-Meteo con `bulk_create` y `ignore_conflicts=True`. Tarda ~5-10 minutos.

Para descargar más años o solo algunas ciudades:

```powershell
# 5 años de histórico para todas las ciudades
python manage.py descargar_clima --cantidad-anios 5

# 3 años solo para Bogotá (id=1) y Tokio (id=37)
python manage.py descargar_clima --ciudades 1 37 --cantidad-anios 3
```

## 8. Comprueba el inicio

- Django responde en `http://127.0.0.1:8000/api/estado/` con
  `mediciones_registradas > 0`.
- React muestra el panel en `http://localhost:5173`.
- El login en la pestaña **Sesión** con `admin` / `admin123` devuelve un token.
- La pestaña **Ingesta** permite descargar más histórico (con token).
- La pestaña **Acerca de** muestra el nombre del desarrollador y la
  descripción del comparador de ciudades que se agregó al proyecto.
- La pestaña **Comparador** permite seleccionar hasta 6 ciudades y ver sus
  temperaturas medias mensuales superpuestas en una misma gráfica.
- La pestaña **Listado** tiene botón "Exportar CSV" para descargar las
  mediciones filtradas como archivo CSV compatible con Excel.
- En el **Listado** también puedes crear, editar y borrar mediciones con
  sesión iniciada (modal flotante).
