"use client";

import { useEffect, useRef, useState } from "react";

// Ancho en píxeles de un contenedor, siguiéndolo cuando cambia (ventana, menú
// lateral). null hasta la primera medición: los gráficos no dibujan nada antes
// (nada de ejes rotos ni saltos). Con un ancho de 0 (pestaña oculta) tampoco.
export function useAncho() {
  const ref = useRef(null);
  const [ancho, setAncho] = useState(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const medir = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      setAncho(w > 0 ? w : null);
    };
    medir();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho];
}

// true durante la primera entrada de un gráfico (unos 600 ms) y false después:
// las barras y anillos crecen una sola vez al cargar y no se vuelven a animar
// al cambiar de período.
export function useEntrada(activo = true, ms = 900) {
  const [entrando, setEntrando] = useState(true);
  useEffect(() => {
    if (!activo) return undefined;
    const t = setTimeout(() => setEntrando(false), ms);
    return () => clearTimeout(t);
  }, [activo, ms]);
  return entrando && activo;
}
