import { useEffect, useState, useCallback } from 'react'
import { API_URL, pedirOExplotar, aQuery, FallaApi } from '../../shared/api.js'
import CiudadSelector from '../ciudades/CiudadSelector.jsx'
import GraficaMes from './GraficaMes.jsx'
import GraficaCiudades from './GraficaCiudades.jsx'

function num(valor) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

function Tablero() {
  const [filtros, setFiltros] = useState({
    ciudad: '',
    fecha_inicio: '',
    fecha_fin: '',
    pais: '',
  })

  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [ms, setMs] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const query = aQuery({
        ciudad: filtros.ciudad,
        fecha_inicio: filtros.fecha_inicio,
        fecha_fin: filtros.fecha_fin,
        pais: filtros.pais,
      })
      const { datos: d, ms: tiempo } = await pedirOExplotar(
        `${API_URL}/mediciones/estadisticas/${query}`,
      )
      setDatos(d)
      setMs(tiempo)
    } catch (e) {
      if (e instanceof FallaApi) setError(e.message)
      else setError('No se pudieron cargar las estadísticas.')
    } finally {
      setCargando(false)
    }
  }, [filtros])

  useEffect(() => {
    cargar()
  }, [cargar])

  function actualizar(clave, valor) {
    setFiltros((p) => ({ ...p, [clave]: valor }))
  }

  const metricas = datos?.metricas ?? {}

  return (
    <section className="panel">
      <div className="panel-encabezado">
        <div>
          <h2>Tablero de estadísticas</h2>
          <p>
            Métricas agregadas del ORM con filtros dinámicos: ciudad, rango de
            fechas y país.
          </p>
        </div>
        <button
          type="button"
          className="boton-secundario"
          onClick={cargar}
          disabled={cargando}
        >
          {cargando ? <span className="spinner spinner--pequeno" /> : 'Refrescar'}
        </button>
      </div>

      <div className="panel-cuerpo">
        <div className="filtros">
          <CiudadSelector
            value={filtros.ciudad}
            onChange={(v) => actualizar('ciudad', v)}
          />
          <div className="campo">
            <label className="campo-etiqueta" htmlFor="t-ini">Desde</label>
            <input
              id="t-ini"
              type="date"
              className="campo-texto"
              value={filtros.fecha_inicio}
              onChange={(e) => actualizar('fecha_inicio', e.target.value)}
            />
          </div>
          <div className="campo">
            <label className="campo-etiqueta" htmlFor="t-fin">Hasta</label>
            <input
              id="t-fin"
              type="date"
              className="campo-texto"
              value={filtros.fecha_fin}
              onChange={(e) => actualizar('fecha_fin', e.target.value)}
            />
          </div>
          <div className="campo campo--crece">
            <label className="campo-etiqueta" htmlFor="t-pais">País</label>
            <input
              id="t-pais"
              type="text"
              className="campo-texto"
              placeholder="Ej. Colombia, Ecuador…"
              value={filtros.pais}
              onChange={(e) => actualizar('pais', e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="aviso" data-tipo="error" style={{ marginTop: '1rem' }}>
            <strong>Error</strong>
            {error}
          </div>
        )}

        {/* Tarjetas de métricas */}
        <div style={{ marginTop: '1.25rem' }}>
          {cargando ? (
            <div className="stat-grid">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="stat">
                  <span className="skeleton skeleton-linea" style={{ width: '60%' }} />
                  <span className="skeleton skeleton-linea" style={{ height: '32px', width: '70%' }} />
                  <span className="skeleton skeleton-linea" style={{ width: '40%' }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="stat-grid">
              <div className="stat">
                <span className="stat-etiqueta">Total mediciones</span>
                <span className="stat-valor">
                  {num(metricas.total_mediciones).toLocaleString('es-CO')}
                </span>
                <span className="stat-sub">registros filtrados</span>
              </div>
              <div className="stat stat--acento">
                <span className="stat-etiqueta">Temp. media promedio</span>
                <span className="stat-valor">
                  {num(metricas.temp_media_promedio).toFixed(2)}
                </span>
                <span className="stat-sub">°C</span>
              </div>
              <div className="stat stat--celeste">
                <span className="stat-etiqueta">Precipitación total</span>
                <span className="stat-valor">
                  {num(metricas.precipitacion_total).toFixed(2)}
                </span>
                <span className="stat-sub">mm acumulados</span>
              </div>
              <div className="stat stat--verde">
                <span className="stat-etiqueta">Viento máximo</span>
                <span className="stat-valor">
                  {num(metricas.viento_maximo).toFixed(2)}
                </span>
                <span className="stat-sub">km/h</span>
              </div>
            </div>
          )}
        </div>

        {/* Extremos de temperatura compactos */}
        {!cargando && metricas.temp_maxima != null && (
          <div className="rejilla-3" style={{ marginTop: '1rem' }}>
            <div className="stat stat--rojo">
              <span className="stat-etiqueta">Temp. máxima</span>
              <span className="stat-valor">{num(metricas.temp_maxima).toFixed(2)} °C</span>
            </div>
            <div className="stat stat--celeste">
              <span className="stat-etiqueta">Temp. mínima</span>
              <span className="stat-valor">{num(metricas.temp_minima).toFixed(2)} °C</span>
            </div>
            <div className="stat">
              <span className="stat-etiqueta">Precip. promedio</span>
              <span className="stat-valor">
                {num(metricas.precipitacion_promedio).toFixed(2)} mm
              </span>
            </div>
          </div>
        )}

        {/* Gráficas */}
        <div className="rejilla-2" style={{ marginTop: '1.5rem' }}>
          <div className="panel" style={{ margin: 0 }}>
            <div className="panel-encabezado">
              <div>
                <h2 style={{ fontSize: '0.92rem' }}>Temperatura media por mes</h2>
                <p>Evolución mensual de la temperatura media promedio.</p>
              </div>
            </div>
            <div className="panel-cuerpo">
              {cargando ? (
                <div className="carga-bloque">
                  <span className="spinner" />
                  Cargando gráfica…
                </div>
              ) : (
                <GraficaMes datos={datos?.por_mes ?? []} />
              )}
            </div>
          </div>

          <div className="panel" style={{ margin: 0 }}>
            <div className="panel-encabezado">
              <div>
                <h2 style={{ fontSize: '0.92rem' }}>Precipitación por ciudad</h2>
                <p>Total de precipitación acumulada por ciudad.</p>
              </div>
            </div>
            <div className="panel-cuerpo">
              {cargando ? (
                <div className="carga-bloque">
                  <span className="spinner" />
                  Cargando gráfica…
                </div>
              ) : (
                <GraficaCiudades datos={datos?.por_ciudad ?? []} />
              )}
            </div>
          </div>
        </div>

        {/* Tabla por ciudad */}
        <div style={{ marginTop: '1.5rem' }}>
          <div className="bloque-titulo">Desglose por ciudad</div>
          <div className="contenedor-tabla">
            {cargando ? (
              <div className="carga-bloque">
                <span className="spinner" />
                Cargando tabla…
              </div>
            ) : (datos?.por_ciudad ?? []).length === 0 ? (
              <div className="tabla-vacia">
                <strong>Sin datos por ciudad</strong>
                Ajusta los filtros para ver el desglose.
              </div>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Ciudad</th>
                    <th>País</th>
                    <th className="num">Mediciones</th>
                    <th className="num">T. media (°C)</th>
                    <th className="num">T. máx (°C)</th>
                    <th className="num">T. mín (°C)</th>
                    <th className="num">Precip. (mm)</th>
                  </tr>
                </thead>
                <tbody>
                  {(datos?.por_ciudad ?? []).map((c, i) => (
                    <tr key={`${c.ciudad__nombre}-${i}`}>
                      <td className="ciudad">{c.ciudad__nombre || '—'}</td>
                      <td className="texto-suave texto-pequeno">{c.ciudad__pais || '—'}</td>
                      <td className="num">{num(c.mediciones).toLocaleString('es-CO')}</td>
                      <td className="num">{num(c.temp_media_promedio).toFixed(2)}</td>
                      <td className="num">{num(c.temp_maxima).toFixed(2)}</td>
                      <td className="num">{num(c.temp_minima).toFixed(2)}</td>
                      <td className="num">{num(c.precipitacion_total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {ms !== null && !cargando && (
          <div className="texto-suave texto-pequeno" style={{ marginTop: '0.75rem' }}>
            Consulta resuelta en {ms} ms.
          </div>
        )}
      </div>
    </section>
  )
}

export default Tablero
