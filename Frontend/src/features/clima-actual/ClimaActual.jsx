import { useEffect, useState, useCallback } from 'react'
import { API_URL, pedirOExplotar, aQuery, FallaApi } from '../../shared/api.js'
import CiudadSelector from '../ciudades/CiudadSelector.jsx'

/**
 * Traducción de códigos WMO de Open-Meteo a descripción humana.
 * Tabla compacta por rangos típicos.
 */
function describirCodigo(codigo) {
  const c = Number(codigo)
  if (!Number.isFinite(c)) return 'Código no disponible'
  if (c === 0) return 'Despejado'
  if (c >= 1 && c <= 3) return 'Parcialmente nublado'
  if (c >= 45 && c <= 48) return 'Niebla'
  if (c >= 51 && c <= 67) return 'Lluvia'
  if (c >= 71 && c <= 77) return 'Nieve'
  if (c >= 80 && c <= 82) return 'Chubascos'
  if (c >= 95 && c <= 99) return 'Tormenta'
  if (c >= 51 && c <= 57) return 'Llovizna'
  if (c >= 61 && c <= 67) return 'Lluvia'
  if (c >= 71 && c <= 77) return 'Nieve'
  return 'Código no reconocido'
}

function formatearHora(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function ClimaActual() {
  const [ciudad, setCiudad] = useState('')
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [ms, setMs] = useState(null)

  const cargar = useCallback(async (idCiudad) => {
    if (!idCiudad) {
      setData(null)
      setError(null)
      return
    }
    setCargando(true)
    setError(null)
    try {
      const query = aQuery({ ciudad: idCiudad })
      const { datos, ms: tiempo } = await pedirOExplotar(
        `${API_URL}/mediciones/clima-actual/${query}`,
      )
      setData(datos)
      setMs(tiempo)
    } catch (e) {
      if (e instanceof FallaApi) setError(e.message)
      else setError('No se pudo cargar el clima actual.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar(ciudad)
  }, [ciudad, cargar])

  const u = data?.unidades ?? {}

  return (
    <section className="panel">
      <div className="panel-encabezado">
        <div>
          <h2>Clima actual</h2>
          <p>
            Condiciones en vivo desde Open-Meteo para una ciudad específica.
            Actualiza la ciudad para ver datos frescos.
          </p>
        </div>
        {ms !== null && !cargando && (
          <span className="badge badge--celeste">Consulta: {ms} ms</span>
        )}
      </div>

      <div className="panel-cuerpo">
        <div className="filtros" style={{ marginBottom: '1rem' }}>
          <CiudadSelector
            value={ciudad}
            onChange={(v) => setCiudad(v)}
            todas={false}
          />
        </div>

        {!ciudad && (
          <div className="carga-bloque">
            <span className="texto-suave">
              Selecciona una ciudad para ver su clima actual.
            </span>
          </div>
        )}

        {cargando && (
          <div className="carga-bloque">
            <span className="spinner spinner--grande" />
            Consultando Open-Meteo…
          </div>
        )}

        {error && !cargando && (
          <div className="aviso" data-tipo="error">
            <strong>Error</strong>
            {error}
          </div>
        )}

        {!cargando && !error && data && ciudad && (
          <div className="clima-card">
            <div className="clima-principal">
              <span className="clima-principal-kicker">Clima actual · Open-Meteo</span>
              <span className="clima-principal-titulo">
                {describirCodigo(data.codigo_clima)}
              </span>
              <span className="clima-principal-ubicacion">
                {data.ciudad}
                {data.pais ? ` · ${data.pais}` : ''}
                {data.latitud != null && data.longitud != null
                  ? ` (${Number(data.latitud).toFixed(2)}, ${Number(data.longitud).toFixed(2)})`
                  : ''}
              </span>

              <div className="clima-temperatura">
                <span className="clima-temperatura-valor">
                  {data.temperatura != null
                    ? Number(data.temperatura).toFixed(1)
                    : '—'}
                </span>
                <span className="clima-temperatura-unidad">
                  {u.temperatura || '°C'}
                </span>
              </div>

              <div className="clima-tiempo-extra">
                Código WMO: <strong>{data.codigo_clima ?? '—'}</strong>
                {data.tiempo && <> · Actualizado: {formatearHora(data.tiempo)}</>}
              </div>
            </div>

            <div className="clima-detalles">
              <div className="clima-detalle">
                <span className="clima-detalle-etiqueta">Humedad</span>
                <span className="clima-detalle-valor">
                  {data.humedad_relativa != null
                    ? Number(data.humedad_relativa).toFixed(0)
                    : '—'}
                  <small> {u.humedad_relativa || '%'}</small>
                </span>
              </div>
              <div className="clima-detalle">
                <span className="clima-detalle-etiqueta">Precipitación</span>
                <span className="clima-detalle-valor">
                  {data.precipitacion != null
                    ? Number(data.precipitacion).toFixed(2)
                    : '—'}
                  <small> {u.precipitacion || 'mm'}</small>
                </span>
              </div>
              <div className="clima-detalle">
                <span className="clima-detalle-etiqueta">Viento</span>
                <span className="clima-detalle-valor">
                  {data.velocidad_viento != null
                    ? Number(data.velocidad_viento).toFixed(1)
                    : '—'}
                  <small> {u.velocidad_viento || 'km/h'}</small>
                </span>
              </div>
              <div className="clima-detalle">
                <span className="clima-detalle-etiqueta">Código</span>
                <span className="clima-detalle-valor">
                  {data.codigo_clima ?? '—'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default ClimaActual
