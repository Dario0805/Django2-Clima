import { useEffect, useState } from 'react'
import {
  API_URL,
  pedirOExplotar,
  authHeader,
  FallaApi,
} from '../../shared/api.js'

/**
 * Modal de creación/edición de una Medición.
 *
 * Props:
 *  - medicion: null para crear, objeto con {id, ciudad, fecha, ...} para editar.
 *  - ciudades: array de ciudades [{id, nombre, pais, ...}, ...].
 *  - onCerrar: callback al pulsar Cancelar o la X.
 *  - onGuardado: callback tras un POST/PUT exitoso (201/200).
 *
 * temp_media se recalcula como (temp_max + temp_min) / 2 cuando ambos están
 * definidos, pero el campo sigue siendo editable manualmente.
 */

function hoy() {
  return new Date().toISOString().slice(0, 10)
}

function FormularioMedicion({ medicion, ciudades, onCerrar, onGuardado }) {
  const esEdicion = Boolean(medicion && medicion.id)

  const [ciudad, setCiudad] = useState('')
  const [fecha, setFecha] = useState('')
  const [tempMax, setTempMax] = useState('')
  const [tempMin, setTempMin] = useState('')
  const [tempMedia, setTempMedia] = useState('')
  const [precipitacion, setPrecipitacion] = useState(0)
  const [velocidadViento, setVelocidadViento] = useState(0)
  const [codigoClima, setCodigoClima] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  // Pre-llenar al montar y cada vez que cambia `medicion` (crear vs editar).
  useEffect(() => {
    setError(null)
    if (medicion) {
      setCiudad(medicion.ciudad != null ? String(medicion.ciudad) : '')
      setFecha(medicion.fecha ?? '')
      setTempMax(medicion.temp_max ?? '')
      setTempMin(medicion.temp_min ?? '')
      setTempMedia(medicion.temp_media ?? '')
      setPrecipitacion(medicion.precipitacion ?? 0)
      setVelocidadViento(medicion.velocidad_viento ?? 0)
      setCodigoClima(medicion.codigo_clima ?? 0)
    } else {
      setCiudad(ciudades && ciudades[0] ? String(ciudades[0].id) : '')
      setFecha(hoy())
      setTempMax('')
      setTempMin('')
      setTempMedia('')
      setPrecipitacion(0)
      setVelocidadViento(0)
      setCodigoClima(0)
    }
  }, [medicion, ciudades])

  function recalcularMedia(nuevoMax, nuevoMin) {
    if (nuevoMax !== '' && nuevoMin !== '') {
      const media = (Number(nuevoMax) + Number(nuevoMin)) / 2
      if (Number.isFinite(media)) {
        setTempMedia(media.toFixed(2))
      }
    }
  }

  function cambiarTempMax(v) {
    setTempMax(v)
    recalcularMedia(v, tempMin)
  }

  function cambiarTempMin(v) {
    setTempMin(v)
    recalcularMedia(tempMax, v)
  }

  function validar() {
    if (!ciudad) return 'Selecciona una ciudad.'
    if (!fecha) return 'La fecha es obligatoria.'
    if (tempMax !== '' && Number(tempMax) < -90) {
      return 'La temperatura máxima debe ser mayor o igual a -90 °C.'
    }
    if (tempMin !== '' && Number(tempMin) < -90) {
      return 'La temperatura mínima debe ser mayor o igual a -90 °C.'
    }
    if (tempMedia !== '' && Number(tempMedia) < -90) {
      return 'La temperatura media debe ser mayor o igual a -90 °C.'
    }
    if (precipitacion !== '' && Number(precipitacion) < 0) {
      return 'La precipitación no puede ser negativa.'
    }
    if (velocidadViento !== '' && Number(velocidadViento) < 0) {
      return 'La velocidad del viento no puede ser negativa.'
    }
    return null
  }

  async function guardar(e) {
    e.preventDefault()
    const err = validar()
    if (err) {
      setError(err)
      return
    }

    const cuerpo = {
      ciudad: Number(ciudad),
      fecha,
      temp_max: tempMax === '' ? null : Number(tempMax),
      temp_min: tempMin === '' ? null : Number(tempMin),
      temp_media: tempMedia === '' ? null : Number(tempMedia),
      precipitacion: precipitacion === '' ? null : Number(precipitacion),
      velocidad_viento: velocidadViento === '' ? null : Number(velocidadViento),
      codigo_clima: codigoClima === '' ? 0 : Number(codigoClima),
    }

    const url = esEdicion
      ? `${API_URL}/mediciones/${medicion.id}/`
      : `${API_URL}/mediciones/`
    const metodo = esEdicion ? 'PUT' : 'POST'

    setEnviando(true)
    setError(null)
    try {
      await pedirOExplotar(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(cuerpo),
      })
      onGuardado()
    } catch (e) {
      if (e instanceof FallaApi && e.tipo === 'http' && e.message.includes('401')) {
        setError('Token inválido o caducado. Inicia sesión de nuevo.')
      } else if (e instanceof FallaApi) {
        setError(e.message)
      } else {
        setError('No se pudo guardar la medición.')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fm-titulo"
    >
      <div className="modal-card">
        <div className="modal-encabezado">
          <h3 id="fm-titulo">
            {esEdicion ? 'Editar medición' : 'Nueva medición'}
          </h3>
          <button
            type="button"
            className="boton-mini"
            onClick={onCerrar}
            disabled={enviando}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <form className="modal-cuerpo" onSubmit={guardar}>
          {error && (
            <div
              className="aviso"
              data-tipo="error"
              style={{ marginBottom: '0.75rem' }}
            >
              <strong>Error</strong>
              {error}
            </div>
          )}

          <div className="campo">
            <label className="campo-etiqueta" htmlFor="fm-ciudad">Ciudad</label>
            <select
              id="fm-ciudad"
              className="campo"
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              disabled={enviando}
            >
              <option value="">— Selecciona una ciudad —</option>
              {ciudades.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.nombre} · {c.pais}
                </option>
              ))}
            </select>
          </div>

          <div className="campo">
            <label className="campo-etiqueta" htmlFor="fm-fecha">Fecha</label>
            <input
              id="fm-fecha"
              type="date"
              className="campo-texto"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={enviando}
              required
            />
          </div>

          <div className="rejilla-2">
            <div className="campo">
              <label className="campo-etiqueta" htmlFor="fm-tmax">T. máxima (°C)</label>
              <input
                id="fm-tmax"
                type="number"
                step="0.01"
                className="campo-texto campo--num"
                value={tempMax}
                onChange={(e) => cambiarTempMax(e.target.value)}
                disabled={enviando}
              />
            </div>
            <div className="campo">
              <label className="campo-etiqueta" htmlFor="fm-tmin">T. mínima (°C)</label>
              <input
                id="fm-tmin"
                type="number"
                step="0.01"
                className="campo-texto campo--num"
                value={tempMin}
                onChange={(e) => cambiarTempMin(e.target.value)}
                disabled={enviando}
              />
            </div>
          </div>

          <div className="campo">
            <label className="campo-etiqueta" htmlFor="fm-tmed">
              T. media (°C) · auto
            </label>
            <input
              id="fm-tmed"
              type="number"
              step="0.01"
              className="campo-texto"
              value={tempMedia}
              onChange={(e) => setTempMedia(e.target.value)}
              disabled={enviando}
            />
            <span className="texto-suave texto-pequeno">
              Se calcula como (máx + mín) / 2; puedes reescribirla manualmente.
            </span>
          </div>

          <div className="rejilla-3">
            <div className="campo">
              <label className="campo-etiqueta" htmlFor="fm-prec">Precip. (mm)</label>
              <input
                id="fm-prec"
                type="number"
                step="0.01"
                min="0"
                className="campo-texto campo--num"
                value={precipitacion}
                onChange={(e) => setPrecipitacion(e.target.value)}
                disabled={enviando}
              />
            </div>
            <div className="campo">
              <label className="campo-etiqueta" htmlFor="fm-viento">Viento (km/h)</label>
              <input
                id="fm-viento"
                type="number"
                step="0.01"
                min="0"
                className="campo-texto campo--num"
                value={velocidadViento}
                onChange={(e) => setVelocidadViento(e.target.value)}
                disabled={enviando}
              />
            </div>
            <div className="campo">
              <label className="campo-etiqueta" htmlFor="fm-cod">Código clima</label>
              <input
                id="fm-cod"
                type="number"
                step="1"
                className="campo-texto campo--num"
                value={codigoClima}
                onChange={(e) => setCodigoClima(e.target.value)}
                disabled={enviando}
              />
            </div>
          </div>

          <div className="modal-pie">
            <button
              type="button"
              className="boton-secundario"
              onClick={onCerrar}
              disabled={enviando}
            >
              Cancelar
            </button>
            <button type="submit" className="boton" disabled={enviando}>
              {enviando ? <span className="spinner spinner--pequeno" /> : null}
              {enviando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default FormularioMedicion
