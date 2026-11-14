import { useEffect, useState, useCallback } from 'react'
import {
  API_URL,
  pedirOExplotar,
  authHeader,
  leerToken,
  aQuery,
  FallaApi,
} from '../../shared/api.js'

function fechaHoy() {
  return new Date().toISOString().slice(0, 10)
}
function fechaHaceUnAnio() {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().slice(0, 10)
}

function InyeccionMasiva() {
  const [ciudades, setCiudades] = useState([])
  const [cargandoCiudades, setCargandoCiudades] = useState(true)
  const [errorCiudades, setErrorCiudades] = useState(null)
  const [seleccion, setSeleccion] = useState(new Set())
  const [fechaInicio, setFechaInicio] = useState(fechaHaceUnAnio())
  const [fechaFin, setFechaFin] = useState(fechaHoy())

  const [enviando, setEnviando] = useState(false)
  const [limpiando, setLimpiando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [modalLimpieza, setModalLimpieza] = useState(false)
  const [resultadoLimpieza, setResultadoLimpieza] = useState(null)

  const token = leerToken()

  const cargarCiudades = useCallback(async () => {
    setCargandoCiudades(true)
    setErrorCiudades(null)
    try {
      const { datos } = await pedirOExplotar(`${API_URL}/ciudades/`)
      const lista = Array.isArray(datos) ? datos : datos?.results ?? []
      setCiudades(lista)
      setSeleccion(new Set(lista.map((c) => c.id)))
    } catch (e) {
      setErrorCiudades(
        e instanceof FallaApi ? e.message : 'No se pudo cargar la lista de ciudades.',
      )
    } finally {
      setCargandoCiudades(false)
    }
  }, [])

  useEffect(() => {
    cargarCiudades()
  }, [cargarCiudades])

  function toggleCiudad(id) {
    setSeleccion((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })
  }

  function seleccionarTodas() {
    setSeleccion(new Set(ciudades.map((c) => c.id)))
  }
  function ninguna() {
    setSeleccion(new Set())
  }

  async function enviarIngesta() {
    setError(null)
    setResultado(null)
    if (!token) {
      setError('Inicia sesión para usar la ingesta masiva.')
      return
    }
    if (seleccion.size === 0) {
      setError('Selecciona al menos una ciudad.')
      return
    }
    if (!fechaInicio || !fechaFin) {
      setError('Indica un rango de fechas válido.')
      return
    }
    setEnviando(true)
    try {
      const { datos } = await pedirOExplotar(`${API_URL}/mediciones/inyeccion/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          ciudades: Array.from(seleccion),
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
        }),
      })
      setResultado(datos)
    } catch (e) {
      if (e instanceof FallaApi && e.tipo === 'http' && e.message.includes('401')) {
        setError('Token inválido o caducado. Inicia sesión de nuevo.')
      } else if (e instanceof FallaApi) {
        setError(e.message)
      } else {
        setError('No se pudo completar la ingesta.')
      }
    } finally {
      setEnviando(false)
    }
  }

  async function limpiarTabla() {
    setModalLimpieza(false)
    setError(null)
    setResultadoLimpieza(null)
    setLimpiando(true)
    try {
      const { datos } = await pedirOExplotar(`${API_URL}/mediciones/limpieza/`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ confirmar: true }),
      })
      setResultadoLimpieza(datos)
    } catch (e) {
      if (e instanceof FallaApi && e.tipo === 'http' && e.message.includes('401')) {
        setError('Token inválido o caducado. Inicia sesión de nuevo.')
      } else if (e instanceof FallaApi) {
        setError(e.message)
      } else {
        setError('No se pudo vaciar la tabla.')
      }
    } finally {
      setLimpiando(false)
    }
  }

  const todasSeleccionadas =
    ciudades.length > 0 && seleccion.size === ciudades.length

  return (
    <section className="panel">
      <div className="panel-encabezado">
        <div>
          <h2>Ingesta masiva · Open-Meteo</h2>
          <p>
            Descarga histórico meteorológico para las ciudades seleccionadas y
            lo persiste en el backend. Requiere sesión iniciada.
          </p>
        </div>
        <span className={`badge ${token ? 'badge--verde' : 'badge--rojo'}`}>
          {token ? 'Token activo' : 'Sin token'}
        </span>
      </div>

      <div className="panel-cuerpo">
        {!token && (
          <div className="aviso" data-tipo="warn" style={{ marginBottom: '1rem' }}>
            <strong>Sesión requerida</strong>
            Inicia sesión para usar la ingesta masiva. Ve a la pestaña «Sesión».
          </div>
        )}

        {error && (
          <div className="aviso" data-tipo="error" style={{ marginBottom: '1rem' }}>
            <strong>Error</strong>
            {error}
          </div>
        )}

        {resultadoLimpieza && (
          <div className="aviso" data-tipo="ok" style={{ marginBottom: '1rem' }}>
            <strong>Tabla vaciada</strong>
            Se eliminaron {resultadoLimpieza.eliminados ?? 0} registros en{' '}
            {resultadoLimpieza.ms ?? 0} ms.
          </div>
        )}

        <div className="ingesta-rejilla">
          {/* Columna izquierda: ciudades + fechas */}
          <div>
            <div className="bloque">
              <div className="bloque-titulo">
                Ciudades ({seleccion.size} de {ciudades.length})
              </div>

              {errorCiudades ? (
                <div className="aviso" data-tipo="error">
                  {errorCiudades}
                  <button
                    type="button"
                    className="boton-mini"
                    onClick={cargarCiudades}
                    style={{ marginLeft: '0.5rem' }}
                  >
                    Reintentar
                  </button>
                </div>
              ) : (
                <>
                  <div className="lista-ciudades-toolbar">
                    <button
                      type="button"
                      className="boton-mini"
                      onClick={todasSeleccionadas ? ninguna : seleccionarTodas}
                      disabled={cargandoCiudades}
                    >
                      {todasSeleccionadas ? 'Quitar todas' : 'Marcar todas'}
                    </button>
                    <span className="texto-suave texto-pequeno">
                      Seleccionadas: {seleccion.size}
                    </span>
                  </div>

                  {cargandoCiudades ? (
                    <div className="carga-bloque">
                      <span className="spinner" />
                      Cargando ciudades…
                    </div>
                  ) : (
                    <div className="lista-ciudades-check">
                      {ciudades.map((c) => (
                        <div className="check-fila" key={c.id}>
                          <input
                            id={`ciudad-${c.id}`}
                            type="checkbox"
                            checked={seleccion.has(c.id)}
                            onChange={() => toggleCiudad(c.id)}
                          />
                          <label htmlFor={`ciudad-${c.id}`}>
                            {c.nombre} · {c.pais}
                          </label>
                          <span className="check-meta">
                            {Number(c.latitud).toFixed(2)},{' '}
                            {Number(c.longitud).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="rejilla-2">
              <div className="campo">
                <label className="campo-etiqueta" htmlFor="i-ini">Fecha inicio</label>
                <input
                  id="i-ini"
                  type="date"
                  className="campo-texto"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </div>
              <div className="campo">
                <label className="campo-etiqueta" htmlFor="i-fin">Fecha fin</label>
                <input
                  id="i-fin"
                  type="date"
                  className="campo-texto"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                />
              </div>
            </div>

            <div className="filtros-acciones" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="boton"
                onClick={enviarIngesta}
                disabled={enviando || !token || seleccion.size === 0}
              >
                {enviando ? <span className="spinner spinner--pequeno" /> : null}
                {enviando ? 'Descargando histórico…' : 'Descargar histórico'}
              </button>
              <button
                type="button"
                className="boton-peligro"
                onClick={() => setModalLimpieza(true)}
                disabled={limpiando || !token}
              >
                {limpiando ? <span className="spinner spinner--pequeno" /> : null}
                Limpiar tabla
              </button>
            </div>
          </div>

          {/* Columna derecha: reporte de resultados */}
          <div>
            <div className="bloque-titulo">Resultado</div>
            {enviando ? (
              <div className="carga-bloque">
                <span className="spinner spinner--grande" />
                Descargando histórico desde Open-Meteo…
              </div>
            ) : resultado ? (
              <div className="ingesta-resumen">
                <h3>Ingesta completada</h3>
                <dl>
                  <dt>Ciudades procesadas</dt>
                  <dd>{resultado.ciudades_procesadas ?? 0}</dd>
                  <dt>Filas recibidas</dt>
                  <dd>{resultado.filas_recibidas ?? 0}</dd>
                  <dt>Filas creadas</dt>
                  <dd>{resultado.creadas ?? 0}</dd>
                  <dt>Omitidas / duplicadas</dt>
                  <dd>{resultado.filas_omitidas_o_duplicadas ?? 0}</dd>
                  <dt>Total mediciones</dt>
                  <dd>{resultado.total_mediciones ?? 0}</dd>
                  <dt>Tiempo total</dt>
                  <dd>{resultado.ms ?? 0} ms</dd>
                </dl>
              </div>
            ) : (
              <div className="carga-bloque texto-suave">
                No hay resultados aún. Ejecuta una descarga para ver el reporte.
              </div>
            )}
          </div>
        </div>
      </div>

      {modalLimpieza && (
        <div className="modal-fondo" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
          <div className="modal">
            <div className="modal-encabezado">
              <h3 id="modal-titulo">Vaciar tabla de mediciones</h3>
            </div>
            <div className="modal-cuerpo">
              <p>
                Esta acción <strong>eliminará todas las mediciones</strong>{' '}
                almacenadas en el backend. La operación es irreversible.
              </p>
              <p>
                Se enviará una petición <code>DELETE /api/mediciones/limpieza/</code>{' '}
                con confirmación explícita.
              </p>
            </div>
            <div className="modal-pie">
              <button
                type="button"
                className="boton-secundario"
                onClick={() => setModalLimpieza(false)}
                disabled={limpiando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="boton-peligro"
                onClick={limpiarTabla}
                disabled={limpiando}
              >
                {limpiando ? <span className="spinner spinner--pequeno" /> : null}
                Sí, vaciar la tabla
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default InyeccionMasiva
