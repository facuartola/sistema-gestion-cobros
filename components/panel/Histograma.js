"use client";

import { useState } from "react";
import { useEntrada } from "./hooks";

// Alumnos según sus sesiones hechas (0 a 10): una barra por cantidad. La barra
// de 10 (listos para certificar) va en verde. Cada barra es enfocable y dice su
// número en un tooltip de vidrio.
const ANCHO = 280;
const ALTO = 128;
const BASE = 20;

export default function Histograma({ distribucion }) {
  const entrando = useEntrada(true);
  const [activo, setActivo] = useState(null);
  const maximo = Math.max(1, ...distribucion);
  const banda = ANCHO / distribucion.length;
  const barra = Math.min(16, banda * 0.62);
  const alto = (v) => (v / maximo) * (ALTO - BASE - 22);
  const texto = (n, i) => `${n} ${n === 1 ? "alumno" : "alumnos"} con ${i} ${i === 1 ? "sesión hecha" : "sesiones hechas"}`;

  return (
    <div className="pn-histo">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} width="100%" role="presentation" aria-hidden="true" className={entrando ? "pn-entrando" : undefined}>
        <line x1="0" x2={ANCHO} y1={ALTO - BASE} y2={ALTO - BASE} className="pn-eje-cero" />
        {distribucion.map((n, i) => {
          const h = alto(n);
          const x = banda * i + (banda - barra) / 2;
          return (
            <g key={i}>
              {activo === i && <rect x={banda * i} y="0" width={banda} height={ALTO - BASE} rx="4" className="pn-resalte" />}
              <rect
                x={x}
                y={ALTO - BASE - Math.max(n > 0 ? 3 : 0, h)}
                width={barra}
                height={Math.max(n > 0 ? 3 : 0, h)}
                rx="3"
                className={`pn-barra ${i === 10 ? "pn-ok" : "pn-oro-plano"}`}
              />
              {n > 0 && (
                <text x={x + barra / 2} y={ALTO - BASE - Math.max(3, h) - 4} textAnchor="middle" className="pn-eje-texto">
                  {n}
                </text>
              )}
              <text x={x + barra / 2} y={ALTO - 5} textAnchor="middle" className="pn-eje-texto">
                {i}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="pn-histo-zonas">
        {distribucion.map((n, i) => (
          <div
            key={i}
            className="pn-zona"
            tabIndex={0}
            role="img"
            aria-label={texto(n, i)}
            onMouseEnter={() => setActivo(i)}
            onFocus={() => setActivo(i)}
            onMouseLeave={() => setActivo(null)}
            onBlur={() => setActivo((a) => (a === i ? null : a))}
          />
        ))}
      </div>
      {activo != null && (
        <div className="pn-tip glass" style={{ left: `${((activo + 0.5) / distribucion.length) * 100}%` }} aria-hidden="true">
          {texto(distribucion[activo], activo)}
        </div>
      )}
    </div>
  );
}
