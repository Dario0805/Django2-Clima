import { useEffect, useState, useCallback } from 'react'
import {
  API_URL,
  pedirOExplotar,
  leerToken,
  guardarToken,
  FallaApi,
} from '../../shared/api.js'

const CLAVE_USUARIO = 'taller-clima-usuario'

function leerUsuario() {
  return localStorage.getItem(CLAVE_USUARIO) ?? ''
}

function Sesion() {
  const [token, setToken] = useState(null)
  const [usuario, setUsuario] = useState('')
  const [esAdmin, setEsAdmin] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [ok, setOk] = useState(null)

  useEffect(() => {
    setToken(leerToken())
    setUsuario(leerUsuario())
  }, [])

  const refrescar = useCallback(() => {
    setToken(leerToken())
    setUsuario(leerUsuario())
  }, [])

  async function iniciarSesion(e) {
    e.preventDefault()
    setError(null)
    setOk(null)
    if (!username || !password) {
      setError('Indica usuario y contraseña.')
      return
    }
    setEnviando(true)
    try {
      const { datos } = await pedirOExplotar(`${API_URL}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      guardarToken(datos.token)
      localStorage.setItem(CLAVE_USUARIO, datos.username ?? username)
      localStorage.setItem(
        'taller-clima-admin',
        datos.is_superuser ? '1' : '0',
      )
      setToken(datos.token)
      setUsuario(datos.username ?? username)
      setEsAdmin(Boolean(datos.is_superuser))
      setOk(`Sesión iniciada como ${datos.username ?? username}.`)
      setPassword('')
    } catch (e) {
      if (e instanceof FallaApi && e.tipo === 'http' && e.message.includes('401')) {
        setError('Credenciales inválidas. Verifica usuario y contraseña.')
      } else if (e instanceof FallaApi) {
        setError(e.message)
      } else {
        setError('No se pudo iniciar sesión.')
      }
    } finally {
      setEnviando(false)
    }
  }

  function cerrarSesion() {
    guardarToken(null)
    localStorage.removeItem(CLAVE_USUARIO)
    localStorage.removeItem('taller-clima-admin')
    setToken(null)
    setUsuario('')
    setEsAdmin(false)
    setUsername('')
    setPassword('')
    setOk('Sesión cerrada.')
    setError(null)
  }

  useEffect(() => {
    if (leerToken()) {
      setEsAdmin(localStorage.getItem('taller-clima-admin') === '1')
    }
  }, [token])

  return (
    <section className="panel">
      <div className="panel-encabezado">
        <div>
          <h2>Sesión</h2>
          <p>
            Autenticación con token (DRF Token Authentication). Necesaria para
            crear, editar, borrar mediciones y para la ingesta masiva.
          </p>
        </div>
        <span className={`badge ${token ? 'badge--verde' : 'badge--rojo'}`}>
          {token ? 'Sesión activa' : 'Sin sesión'}
        </span>
      </div>

      <div className="panel-cuerpo">
        {error && (
          <div className="aviso" data-tipo="error" style={{ marginBottom: '1rem' }}>
            <strong>Error</strong>
            {error}
          </div>
        )}
        {ok && (
          <div className="aviso" data-tipo="ok" style={{ marginBottom: '1rem' }}>
            <strong>Listo</strong>
            {ok}
          </div>
        )}

        {token ? (
          <div className="sesion-actual">
            <div className="sesion-actual-fila">
              Sesión iniciada como <strong>{usuario || '—'}</strong>
              {esAdmin && <span className="badge badge--acento">superusuario</span>}
            </div>
            <div className="texto-suave texto-pequeno">
              El token se encuentra guardado en <code>localStorage</code> y se
              adjunta automáticamente a las peticiones protegidas mediante{' '}
              <code>Authorization: Token …</code>.
            </div>
            <button
              type="button"
              className="boton-peligro"
              onClick={cerrarSesion}
            >
              Cerrar sesión
            </button>
          </div>
        ) : (
          <form className="form-sesion" onSubmit={iniciarSesion}>
            <div className="campo">
              <label className="campo-etiqueta" htmlFor="s-user">Usuario</label>
              <input
                id="s-user"
                type="text"
                autoComplete="username"
                className="campo-texto"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={enviando}
              />
            </div>
            <div className="campo">
              <label className="campo-etiqueta" htmlFor="s-pass">Contraseña</label>
              <input
                id="s-pass"
                type="password"
                autoComplete="current-password"
                className="campo-texto"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={enviando}
              />
            </div>
            <button type="submit" className="boton" disabled={enviando}>
              {enviando ? <span className="spinner spinner--pequeno" /> : null}
              {enviando ? 'Iniciando…' : 'Iniciar sesión'}
            </button>

            <div className="ayuda-credenciales">
              Credenciales por defecto (creadas con{' '}
              <code>python manage.py crear_admin</code>):
              <br />
              usuario <code>admin</code> · contraseña <code>admin123</code>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}

export default Sesion
