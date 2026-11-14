import {
  DESARROLLADOR,
  FUNCIONALIDAD_AGREGADA,
  PROYECTO,
  TECNOLOGIAS,
} from './datosProyecto.js'

/**
 * Apartado informativo: quién desarrolló el proyecto y qué funcionalidad
 * adicional se agregó (el comparador de ciudades). Es solo lectura: el texto
 * vive en datosProyecto.js.
 */
function Acerca() {
  return (
    <section className="panel">
      <div className="panel-encabezado">
        <div>
          <h2>Acerca de</h2>
          <p className="texto-suave">{PROYECTO.nombre}</p>
        </div>
      </div>

      <div className="panel-cuerpo acerca">
        <div className="bloque">
          <div className="bloque-titulo">Desarrollador</div>
          <dl className="ficha">
            {[
              ['Nombre', DESARROLLADOR.nombre],
              ['Rol', DESARROLLADOR.rol],
              ['Trabajo', DESARROLLADOR.taller],
              ['Fecha', DESARROLLADOR.fecha],
            ].map(([etiqueta, valor]) => (
              <div className="ficha-fila" key={etiqueta}>
                <dt>{etiqueta}</dt>
                <dd>{valor}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="bloque">
          <div className="bloque-titulo">Funcionalidad agregada</div>
          <h3 className="acerca-subtitulo">{FUNCIONALIDAD_AGREGADA.nombre}</h3>
          <p>{FUNCIONALIDAD_AGREGADA.descripcion}</p>
          <p className="texto-suave">Cómo se usa:</p>
          <ol className="acerca-lista">
            {FUNCIONALIDAD_AGREGADA.pasos.map((paso) => (
              <li key={paso}>{paso}</li>
            ))}
          </ol>
        </div>

        <div className="bloque">
          <div className="bloque-titulo">Sobre el proyecto</div>
          <p>{PROYECTO.descripcion}</p>
          <dl className="ficha">
            {TECNOLOGIAS.map(([etiqueta, valor]) => (
              <div className="ficha-fila" key={etiqueta}>
                <dt>{etiqueta}</dt>
                <dd>{valor}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

export default Acerca
