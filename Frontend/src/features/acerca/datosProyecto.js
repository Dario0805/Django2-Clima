// Datos del apartado «Acerca de». Edita este archivo para cambiar el texto
// que se muestra en la pestaña, sin tocar el componente.

export const DESARROLLADOR = {
  // Reemplaza por tu nombre completo si lo deseas.
  nombre: 'Alderson Dario Bohorquez',
  rol: 'Desarrollador del proyecto',
  taller: 'Taller Django + React · Proyecto final individual',
  fecha: 'Noviembre de 2026',
}

export const PROYECTO = {
  nombre: 'Histórico meteorológico',
  descripcion:
    'Aplicación web que descarga, almacena y analiza el histórico ' +
    'meteorológico diario de 50 ciudades usando la API pública de ' +
    'Open-Meteo. Las estadísticas se calculan en la base de datos con el ' +
    'ORM de Django y se muestran en un panel de React.',
}

export const FUNCIONALIDAD_AGREGADA = {
  nombre: 'Comparador de ciudades',
  descripcion:
    'Se agregó un comparador que permite poner varias ciudades lado a lado ' +
    'y ver cómo cambia su temperatura media mes a mes. La consulta se ' +
    'resuelve en el servidor (GET /api/mediciones/comparador/) y el panel ' +
    'la dibuja como una gráfica de líneas con una línea por ciudad.',
  pasos: [
    'Abre la pestaña «Comparador».',
    'Marca hasta 6 ciudades en la lista.',
    'Elige el rango de fechas (por defecto, el último año).',
    'Pulsa «Comparar» para ver la gráfica y la tabla con media, máximo, mínimo y número de mediciones por ciudad.',
  ],
}

export const TECNOLOGIAS = [
  ['Backend', 'Django y Django REST Framework'],
  ['Base de datos', 'PostgreSQL'],
  ['Frontend', 'React con Vite y Recharts'],
  ['Fuente de datos', 'Open-Meteo (API pública)'],
  ['Despliegue', 'Render con gunicorn y whitenoise'],
]
