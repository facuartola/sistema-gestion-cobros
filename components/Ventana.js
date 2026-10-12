"use client";

import { useEffect, useId, useRef } from "react";
import { useFocusTrap } from "../lib/useFocusTrap";

// Ventana modal con vidrio: cierra con Escape y con click afuera, atrapa el
// foco y lo devuelve a quien la abrió. `bloqueada` impide cerrarla mientras
// se guarda.
export default function Ventana({ titulo, onClose, bloqueada = false, ancho = 440, children, formulario }) {
  const idTitulo = useId();
  const ref = useRef(null);
  useFocusTrap(ref, true);

  useEffect(() => {
    const previo = document.activeElement;
    return () => {
      if (previo && typeof previo.focus === "function" && document.contains(previo)) previo.focus();
    };
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !bloqueada) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, bloqueada]);

  const Contenedor = formulario ? "form" : "div";
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !bloqueada) onClose();
      }}
    >
      <Contenedor
        ref={ref}
        className="modal glass"
        style={{ maxWidth: ancho }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        onSubmit={formulario}
        noValidate={formulario ? true : undefined}
      >
        <h2 id={idTitulo}>{titulo}</h2>
        {children}
      </Contenedor>
    </div>
  );
}
