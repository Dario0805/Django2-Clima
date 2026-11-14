import { useEffect, useState, useCallback } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'
import { API_URL, pedirOExplotar, aQuery, FallaApi } from '../../shared/api.js'

/**
 * Comparador de temperatura media mensual entre varias ciudades.
 *
 * - Carga /api/ciudades/ al montar.
 * - Multi-select con checkboxes: máximo 6 ciudades seleccionadas (las demás
 *   se deshabilitan cuando se alcanza el límite).
 * - Rango de fechas por defecto: hoy-365 … hoy.
 * - Al pulsar "Comparar" se consulta /api/mediciones/comparador/ y se
 *   construye un único dataset fusionando las series por `mes`.
 * - Renderiza un <LineChart> de Recharts con una línea por ciudad.
 * - Debajo muestra una tabla con media, máximo, mínimo y conteo por ciudad.
 */

// Paleta neutra: tonos de gris. Para que las líneas se distingan sin usar
// color, cada ciudad también tiene un trazo distinto (continuo, rayas...).
const COLORES = ['#1f1f1f', '#5a5a5a', '#8a8a8a', '#333333', '#707070', '#a0a0a0']
const TRAZOS = [undefined, '6 4', '2 3', '10 3 2 3', '4 4', '1 4']
const MAX_CIUDADES = 6

function fechaHoy() {
  return new Date().toISOString().slice(0, 10)
}
function fechaHaceUnAnio() {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().slice(0, 10)
}

function num(valor) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

