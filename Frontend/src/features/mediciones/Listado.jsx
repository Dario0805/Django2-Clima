import { useEffect, useState, useCallback } from 'react'
import {
  API_URL,
  pedirOExplotar,
  authHeader,
  leerToken,
  aQuery,
  FallaApi,
} from '../../shared/api.js'
import CiudadSelector from '../ciudades/CiudadSelector.jsx'
import FormularioMedicion from './FormularioMedicion.jsx'

const ORDENES = [
  { value: '-fecha', label: 'Fecha · más reciente primero' },
  { value: 'fecha', label: 'Fecha · más antigua primero' },
  { value: '-temp_max', label: 'Temp. máxima · mayor a menor' },
  { value: 'temp_max', label: 'Temp. máxima · menor a mayor' },
  { value: '-precipitacion', label: 'Precipitación · mayor a menor' },
  { value: 'precipitacion', label: 'Precipitación · menor a mayor' },
]

function formatearFecha(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return iso
  }
}

function celdaNumero(valor, sufijo = '') {
  if (valor === null || valor === undefined || valor === '') return '—'
  const n = Number(valor)
  return Number.isFinite(n) ? `${n.toFixed(2)}${sufijo}` : '—'
}

function Listado() {
  const [filtros, setFiltros] = useState({
    search: '',
    ciudad: '',
    fecha_inicio: '',
    fecha_fin: '',
    ordering: '-fecha',
  })
  const [pagina, setPagina] = useState(1)
  const [tamanoPagina] = useState(25)

  const [data, setData] = useState({ count: 0, next: null, previous: null, results: [] })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [ms, setMs] = useState(null)

  // Ciudades para el modal de crear/editar.
  const [ciudades, setCiudades] = useState([])
  const [cargandoCiudades, setCargandoCiudades] = useState(false)
  const [errorCiudades, setErrorCiudades] = useState(null)

  // Modal de medición (crear/editar). `null` = cerrado, objeto = abierto.
  const [modal, setModal] = useState(null)

  // Estado de borrado por fila.
  const [borrandoId, setBorrandoId] = useState(null)
  const [errorBorrado, setErrorBorrado] = useState(null)

  const token = leerToken()

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const query = aQuery({
        search: filtros.search,
        ciudad: filtros.ciudad,
        fecha_inicio: filtros.fecha_inicio,
        fecha_fin: filtros.fecha_fin,
        ordering: filtros.ordering,
        page: pagina,
        page_size: tamanoPagina,
      })
      const { datos, ms: tiempo } = await pedirOExplotar(
        `${API_URL}/mediciones/${query}`,
      )
      setData({
        count: datos.count ?? 0,
        next: datos.next ?? null,
        previous: datos.previous ?? null,
        results: datos.results ?? [],
      })
      setMs(tiempo)
    } catch (e) {
      if (e instanceof FallaApi) setError(e.message)
      else setError('No se pudieron cargar las mediciones.')
    } finally {
      setCargando(false)
    }
  }, [filtros, pagina, tamanoPagina])

  const cargarCiudades = useCallback(async () => {
    setCargandoCiudades(true)
    setErrorCiudades(null)
    try {
      const { datos } = await pedirOExplotar(`${API_URL}/ciudades/`)
      setCiudades(Array.isArray(datos) ? datos : datos?.results ?? [])
    } catch (e) {
      if (e instanceof FallaApi) setErrorCiudades(e.message)
      else setErrorCiudades('No se pudo cargar la lista de ciudades.')
    } finally {
      setCargandoCiudades(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    cargarCiudades()
  }, [cargarCiudades])

  function actualizarFiltro(clave, valor) {
    setFiltros((p) => ({ ...p, [clave]: valor }))
    setPagina(1)
  }

  function exportarCsv() {
    const query = aQuery({
      search: filtros.search,
      ciudad: filtros.ciudad,
      fecha_inicio: filtros.fecha_inicio,
      fecha_fin: filtros.fecha_fin,
      ordering: filtros.ordering,
    })
    const url = `${API_URL}/mediciones/exportar/${query}`
    const a = document.createElement('a')
    a.href = url
    a.setAttribute('download', 'mediciones.csv')
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noopener noreferrer')
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  function abrirCrear() {
    setErrorBorrado(null)
    setModal({ medicion: null })
  }

  function abrirEditar(fila) {
    setErrorBorrado(null)
    setModal({ medicion: fila })
  }

  function cerrarModal() {
    setModal(null)
  }

  function trasGuardado() {
    setModal(null)
    cargar()
  }

  async function borrarMedicion(fila) {
    const nombreCiudad = fila.ciudad_nombre || '—'
    const fechaTxt = formatearFecha(fila.fecha)
    const ok = window.confirm(
      `¿Borrar la medición de ${nombreCiudad} del ${fechaTxt}?`,
    )
    if (!ok) return

    setErrorBorrado(null)
    setBorrandoId(fila.id)
    try {
      // DRF devuelve 204 No Content (sin cuerpo JSON). pedirOExplotar lanza
      // FallaApi('json', ...) en ese caso; lo capturamos y tratamos como OK.
      try {
        await pedirOExplotar(`${API_URL}/mediciones/${fila.id}/`, {
          method: 'DELETE',
          headers: { ...authHeader() },
        })
      } catch (e) {
        if (e instanceof FallaApi && e.tipo === 'json') {
          // 204 sin cuerpo: éxito silencioso.
        } else {
          throw e
        }
      }
      cargar()
    } catch (e) {
      if (e instanceof FallaApi && e.tipo === 'http' && e.message.includes('401')) {
        setErrorBorrado('Token inválido o caducado. Inicia sesión de nuevo.')
      } else if (e instanceof FallaApi) {
        setErrorBorrado(e.message)
      } else {
        setErrorBorrado('No se pudo borrar la medición.')
      }
    } finally {
      setBorrandoId(null)
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(data.count / tamanoPagina))

  return (
    <section className="panel">
      <div className="panel-encabezado">
        <div>
          <h2>Listado de mediciones</h2>
          <p>
            Histórico diario por ciudad — filtra por texto, ciudad y rango de
            fechas. {data.count > 0 && <>Total: <strong>{data.count}</strong> registros.</>}
          </p>
        </div>
        <div className="filtros-acciones">
          <button
            type="button"
            className="boton-secundario"
            onClick={exportarCsv}
            disabled={cargando}
          >
            Exportar CSV
          </button>
          <button
            type="button"
            className="boton-secundario"
            onClick={cargar}
            disabled={cargando}
          >
            {cargando ? <span className="spinner spinner--pequeno" /> : 'Refrescar'}
          </button>
          <button
            type="button"
            className="boton"
            onClick={abrirCrear}
            disabled={!token}
            title={
              token
                ? 'Crear nueva medición'
                : 'Inicia sesión para crear mediciones'
            }
          >
            Nueva medición
          </button>
        </div>
      </div>

      <div className="panel-cuerpo">
        <div className="filtros">
          <div className="campo campo--crece">
            <label className="campo-etiqueta" htmlFor="f-search">Buscar</label>
            <input
              id="f-search"
              type="search"
              className="campo-texto"
              placeholder="Ciudad, país o código…"
              value={filtros.search}
              onChange={(e) => actualizarFiltro('search', e.target.value)}
            />
          </div>

          <CiudadSelector
            value={filtros.ciudad}
            onChange={(v) => actualizarFiltro('ciudad', v)}
          />

          <div className="campo">
            <label className="campo-etiqueta" htmlFor="f-ini">Desde</label>
            <input
              id="f-ini"
              type="date"
              className="campo-texto"
              value={filtros.fecha_inicio}
              onChange={(e) => actualizarFiltro('fecha_inicio', e.target.value)}
            />
          </div>

          <div className="campo">
            <label className="campo-etiqueta" htmlFor="f-fin">Hasta</label>
            <input
              id="f-fin"
              type="date"
              className="campo-texto"
              value={filtros.fecha_fin}
              onChange={(e) => actualizarFiltro('fecha_fin', e.target.value)}
            />
          </div>

          <div className="campo">
            <label className="campo-etiqueta" htmlFor="f-ord">Ordenar por</label>
            <select
              id="f-ord"
              className="campo"
              value={filtros.ordering}
              onChange={(e) => actualizarFiltro('ordering', e.target.value)}
            >
              {ORDENES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="aviso" data-tipo="error" style={{ marginTop: '1rem' }}>
            <strong>Error</strong>
            {error}
          </div>
        )}

        {errorCiudades && (
          <div className="aviso" data-tipo="warn" style={{ marginTop: '0.75rem' }}>
            <strong>Ciudades</strong>
            No se pudo cargar la lista de ciudades para el formulario.{' '}
            {errorCiudades}{' '}
            <button
              type="button"
              className="boton-mini"
              onClick={cargarCiudades}
            >
              Reintentar
            </button>
          </div>
        )}

        {errorBorrado && (
          <div className="aviso" data-tipo="error" style={{ marginTop: '0.75rem' }}>
            <strong>Borrado</strong>
            {errorBorrado}
          </div>
        )}

        <div className="contenedor-tabla" style={{ marginTop: '1rem' }}>
          {cargando ? (
            <div className="carga-bloque">
              <span className="spinner" />
              Cargando mediciones…
            </div>
          ) : data.results.length === 0 ? (
            <div className="tabla-vacia">
              <strong>Sin mediciones</strong>
              No se encontraron registros con los filtros actuales.
            </div>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Ciudad</th>
                  <th>País</th>
                  <th>Fecha</th>
                  <th className="num">T. máx (°C)</th>
                  <th className="num">T. mín (°C)</th>
                  <th className="num">T. media (°C)</th>
                  <th className="num">Precip. (mm)</th>
                  <th className="num">Viento (km/h)</th>
                  <th>Código</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((m) => (
                  <tr key={m.id}>
                    <td className="ciudad">{m.ciudad_nombre || '—'}</td>
                    <td className="texto-suave texto-pequeno">{m.ciudad_pais || '—'}</td>
                    <td>{formatearFecha(m.fecha)}</td>
                    <td className="num">{celdaNumero(m.temp_max)}</td>
                    <td className="num">{celdaNumero(m.temp_min)}</td>
                    <td className="num">{celdaNumero(m.temp_media)}</td>
                    <td className="num">{celdaNumero(m.precipitacion)}</td>
                    <td className="num">{celdaNumero(m.velocidad_viento)}</td>
                    <td className="codigo">{m.codigo_clima ?? '—'}</td>
                    <td className="acciones-fila">
                      <button
                        type="button"
                        className="boton-mini"
                        onClick={() => abrirEditar(m)}
                        disabled={!token || borrandoId === m.id}
                        title={
                          token
                            ? 'Editar medición'
                            : 'Inicia sesión para editar'
                        }
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="boton-mini boton-peligro"
                        onClick={() => borrarMedicion(m)}
                        disabled={!token || borrandoId === m.id}
                        title={
                          token
                            ? 'Borrar medición'
                            : 'Inicia sesión para borrar'
                        }
                      >
                        {borrandoId === m.id ? (
                          <span className="spinner spinner--pequeno" />
                        ) : (
                          'Borrar'
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="paginacion">
        <div className="paginacion-info">
          Página <strong>{pagina}</strong> de <strong>{totalPaginas}</strong> ·{' '}
          <strong>{data.count}</strong> mediciones
          {ms !== null && <> · {ms} ms</>}
        </div>
        <div className="paginacion-controles">
          <button
            type="button"
            className="boton-mini"
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={!data.previous || cargando}
          >
            Anterior
          </button>
          <button
            type="button"
            className="boton-mini"
            onClick={() => setPagina((p) => (data.next ? p + 1 : p))}
            disabled={!data.next || cargando}
          >
            Siguiente
          </button>
        </div>
      </div>

      {modal && (
        <FormularioMedicion
          medicion={modal.medicion}
          ciudades={ciudades}
          onCerrar={cerrarModal}
          onGuardado={trasGuardado}
        />
      )}
    </section>
  )
}

export default Listado
