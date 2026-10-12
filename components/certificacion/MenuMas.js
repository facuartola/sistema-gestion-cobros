"use client";

import { useMenu } from "../../lib/useMenu";
import { fechaDMA, hoyArgentinaISO } from "../../lib/fechas";

// El menú "⋯" de las pestañas de Certificación (el mismo que usa Cobros).
//   items: [{ etiqueta, ayuda?, onClick, deshabilitado? }]
export default function MenuMas({ items }) {
  const { abierto, setAbierto, cerrar, contenedor, onKeyDownMenu } = useMenu('[role="menuitem"]');
  return (
    <div className="menu-wrap" ref={contenedor}>
      <button type="button" className="btn-ghost" aria-haspopup="menu" aria-expanded={abierto} aria-label="Más acciones" onClick={() => setAbierto((a) => !a)}>
        ⋯
      </button>
      <div className={`menu glass${abierto ? " open" : ""}`} role="menu" aria-label="Más acciones" onKeyDown={onKeyDownMenu}>
        {items.map((it) => (
          <button
            key={it.etiqueta}
            type="button"
            role="menuitem"
            className="mi"
            tabIndex={abierto ? 0 : -1}
            disabled={it.deshabilitado}
            onClick={() => {
              cerrar();
              it.onClick();
            }}
          >
            {it.etiqueta}
            {it.ayuda && <small>{it.ayuda}</small>}
          </button>
        ))}
      </div>
    </div>
  );
}

// Lo que se imprime. Solo se ve en papel: título, certificación y fecha.
export function EncabezadoImpreso({ titulo, certificacion }) {
  return (
    <div className="print-only">
      <h2>{titulo}</h2>
      <p>
        {certificacion}, generado el {fechaDMA(hoyArgentinaISO())}
      </p>
    </div>
  );
}

export const ITEM_IMPRIMIR = (deshabilitado = false) => ({ etiqueta: "Imprimir", onClick: () => window.print(), deshabilitado });
