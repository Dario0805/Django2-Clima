import { useEffect, useState, useCallback } from 'react'
import { API_URL, pedirOExplotar, leerToken, guardarToken, FallaApi } from '../shared/api.js'

import Listado from '../features/mediciones/Listado.jsx'
import Tablero from '../features/estadisticas/Tablero.jsx'
import InyeccionMasiva from '../features/ingesta/InyeccionMasiva.jsx'
import ClimaActual from '../features/clima-actual/ClimaActual.jsx'
import Comparador from '../features/comparador/Comparador.jsx'
import Sesion from '../features/auth/Sesion.jsx'
import Acerca from '../features/acerca/Acerca.jsx'

const PESTANAS = [
  { id: 'listado', label: 'Listado' },
  { id: 'estadisticas', label: 'Estadísticas' },
  { id: 'comparador', label: 'Comparador' },
  { id: 'ingesta', label: 'Ingesta' },
  { id: 'clima', label: 'Clima actual' },
  { id: 'acerca', label: 'Acerca de' },
  { id: 'sesion', label: 'Sesión' },
]

const META_USUARIO = 'taller-clima-usuario'
const META_ADMIN = 'taller-clima-admin'
const META_ESTADO = 'taller-clima-estado'

const META_PRECARGADA = Number(localStorage.getItem(META_ESTADO)) || 0

function App() {
  const [activa, setActiva] = useState('listado')
  const [totalMediciones, setTotalMediciones] = useState(META_PRECARGADA)
  const [totalCiudades, setTotalCiudades] = useState(0)
  const [estadoError, setEstadoError] = useState(null)
  const [usuario, setUsuario] = useState(localStorage.getItem(META_USUARIO) ?? '')
  const [esAdmin, setEsAdmin] = useState(localStorage.getItem(META_ADMIN) === '1')

  const refrescarUsuario = useCallback(() => {
    setUsuario(localStorage.getItem(META_USUARIO) ?? '')
    setEsAdmin(localStorage.getItem(META_ADMIN) === '1')
  }, [])

  const cargarEstado = useCallback(async () => {
    setEstadoError(null)
    try {
      const { datos } = await pedirOExplotar(`${API_URL}/estado/`)
      const m = Number(datos.mediciones_registradas) || 0
      const c = Number(datos.ciudades_registradas) || 0
      setTotalMediciones(m)
      setTotalCiudades(c)
      localStorage.setItem(META_ESTADO, String(m))
    } catch (e) {
      if (e instanceof FallaApi) setEstadoError(e.message)
      else setEstadoError('No se pudo contactar con el backend Django.')
    }
  }, [])

  useEffect(() => {
    cargarEstado()
    refrescarUsuario()
    // Escuchar cambios de storage para sincronizar usuario/token entre pestañas
    const onStorage = () => refrescarUsuario()
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [cargarEstado, refrescarUsuario])

  // Re-leer usuario cada vez que se vuelve a la pestaña Sesión (login/logout)
  useEffect(() => {
    if (activa === 'sesion') refrescarUsuario()
  }, [activa, refrescarUsuario])

  const token = leerToken()
  const meta = 5000
  const progreso = Math.min(100, Math.round((totalMediciones / meta) * 100))

  function cambiarPestana(id) {
    setActiva(id)
  }

  function cerrarSesionRapida() {
    guardarToken(null)
    localStorage.removeItem(META_USUARIO)
    localStorage.removeItem(META_ADMIN)
    refrescarUsuario()
    setActiva('sesion')
  }

  return (
    <div className="app-shell">
      <header className="masthead">
        <div className="masthead-identidad">
          <span className="brand-kicker">Open-Meteo · Colombia y región</span>
          <h1>Histórico meteorológico</h1>
        </div>

        <div className="masthead-centro">
          <div className="masthead-progreso-etiqueta">
            Mediciones registradas:{' '}
            <strong>{totalMediciones.toLocaleString('es-CO')}</strong>
            <span className="texto-suave">/ meta {meta.toLocaleString('es-CO')}</span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-valuenow={totalMediciones}
            aria-valuemin={0}
            aria-valuemax={meta}
            aria-label="Progreso de mediciones registradas"
          >
            <span style={{ width: `${progreso}%` }} />
          </div>
          <div className="texto-suave texto-pequeno">
            {totalCiudades.toLocaleString('es-CO')} ciudades registradas · {progreso}%
          </div>
        </div>

        <div className="masthead-acciones">
          {token ? (
            <>
              <div className="masthead-usuario">
                <span>Sesión</span>
                <strong>{usuario || 'admin'}{esAdmin ? ' ★' : ''}</strong>
              </div>
              <button
                type="button"
                className="boton-secundario"
                onClick={cerrarSesionRapida}
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <button
              type="button"
              className="boton"
              onClick={() => setActiva('sesion')}
            >
              Iniciar sesión
            </button>
          )}
        </div>
      </header>

      <nav className="tab-nav" role="tablist" aria-label="Secciones principales">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            className="tab"
            data-activa={activa === p.id}
            aria-selected={activa === p.id}
            onClick={() => cambiarPestana(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {estadoError && (
          <div className="aviso" data-tipo="error" style={{ marginBottom: '1rem' }}>
            <strong>Backend no disponible</strong>
            {estadoError}
            <button
              type="button"
              className="boton-mini"
              onClick={cargarEstado}
              style={{ marginLeft: '0.5rem' }}
            >
              Reintentar
            </button>
          </div>
        )}

        {activa === 'listado' && <Listado />}
        {activa === 'estadisticas' && <Tablero />}
        {activa === 'comparador' && <Comparador />}
        {activa === 'ingesta' && <InyeccionMasiva />}
        {activa === 'clima' && <ClimaActual />}
        {activa === 'acerca' && <Acerca />}
        {activa === 'sesion' && <Sesion />}
      </main>

      <footer className="app-footer">
        <span>
          <strong>API Django :8000</strong> · React :5173 · Open-Meteo
        </span>
        <span className="footer-enlaces">
          {token ? (
            <span className="badge badge--verde">sesión activa</span>
          ) : (
            <span className="badge">sin sesión</span>
          )}
          <span>·</span>
          <span>
            mediciones: <strong>{totalMediciones.toLocaleString('es-CO')}</strong>
          </span>
        </span>
      </footer>
    </div>
  )
}

export default App
