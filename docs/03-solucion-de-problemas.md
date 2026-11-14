# Solución de problemas

## Django no conecta con PostgreSQL

**Síntoma:** `/api/estado/` responde `base_datos: false` o Django lanza
`OperationalError`.

**Causas y fixes:**
- PostgreSQL no está corriendo: arráncalo o comprueba el servicio.
- Credenciales erróneas en `.env` (`DB_USER`, `DB_PASSWORD`).
- La base `taller_clima` no existe: créala con `CREATE DATABASE taller_clima;`.
- En Render, `DATABASE_URL` debe apuntar a la base interna (no a localhost).

## CORS: React no recibe respuesta de Django

**Síntoma:** en la consola del navegador aparece
`CORS policy: No 'Access-Control-Allow-Origin' header` o el frontend muestra
"No hubo respuesta de Django".

**Fix:** `CORS_ALLOWED_ORIGINS` debe contener `http://localhost:5173`.
Reinicia Django después de cambiar `.env`.

## 401 al usar el token

**Síntoma:** `POST /api/mediciones/inyeccion/` devuelve 401 aunque
recién iniciaste sesión.

**Causas:**
- El token expiró o se regeneró: cierra sesión y vuelve a entrar.
- No se envía la cabecera: el frontend usa `authHeader()`; si usas curl:
  ```
  curl -X POST http://127.0.0.1:8000/api/mediciones/inyeccion/ \
       -H "Authorization: Token abc123…" \
       -H "Content-Type: application/json" \
       -d '{"ciudades":[1],"fecha_inicio":"2023-01-01","fecha_fin":"2023-12-31"}'
  ```

## Open-Meteo devuelve 400 o no responde

**Síntoma:** `POST /api/mediciones/inyeccion/` responde 502 con
"No se pudo consultar Open-Meteo".

**Causas:**
- Rango de fechas demasiado amplio: Open-Meteo permite varios años, pero
  limita a ~10 años por petición. Reduce el rango.
- Latitud/longitud mal formateados en la ciudad: corrígelos en `/admin/`.
- La API de histórico está caída (raro): reintenta en unos minutos.

## bulk_create inserta 0 filas aunque Open-Meteo devolvió datos

**Síntoma:** `creadas: 0` con `filas_recibidas > 0`.

**Causa:** ya existen mediciones para ese rango (el constraint
`(ciudad, fecha)` evita duplicados). Esto es **comportamiento esperado** al
volver a ejecutar la ingesta. Para forzar recarga, primero ejecuta
`DELETE /api/mediciones/limpieza/` con `{"confirmar": true}`.

## Las migraciones fallan: "table already exists"

Si mezclaste migraciones manuales, reinicia:

```powershell
cd Backend
del db.sqlite3                  # o DROP DATABASE taller_clima; en PostgreSQL
python manage.py migrate
```

## El panel aparece en blanco

**Síntoma:** la URL pública carga un HTML vacío.

**Causas:**
- No ejecutaste `npm run build` en Render: el build debe volcar a
  `Backend/static_frontend`. Verifica `vite.config.js` (`outDir: '../Backend/static_frontend'`).
- `collectstatic` no corrió: en el build de Render añade
  `python manage.py collectstatic --noinput`.

## No veo ciudades en el selector

Ejecuta el comando de siembra:

```powershell
python manage.py descargar_clima --sembrar-ciudades --cantidad-anios 2
```

Esto crea las 10 ciudades iniciales y descarga 2 años de histórico.

## El histórico tarda mucho

Open-Meteo responde en 1-3 segundos por ciudad y por rango de 1 año. Si
descargas 10 ciudades × 2 años, son ~20-30 segundos. Para recargas
completas (10 años × 10 ciudades) puede tardar varios minutos.

## Django admin: "csrf verification failed"

En producción añade tu dominio a `CSRF_TRUSTED_ORIGINS`:

```env
CSRF_TRUSTED_ORIGINS=https://tu-app.onrender.com
```

Y reinicia el servicio.
