import { useEffect, useState, useCallback } from 'react'
import { API_URL, pedirOExplotar, FallaApi } from '../../shared/api.js'

/**
 * Selector de ciudad reutilizable.
 *
 * - Carga la lista de ciudades desde /api/ciudades/ al montar.
 * - Si `todas` es true, antepone una opción con value="".
 * - Muestra un badge con el total de ciudades disponibles.
 *
 * Props:
 *   - value: id de ciudad seleccionada (string). "" = todas.
 *   - onChange: callback(nuevoValor)
 *   - todas: boolean (default true) — añade "Todas las ciudades".
 */
function CiudadSelector({ value, onChange, todas = true }) {
  const [ciudades, setCiudades] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const { datos } = await pedirOExplotar(`${API_URL}/ciudades/`)
      setCiudades(Array.isArray(datos) ? datos : datos?.results ?? [])
    } catch (e) {
      if (e instanceof FallaApi) setError(e.message)
      else setError('No se pudo cargar la lista de ciudades.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (error) {
    return (
      <div className="campo">
        <span className="campo-etiqueta">Ciudad</span>
        <div className="aviso" data-tipo="error">
          {error}
        </div>
        <button type="button" className="boton-mini" onClick={cargar}>
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="campo">
      <span className="campo-etiqueta">
        Ciudad
        {!cargando && (
          <span className="badge badge--muy-pequeno" style={{ marginLeft: '0.4rem' }}>
            {ciudades.length} ciudades
          </span>
        )}
      </span>
      <select
        className="campo"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={cargando}
        aria-busy={cargando}
      >
        {cargando && <option value="">Cargando ciudades…</option>}
        {!cargando && todas && <option value="">Todas las ciudades</option>}
        {!cargando &&
          ciudades.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.nombre} · {c.pais}
            </option>
          ))}
      </select>
    </div>
  )
}

export default CiudadSelector
