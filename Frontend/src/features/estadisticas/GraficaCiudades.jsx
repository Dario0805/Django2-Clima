import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts'

/**
 * Gráfica horizontal de precipitación total por ciudad.
 *
 * Props:
 *   - datos: array de { ciudad__nombre, precipitacion_total, mediciones }
 *
 * Usa layout="vertical" (barras horizontales). YAxis con dataKey="ciudad__nombre".
 * El relleno proviene de la variable CSS --celeste.
 */
function GraficaCiudades({ datos = [] }) {
  const celeste = getComputedStyle(document.documentElement)
    .getPropertyValue('--celeste')
    .trim() || '#9a9a9a'
  const acento = getComputedStyle(document.documentElement)
    .getPropertyValue('--acento')
    .trim() || '#2b2b2b'

  if (!datos || datos.length === 0) {
    return (
      <div className="carga-bloque texto-suave">
        Sin datos por ciudad para los filtros actuales.
      </div>
    )
  }

  // Destacar la ciudad con mayor precipitación con el color de acento.
  const maxIdx = datos.reduce(
    (acc, d, i, arr) =>
      Number(d.precipitacion_total) > Number(arr[acc]?.precipitacion_total ?? -1)
        ? i
        : acc,
    0,
  )

  return (
    <div className="grafica-contenedor" role="img" aria-label="Precipitación total por ciudad">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={datos}
          margin={{ top: 5, right: 24, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={{ stroke: 'var(--borde)' }}
            tickFormatter={(v) => `${Number(v).toFixed(0)}`}
          />
          <YAxis
            type="category"
            dataKey="ciudad__nombre"
            width={120}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value, name) => [
              `${Number(value).toFixed(2)} mm`,
              name === 'precipitacion_total' ? 'Precip. total' : name,
            ]}
          />
          <Bar dataKey="precipitacion_total" name="precipitacion_total" radius={[0, 4, 4, 0]}>
            {datos.map((_, i) => (
              <Cell key={i} fill={i === maxIdx ? acento : celeste} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default GraficaCiudades
