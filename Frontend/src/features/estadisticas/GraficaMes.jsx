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

/**
 * Gráfica de temperatura media promedio por mes.
 *
 * Props:
 *   - datos: array de { mes, temp_media_promedio, precipitacion_total }
 *
 * El eje X usa el campo `mes` (formato YYYY-MM). El stroke proviene de la
 * variable CSS --azul, leído en runtime para respetar el tema de la app.
 */
function GraficaMes({ datos = [] }) {
  const azul = getComputedStyle(document.documentElement)
    .getPropertyValue('--azul')
    .trim() || '#2b2b2b'
  const celeste = getComputedStyle(document.documentElement)
    .getPropertyValue('--celeste')
    .trim() || '#8a8a8a'

  if (!datos || datos.length === 0) {
    return (
      <div className="carga-bloque texto-suave">
        Sin datos mensuales para los filtros actuales.
      </div>
    )
  }

  const datosFormateados = datos.map((d) => ({
    ...d,
    mesLabel: String(d.mes ?? ''),
  }))

  return (
    <div className="grafica-contenedor" role="img" aria-label="Temperatura media promedio por mes">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datosFormateados} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="mesLabel" tickLine={false} axisLine={{ stroke: 'var(--borde)' }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={42}
            tickFormatter={(v) => `${Number(v).toFixed(1)}`}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(2)} °C`, 'Temp. media']}
            labelFormatter={(label) => `Mes: ${label}`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="temp_media_promedio"
            name="Temp. media (°C)"
            stroke={azul}
            strokeWidth={2.5}
            dot={{ r: 3, fill: azul }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="precipitacion_total"
            name="Precip. total (mm)"
            stroke={celeste}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default GraficaMes
