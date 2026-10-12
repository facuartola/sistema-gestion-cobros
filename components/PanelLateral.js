"use client";

import { useEffect, useId, useRef } from "react";
import { useFocusTrap } from "../lib/useFocusTrap";

// Panel que entra por la derecha (en el celular, una hoja que sube desde abajo).
// Como las ventanas: cierra con Escape y con un click afuera, atrapa el foco y
// lo devuelve a quien lo abrió. `bloqueado` impide cerrarlo mientras se guarda.
export default function PanelLateral({ titulo, subtitulo, onClose, bloqueado = false, children }) {
  const idTitulo = useId();
  const ref = useRef(null);
  useFocusTrap(ref, true);

  useEffect(() => {
    const previo = document.activeElement;
    // El foco entra al panel (al contenedor, no a un campo: así en el celular no
    // se abre el teclado) para que Tab recorra el panel y no la página de atrás.
    ref.current?.focus({ preventScroll: true });
    return () => {
      if (previo && typeof previo.focus === "function" && document.contains(previo)) previo.focus();
    };
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !bloqueado) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, bloqueado]);

  return (
    <div
      className="panel-fondo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !bloqueado) onClose();
      }}
    >
      <aside ref={ref} tabIndex={-1} className="panel-lateral glass" role="dialog" aria-modal="true" aria-labelledby={idTitulo}>
        <header className="panel-cabecera">
          <div>
            <h2 id={idTitulo}>{titulo}</h2>
            {subtitulo && <p className="lbl">{subtitulo}</p>}
          </div>
          <button type="button" className="btn-ghost panel-cerrar" onClick={onClose} disabled={bloqueado} aria-label="Cerrar">
            ✕
          </button>
        </header>
        {children}
      </aside>
    </div>
  );
}
