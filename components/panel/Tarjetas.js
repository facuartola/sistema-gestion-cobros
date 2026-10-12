"use client";

import { useId, useState } from "react";
import { Esqueleto } from "../Esqueleto";
import Sparkline from "./Sparkline";

// Indicador del panel: cifra grande, mini línea de tendencia y variación
// contra el mes anterior (verde si es buena, ámbar si no).
//   variacion: { texto, tono: "ok" | "warn" | "neutro" } | null
//   tendencia: [números] | null (sin línea si no hay historia)
export function TarjetaKpi({ etiqueta, valor, detalle, variacion, tendencia, claseColor, destacado = false, extra, className = "" }) {
  return (
    <section className={`card pn-kpi${destacado ? " pn-kpi-destacado" : ""} ${className}`} aria-label={etiqueta}>
      <div className="lbl pn-kpi-etiqueta">{etiqueta}</div>
      <div className="pn-kpi-valor num">{valor}</div>
      <div className="pn-kpi-pie">
        {variacion && <span className={`pn-variacion ${variacion.tono}`}>{variacion.texto}</span>}
        {detalle && <span className="pn-kpi-detalle">{detalle}</span>}
      </div>
      {extra}
      {tendencia && <Sparkline valores={tendencia} claseColor={claseColor} />}
    </section>
  );
}

export function EsqueletoKpi({ destacado = false, className = "" }) {
  return (
    <div className={`card pn-kpi${destacado ? " pn-kpi-destacado" : ""} ${className}`} aria-hidden="true">
      <Esqueleto ancho={90} alto={11} />
      <Esqueleto ancho={destacado ? 170 : 120} alto={destacado ? 38 : 26} style={{ marginTop: 14 }} />
      <Esqueleto ancho={80} alto={11} style={{ marginTop: 12 }} />
      <Esqueleto ancho="100%" alto={26} style={{ marginTop: "auto" }} />
    </div>
  );
}

// Tarjeta de un gráfico o bloque del panel: título, una línea de contexto, el
// contenido, y para lectores de pantalla un resumen en texto. Con `tabla`
// ofrece "Ver como tabla" (alternativa tabular del mismo gráfico). Con `vacio`
// muestra ese mensaje en vez del gráfico, y con `cargando` un esqueleto con la
// forma de la tarjeta.
//   tabla: { columnas: ["Mes", ...], filas: [["Octubre", "US$ 1"], ...] }
export function TarjetaPanel({ titulo, subtitulo, resumen, tabla, vacio, cargando, altoEsqueleto = 200, acciones, className = "", children, pie }) {
  const [comoTabla, setComoTabla] = useState(false);
  const idTitulo = useId();
  return (
    <section className={`card pn-tarjeta ${className}`} aria-labelledby={idTitulo}>
      <header className="pn-tarjeta-cabecera">
        <div>
          <h2 id={idTitulo} className="panel-titulo">
            {titulo}
          </h2>
          {subtitulo && !cargando && <p className="lbl">{subtitulo}</p>}
        </div>
        <div className="pn-tarjeta-acciones">
          {acciones}
          {tabla && !vacio && !cargando && (
            <button type="button" className="link-action" aria-pressed={comoTabla} onClick={() => setComoTabla((v) => !v)}>
              {comoTabla ? "Ver gráfico" : "Ver como tabla"}
            </button>
          )}
        </div>
      </header>

      {cargando ? (
        <div className="pn-esqueleto" aria-hidden="true">
          <Esqueleto ancho="100%" alto={altoEsqueleto} radio={10} />
        </div>
      ) : vacio ? (
        <div className="pn-vacio">
          <p>{vacio.titulo}</p>
          {vacio.detalle && <p className="lbl">{vacio.detalle}</p>}
          {vacio.accion}
        </div>
      ) : (
        <>
          {resumen && <p className="sr-only">{resumen}</p>}
          {comoTabla && tabla ? (
            <div className="pn-tabla-caja">
              <table className="pn-tabla">
                <caption className="sr-only">{titulo}</caption>
                <thead>
                  <tr>
                    {tabla.columnas.map((c, i) => (
                      <th key={c} scope="col" className={i > 0 ? "pn-der" : undefined}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabla.filas.map((f, i) => (
                    <tr key={i}>
                      {f.map((celda, j) => (j === 0 ? <th key={j} scope="row">{celda}</th> : <td key={j} className="pn-der num">{celda}</td>))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            children
          )}
          {pie}
        </>
      )}
    </section>
  );
}
