"use client";

import { useEffect, useState } from "react";

// true si el sistema pide "reducir movimiento". Escucha cambios en vivo
// (si la clienta lo activa con la app abierta, se respeta sin recargar).
export function useMenosMovimiento() {
  const [menos, setMenos] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMenos(mq.matches);
    const alCambiar = (e) => setMenos(e.matches);
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);
  return menos;
}
