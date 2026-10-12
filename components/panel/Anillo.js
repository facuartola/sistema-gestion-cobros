"use client";

import { useEntrada } from "./hooks";

// Anillo de segmentos con el total en el centro, hecho con círculos SVG
// (stroke-dasharray). Los segmentos y la leyenda se pueden tocar o enfocar:
// `elegido` marca uno (el resto se atenúa) y `onElegir(clave)` avisa. Si no hay
// nada que repartir (total 0) dibuja el anillo vacío y tenue.
//
//   segmentos: [{ clave, valor, claseColor }]  (claseColor: clase CSS con `stroke`)
export default function Anillo({ segmentos, centroValor, centroEtiqueta, tamano = 168, grosor = 18, elegido = null, onElegir, ariaLabel }) {
  const entrando = useEntrada(true);
  const r = (tamano - grosor) / 2;
  const c = 2 * Math.PI * r;
  const total = segmentos.reduce((a, s) => a + s.valor, 0);
  const visibles = segmentos.filter((s) => s.valor > 0);
  const separacion = visibles.length > 1 ? 3 : 0;

  let inicio = 0;
  const arcos = visibles.map((s) => {
    const largo = Math.max(0, (s.valor / total) * c - separacion);
    const arco = { ...s, largo, desde: inicio };
    inicio += (s.valor / total) * c;
    return arco;
  });

  return (
    <div className="pn-anillo" style={{ width: tamano, height: tamano }}>
      <svg width={tamano} height={tamano} viewBox={`0 0 ${tamano} ${tamano}`} role="img" aria-label={ariaLabel} className={entrando ? "pn-entrando" : undefined}>
        <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" strokeWidth={grosor} className="pn-anillo-fondo" />
        <g transform={`rotate(-90 ${tamano / 2} ${tamano / 2})`}>
          {arcos.map((a) => (
            <circle
              key={a.clave}
              cx={tamano / 2}
              cy={tamano / 2}
              r={r}
              fill="none"
              strokeWidth={elegido === a.clave ? grosor + 4 : grosor}
              strokeDasharray={`${a.largo} ${c - a.largo}`}
              strokeDashoffset={-a.desde}
              className={`pn-segmento ${a.claseColor}${elegido && elegido !== a.clave ? " pn-atenuado" : ""}`}
              style={{ "--largo": a.largo, "--resto": c - a.largo }}
              onClick={onElegir ? () => onElegir(a.clave) : undefined}
            />
          ))}
        </g>
      </svg>
      <div className="pn-anillo-centro">
        <div className="pn-anillo-valor num">{centroValor}</div>
        <div className="lbl">{centroEtiqueta}</div>
      </div>
    </div>
  );
}