function Comparador() {
  const [ciudades, setCiudades] = useState([])
  const [cargandoCiudades, setCargandoCiudades] = useState(true)
  const [errorCiudades, setErrorCiudades] = useState(null)

  const [seleccion, setSeleccion] = useState(new Set())
  const [fechaInicio, setFechaInicio] = useState(fechaHaceUnAnio())
  const [fechaFin, setFechaFin] = useState(fechaHoy())

  const [serie, setSerie] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [ms, setMs] = useState(null)

  const cargarCiudades = useCallback(async () => {
    setCargandoCiudades(true)
    setErrorCiudades(null)
    try {
      const { datos } = await pedirOExplotar(`${API_URL}/ciudades/`)
      const lista = Array.isArray(datos) ? datos : datos?.results ?? []
      setCiudades(lista)
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
      if (nuevo.has(id)) {
        nuevo.delete(id)
      } else if (nuevo.size < MAX_CIUDADES) {
        nuevo.add(id)
      }
      return nuevo
    })
  }

  function limpiarSeleccion() {
    setSeleccion(new Set())
  }

  const comparar = useCallback(async () => {
    if (seleccion.size === 0) {
      setError('Selecciona al menos una ciudad.')
      setSerie(null)
      return
    }
    if (!fechaInicio || !fechaFin) {
      setError('Indica un rango de fechas válido.')
      setSerie(null)
      return
    }
    setCargando(true)
    setError(null)
    try {
      const ids = Array.from(seleccion).join(',')
      const query = aQuery({
        ciudades: ids,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      })
      const { datos, ms: tiempo } = await pedirOExplotar(
        `${API_URL}/mediciones/comparador/${query}`,
      )
      setSerie(datos)
      setMs(tiempo)
    } catch (e) {
      if (e instanceof FallaApi) setError(e.message)
      else setError('No se pudo cargar el comparador.')
    } finally {
      setCargando(false)
    }
  }, [seleccion, fechaInicio, fechaFin])

  // ------------------------------------------------------------------
  // Construcción del dataset fusionado por mes
  // ------------------------------------------------------------------
  const seriesPorCiudad = serie?.series ?? []
  const mesesSet = new Set()
  const ciudadDatos = new Map()

  for (const s of seriesPorCiudad) {
    const mapaMes = new Map()
    const lista = Array.isArray(s.datos) ? s.datos : []
    for (const d of lista) {
      if (!d || !d.mes) continue
      mapaMes.set(d.mes, d.temp_media)
      mesesSet.add(d.mes)
    }
    ciudadDatos.set(s.ciudad_id, {
      id: s.ciudad_id,
      nombre: s.ciudad || `Ciudad ${s.ciudad_id}`,
      pais: s.pais || '',
      datos: mapaMes,
    })
  }

  const mesesOrdenados = Array.from(mesesSet).sort()
  const ciudadesSel = ciudades.filter((c) => seleccion.has(c.id))
  const dataset = mesesOrdenados.map((mes) => {
    const fila = { mes }
    for (const c of ciudadesSel) {
      const entry = ciudadDatos.get(c.id)
      if (entry) {
        const v = entry.datos.get(mes)
        fila[c.nombre] = v === undefined ? null : Number(v)
      }
    }
    return fila
  })

  // ------------------------------------------------------------------
  // Estadísticas por ciudad (media, máx, mín, conteo)
  // ------------------------------------------------------------------
  const stats = ciudadesSel.map((c) => {
    const entry = ciudadDatos.get(c.id)
    if (!entry) {
      return { id: c.id, nombre: c.nombre, pais: c.pais, media: null, max: null, min: null, cuenta: 0 }
    }
    const valores = Array.from(entry.datos.values())
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v))
    if (valores.length === 0) {
      return { id: c.id, nombre: c.nombre, pais: c.pais, media: null, max: null, min: null, cuenta: 0 }
    }
    const suma = valores.reduce((a, b) => a + b, 0)
    return {
      id: c.id,
      nombre: c.nombre,
      pais: c.pais,
      media: suma / valores.length,
      max: Math.max(...valores),
      min: Math.min(...valores),
      cuenta: valores.length,
    }
  })

  return (
    <section className="panel">
      <div className="panel-encabezado">
        <div>
          <h2>Comparador de temperaturas</h2>
          <p>
            Compara la temperatura media mensual de hasta {MAX_CIUDADES}{' '}
            ciudades a la vez en una sola gráfica.
          </p>
        </div>
        <span className="badge badge--celeste">
          {seleccion.size}/{MAX_CIUDADES} ciudades
        </span>
      </div>

      <div className="panel-cuerpo">
        {errorCiudades && (
          <div className="aviso" data-tipo="error" style={{ marginBottom: '1rem' }}>
            <strong>Error</strong>
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
        )}

        <div className="comparador">
          <div className="comparador-controles">
            <div className="bloque-titulo">Ciudades</div>

            {cargandoCiudades ? (
              <div className="carga-bloque">
                <span className="spinner spinner--pequeno" />
                Cargando ciudades…
              </div>
            ) : (
              <>
                <div className="comparador-toolbar">
                  <span className="texto-suave texto-pequeno">
                    Máximo {MAX_CIUDADES} simultáneas.
                  </span>
                  {seleccion.size > 0 && (
                    <button
                      type="button"
                      className="boton-mini"
                      onClick={limpiarSeleccion}
                    >
                      Limpiar selección
                    </button>
                  )}
                </div>

                <div className="comparador-ciudades">
                  {ciudades.map((c) => {
                    const activa = seleccion.has(c.id)
                    const bloqueada = !activa && seleccion.size >= MAX_CIUDADES
                    return (
                      <label
                        key={c.id}
                        className="comparador-ciudad-chip"
                        data-seleccionada={activa}
                        data-bloqueada={bloqueada}
                      >
                        <input
                          type="checkbox"
                          checked={activa}
                          disabled={bloqueada}
                          onChange={() => toggleCiudad(c.id)}
                        />
                        <span>{c.nombre}</span>
                        <span className="texto-suave texto-pequeno">
                          {c.pais}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </>
            )}

            <div className="rejilla-2" style={{ marginTop: '1rem' }}>
              <div className="campo">
                <label className="campo-etiqueta" htmlFor="c-ini">Fecha inicio</label>
                <input
                  id="c-ini"
                  type="date"
                  className="campo-texto"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </div>
              <div className="campo">
                <label className="campo-etiqueta" htmlFor="c-fin">Fecha fin</label>
                <input
                  id="c-fin"
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
                onClick={comparar}
                disabled={cargando || seleccion.size === 0}
              >
                {cargando ? <span className="spinner spinner--pequeno" /> : null}
                {cargando ? 'Comparando…' : 'Comparar'}
              </button>
            </div>
          </div>

          <div className="comparador-resultado">
            {error && (
              <div className="aviso" data-tipo="error" style={{ marginBottom: '1rem' }}>
                <strong>Error</strong>
                {error}
              </div>
            )}

            {seleccion.size === 0 && !cargando && !error && (
              <div className="carga-bloque texto-suave">
                Selecciona al menos una ciudad.
              </div>
            )}

            {cargando && (
              <div className="carga-bloque">
                <span className="spinner" />
                Construyendo gráfica comparativa…
              </div>
            )}

            {!cargando && !error && serie && seleccion.size > 0 && (
              <>
                <div className="bloque-titulo">Temperatura media mensual (°C)</div>
                <div className="comparador-grafica">
                  <ResponsiveContainer width="100%" height={360}>
                    <LineChart
                      data={dataset}
                      margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="mes"
                        tickFormatter={(mm) => String(mm).slice(0, 7)}
                        tickLine={false}
                      />
                      <YAxis unit="°C" tickLine={false} axisLine={false} width={48} />
                      <Tooltip
                        formatter={(value) =>
                          value === null || value === undefined
                            ? ['—', '']
                            : [`${Number(value).toFixed(2)} °C`, '']
                        }
                        labelFormatter={(label) => `Mes: ${String(label).slice(0, 7)}`}
                      />
                      <Legend />
                      {ciudadesSel.map((c, i) => (
                        <Line
                          key={c.id}
                          type="monotone"
                          dataKey={c.nombre}
                          stroke={COLORES[i % COLORES.length]}
                          strokeDasharray={TRAZOS[i % TRAZOS.length]}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bloque-titulo" style={{ marginTop: '1.25rem' }}>
                  Estadísticas por ciudad
                </div>
                <div className="comparador-stats">
                  {stats.map((s, i) => (
                    <div
                      key={s.id}
                      className="comparador-stat"
                      style={{ borderColor: COLORES[i % COLORES.length] }}
                    >
                      <div className="comparador-stat-nombre">
                        <span
                          className="comparador-stat-punto"
                          style={{ backgroundColor: COLORES[i % COLORES.length] }}
                        />
                        {s.nombre}
                      </div>
                      <div className="texto-suave texto-pequeno">{s.pais || '—'}</div>
                      <dl>
                        <dt>Media</dt>
                        <dd>{s.media != null ? s.media.toFixed(2) : '—'} °C</dd>
                        <dt>Máx</dt>
                        <dd>{s.max != null ? s.max.toFixed(2) : '—'} °C</dd>
                        <dt>Mín</dt>
                        <dd>{s.min != null ? s.min.toFixed(2) : '—'} °C</dd>
                        <dt>Mediciones</dt>
                        <dd>{s.cuenta}</dd>
                      </dl>
                    </div>
                  ))}
                </div>

                {ms !== null && (
                  <div className="texto-suave texto-pequeno" style={{ marginTop: '0.75rem' }}>
                    Consulta resuelta en {ms} ms · {mesesOrdenados.length} meses ·{' '}
                    {ciudadesSel.length} ciudades.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default Comparador
