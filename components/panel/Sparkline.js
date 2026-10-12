"use client";

import { useId } from "react";

// Mini línea de tendencia de un indicador: sin ejes ni números, solo la forma
// de los últimos meses. Decorativa (aria-hidden): el valor y la variación
// están en texto en la tarjeta.
export default function Sparkline({ valores, claseColor = "pn-spark-oro" }) {
  const id = useId().replace(/:/g, "");
  if (!valores || valores.length < 2) return null;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;
  const W = 100;
  const H = 30;
  const pad = 3;
  const punto = (v, i) => [(i / (valores.length - 1)) * W, pad + (H - 2 * pad) * (1 - (v - min) / rango)];
  const pts = valores.map(punto);
  const linea = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `0,${H} ${linea} ${W},${H}`;
  const [ux, uy] = pts[pts.length - 1];
  return (
    <div className={`pn-spark ${claseColor}`} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${id})`} />
        <polyline points={linea} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="pn-spark-punto" style={{ left: `${(ux / W) * 100}%`, top: `${(uy / H) * 100}%` }} />
    </div>
  );
}
