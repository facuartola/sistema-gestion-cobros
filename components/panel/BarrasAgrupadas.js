"use client";

import { useId, useState } from "react";
import { marcasDelEje, montoCorto, recorteDeValores, valorDibujado } from "../../lib/panorama";
import { formatoDolares } from "../../lib/moneda";
import { useAncho, useEntrada } from "./hooks";

// Barras agrupadas (a = dorado, b = hueso translúcido) y, si hay, una línea
// encima (por ejemplo el resultado neto). SVG propio, sin librerías: el ancho
// se mide y se dibuja a tamaño real, así el texto no se deforma.
//
//   datos: [{ clave, etiqueta, etiquetaLarga, a, b, linea? }]
//   nombres: { a, b, linea }
// Al pasar el mouse o enfocar con el teclado (cada mes es un punto de tabulación)
// aparece un tooltip de vidrio con el detalle del mes.
// Marca visible de una barra cortada: dos rayas oblicuas del color del fondo.
function MarcaDeCorte({ x, y, ancho, abajo }) {
  const y0 = abajo ? y - 9 : y + 5;
  return (
    <g className="pn-corte" aria-hidden="true">
      <line x1={x - 2} x2={x + ancho + 2} y1={y0 + 4} y2={y0 - 2} />
      <line x1={x - 2} x2={x + ancho + 2} y1={y0 + 9} y2={y0 + 3} />
    </g>
  );
}

const M = { izq: 46, der: 10, arriba: 12, abajo: 28 };

export default function BarrasAgrupadas({ datos, nombres, altura = 280, conLinea = false, ayuda }) {
  const [refCaja, ancho] = useAncho();
  const entrando = useEntrada(ancho != null);
  const [activo, setActivo] = useState(null);
  const idGrad = useId().replace(/:/g, "");

  const n = datos.length;
  const valores = datos.flatMap((d) => [d.a, d.b, ...(conLinea ? [d.linea] : [])]);
  // Un valor enorme no aplasta al resto: se dibuja cortado, con su valor real en el tooltip.
  const recorte = recorteDeValores(valores);
  const vis = (v) => valorDibujado(v, recorte);
  const dibujados = valores.map(vis);
  const marcas = marcasDelEje(Math.min(0, ...dibujados), Math.max(0, ...dibujados));
  const dMin = marcas[0];
  const dMax = marcas[marcas.length - 1];

  const w = ancho ?? 0;
  const anchoUtil = Math.max(0, w - M.izq - M.der);
  const altoUtil = altura - M.arriba - M.abajo;
  const banda = n ? anchoUtil / n : 0;
  const barra = Math.max(4, Math.min(30, banda * 0.3));
  const hueco = Math.min(4, barra * 0.2);
  const y = (v) => M.arriba + altoUtil - ((v - dMin) / (dMax - dMin || 1)) * altoUtil;
  const y0 = y(0);
  const cx = (i) => M.izq + banda * i + banda / 2;
  // Con muchas columnas se muestran etiquetas alternas para que no se pisen.
  const salto = banda < 34 ? 2 : 1;

  const puntosLinea = conLinea ? datos.map((d, i) => `${cx(i).toFixed(1)},${y(vis(d.linea)).toFixed(1)}`).join(" ") : "";
  const fila = activo != null ? datos[activo] : null;
  const izqTip = activo != null ? Math.min(Math.max(cx(activo), 90), Math.max(90, w - 90)) : 0;

  return (
    <div className="pn-caja" ref={refCaja} style={{ height: altura }} onMouseLeave={() => setActivo(null)}>
      {ancho != null && (
        <>
          <svg width={w} height={altura} role="presentation" aria-hidden="true" className={`pn-svg${entrando ? " pn-entrando" : ""}`}>
            <defs>
              <linearGradient id={`${idGrad}-oro`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d9b66f" />
                <stop offset="100%" stopColor="#b8893e" />
              </linearGradient>
            </defs>
            {marcas.map((m) => (
              <g key={m}>
                <line x1={M.izq} x2={w - M.der} y1={y(m)} y2={y(m)} className={m === 0 ? "pn-eje-cero" : "pn-grilla"} />
                <text x={M.izq - 8} y={y(m)} dy="0.32em" textAnchor="end" className="pn-eje-texto">
                  {m === 0 ? "0" : montoCorto(m)}
                </text>
              </g>
            ))}
            {datos.map((d, i) => (
              <g key={d.clave}>
                {activo === i && <rect x={M.izq + banda * i + 2} y={M.arriba} width={Math.max(0, banda - 4)} height={altoUtil} rx="6" className="pn-resalte" />}
                <rect
                  x={cx(i) - barra - hueco / 2}
                  y={Math.min(y(vis(d.a)), y0)}
                  width={barra}
                  height={Math.max(d.a > 0 ? 2 : 0, Math.abs(y(vis(d.a)) - y0))}
                  rx="3"
                  fill={`url(#${idGrad}-oro)`}
                  className="pn-barra"
                />
                <rect
                  x={cx(i) + hueco / 2}
                  y={Math.min(y(vis(d.b)), y0)}
                  width={barra}
                  height={Math.max(d.b > 0 ? 2 : 0, Math.abs(y(vis(d.b)) - y0))}
                  rx="3"
                  className="pn-barra pn-hueso"
                />
                {recorte.cortado(d.a) && <MarcaDeCorte x={cx(i) - barra - hueco / 2} y={y(vis(d.a))} ancho={barra} abajo={d.a < 0} />}
                {recorte.cortado(d.b) && <MarcaDeCorte x={cx(i) + hueco / 2} y={y(vis(d.b))} ancho={barra} abajo={d.b < 0} />}
                {i % salto === 0 && (
                  <text x={cx(i)} y={altura - 8} textAnchor="middle" className="pn-eje-texto">
                    {d.etiqueta}
                  </text>
                )}
              </g>
            ))}
            {conLinea && n > 1 && <polyline points={puntosLinea} className="pn-linea" pathLength="1" />}
            {conLinea &&
              datos.map((d, i) => <circle key={d.clave} cx={cx(i)} cy={y(vis(d.linea))} r={activo === i ? 4.5 : 3} className="pn-punto" />)}
          </svg>
          {/* Una zona enfocable por mes, encima del dibujo. */}
          <div className="pn-zonas" style={{ left: M.izq, width: anchoUtil, top: 0, height: altura }}>
            {datos.map((d, i) => (
              <div
                key={d.clave}
                className="pn-zona"
                tabIndex={0}
                role="img"
                aria-label={ayuda(d)}
                onMouseEnter={() => setActivo(i)}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo((a) => (a === i ? null : a))}
              />
            ))}
          </div>
          {fila && (
            <div className="pn-tip glass" style={{ left: izqTip }} aria-hidden="true">
              <b>{fila.etiquetaLarga}</b>
              {[fila.a, fila.b, ...(conLinea ? [fila.linea] : [])].some((v) => recorte.cortado(v)) && <small className="pn-tip-corte">Barra cortada: el valor es mucho mayor que el resto</small>}
              <span>
                <i className="pn-leyenda-oro" />
                {nombres.a} <em>{formatoDolares(fila.a)}</em>
              </span>
              <span>
                <i className="pn-leyenda-hueso" />
                {nombres.b} <em>{formatoDolares(fila.b)}</em>
              </span>
              {conLinea && (
                <span>
                  <i className="pn-leyenda-linea" />
                  {nombres.linea} <em>{formatoDolares(fila.linea)}</em>
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
