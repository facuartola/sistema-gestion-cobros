"use client";

import { useMenu } from "../lib/useMenu";
import { mesLabelCorto } from "../lib/resumen";
import { mesesDisponibles } from "../lib/AccionesContext";
import { IconoChevron } from "./Iconos";

// Selector de mes (últimos 6) con menú de vidrio. Es un botón con la lista
// desplegable debajo: se maneja con flechas, Enter y Escape.
export default function MonthSelect({ value, onChange }) {
  const { abierto, setAbierto, cerrar, contenedor, onKeyDownMenu } = useMenu('[role="option"]');
  const meses = mesesDisponibles();

  return (
    <div className="menu-wrap mes-wrap" ref={contenedor}>
      <button
        type="button"
        className="btn-ghost"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        {mesLabelCorto(value)}
        <span className="chev" style={{ transform: "rotate(90deg)" }}>
          <IconoChevron size={13} />
        </span>
      </button>
      <div className={`menu glass${abierto ? " open" : ""}`} role="listbox" aria-label="Mes" onKeyDown={onKeyDownMenu}>
        {meses.map((m) => (
          <button
            key={m}
            type="button"
            role="option"
            aria-selected={m === value}
            className="mi"
            tabIndex={abierto ? 0 : -1}
            onClick={() => {
              onChange(m);
              cerrar(true);
            }}
          >
            {mesLabelCorto(m)}
          </button>
        ))}
      </div>
    </div>
  );
}
