"use client";

import { useEffect } from "react";

// Toast angosto abajo a la derecha, con un botón "Deshacer" opcional. Se
// cierra solo a los pocos segundos; sirve para cambios de estado y bajas que
// no ameritan un historial completo, pero sí una salida rápida si fue sin querer.
export default function Toast({ mensaje, onDeshacer, onCerrar, duracionMs = 6000 }) {
  useEffect(() => {
    const t = setTimeout(onCerrar, duracionMs);
    return () => clearTimeout(t);
  }, [mensaje, onCerrar, duracionMs]);

  return (
    <div className="toast glass" role="status">
      <span>{mensaje}</span>
      {onDeshacer && (
        <button
          type="button"
          className="link-action"
          onClick={() => {
            onDeshacer();
            onCerrar();
          }}
        >
          Deshacer
        </button>
      )}
    </div>
  );
}
