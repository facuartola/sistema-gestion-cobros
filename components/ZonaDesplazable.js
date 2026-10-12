"use client";

import { useEffect, useRef, useState } from "react";

// Una zona que se desplaza sin barra visible (rueda, trackpad, touch y teclado:
// flechas, PageUp y PageDown) y avisa con un degradé al pie cuando queda
// contenido por ver. El degradé desaparece al llegar al final. Se enfoca con el
// teclado (tabIndex 0) y se anuncia como región con su nombre.
export default function ZonaDesplazable({ etiqueta, className = "", children }) {
  const cuerpo = useRef(null);
  const [hayMas, setHayMas] = useState(false);

  useEffect(() => {
    const el = cuerpo.current;
    if (!el) return undefined;
    const actualizar = () => setHayMas(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    actualizar();
    el.addEventListener("scroll", actualizar, { passive: true });
    const observador = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(actualizar);
    observador?.observe(el);
    for (const hijo of el.children) observador?.observe(hijo);
    return () => {
      el.removeEventListener("scroll", actualizar);
      observador?.disconnect();
    };
  });

  return (
    <div className={`zona-desplazable ${className}`.trim()}>
      <div ref={cuerpo} className="zona-desplazable-cuerpo" tabIndex={0} role="region" aria-label={etiqueta}>
        {children}
      </div>
      <div className={`zona-desplazable-pista${hayMas ? " visible" : ""}`} aria-hidden="true" />
    </div>
  );
}
