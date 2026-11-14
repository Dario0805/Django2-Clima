/**
 * Cliente HTTP para la API de clima (Django REST Framework).
 *
 * - `API_URL` apunta a /api/ del backend. En desarrollo es http://127.0.0.1:8000/api.
 * - `peticion` captura errores de red (servidor abajo o CORS mal configurado).
 * - `pedirOExplotar` traduce códigos HTTP a mensajes accionables para el usuario.
 * - `authHeader` adjunta el token guardado en localStorage tras iniciar sesión.
 */
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'

const CLAVE_TOKEN = 'taller-clima-token'

export class FallaApi extends Error {
  constructor(tipo, mensaje) {
    super(mensaje)
    this.tipo = tipo
  }
}

const PISTAS_HTTP = {
  400: 'HTTP 400 · el servidor RECHAZÓ el dato: revisa el cuerpo enviado.',
  401: 'HTTP 401 · falta autenticación o el token caducó. Inicia sesión de nuevo.',
  403: 'HTTP 403 · el servidor entendió pero no autoriza.',
  404: 'HTTP 404 · el recurso NO existe: ruta mal escrita o id inexistente.',
  405: 'HTTP 405 · el verbo HTTP no está permitido en esa ruta.',
  500: 'HTTP 500 · error interno del servidor: revisa la terminal de Django.',
  502: 'HTTP 502 · el backend no pudo contactar a Open-Meteo.',
}

export function leerToken() {
  return localStorage.getItem(CLAVE_TOKEN)
}

export function guardarToken(token) {
  if (token) localStorage.setItem(CLAVE_TOKEN, token)
  else localStorage.removeItem(CLAVE_TOKEN)
}

export function authHeader() {
  const token = leerToken()
  return token ? { Authorization: `Token ${token}` } : {}
}

export async function pedirOExplotar(ruta, opciones = {}) {
  const inicio = performance.now()
  let respuesta
  try {
    respuesta = await fetch(ruta, opciones)
  } catch {
    throw new FallaApi(
      'cors',
      'No hubo respuesta de Django. Revisa que el servidor esté activo ' +
        'en el puerto 8000 y que CORS esté configurado.',
    )
  }
  const ms = Math.round(performance.now() - inicio)

  if (!respuesta.ok) {
    let detalle = ''
    try {
      const datos = await respuesta.json()
      detalle = datos?.detalle ? ` · ${datos.detalle}` : ''
    } catch {
      /* sin cuerpo JSON */
    }
    const mensaje = PISTAS_HTTP[respuesta.status]
      || `HTTP ${respuesta.status} · respuesta inesperada del servidor`
    throw new FallaApi('http', `${mensaje}${detalle}`)
  }

  let datos
  try {
    datos = await respuesta.json()
  } catch {
    throw new FallaApi('json', 'El servidor respondió algo que no es JSON.')
  }
  return { respuesta, ms, datos }
}

/** Construye una query string a partir de un objeto (ignora valores vacíos). */
export function aQuery(params = {}) {
  const partes = []
  for (const [clave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === null || valor === '') continue
    partes.push(`${encodeURIComponent(clave)}=${encodeURIComponent(valor)}`)
  }
  return partes.length ? `?${partes.join('&')}` : ''
}
