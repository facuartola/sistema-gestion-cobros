"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMenosMovimiento } from "../lib/useMenosMovimiento";

const DURACION_MS = 2600;
const SALIDA_MS = 260; // igual que la transición de .bienvenida-overlay.saliendo

// Saludo breve al iniciar sesión. No atrapa clicks (pointer-events: none):
// si alguien hace click rápido en un link para saltarlo, el click llega igual
// a la página y además cierra el saludo. También se cierra con cualquier
// tecla o solo, a los ~2,6 s.
export default function Bienvenida({ titulo, subtitulo, onCerrar }) {
  const menosMovimiento = useMenosMovimiento();
  const [saliendo, setSaliendo] = useState(false);
  const cerradoRef = useRef(false);

  const cerrar = useCallback(() => {
    if (cerradoRef.current) return;
    cerradoRef.current = true;
    if (menosMovimiento) {
      onCerrar();
      return;
    }
    setSaliendo(true);
    setTimeout(onCerrar, SALIDA_MS);
  }, [menosMovimiento, onCerrar]);

  useEffect(() => {
    const temporizador = setTimeout(cerrar, DURACION_MS);
    // Fase de captura: se entera del click antes que cualquier componente
    // de la página, sin frenarlo.
    window.addEventListener("pointerdown", cerrar, true);
    window.addEventListener("keydown", cerrar, true);
    return () => {
      clearTimeout(temporizador);
      window.removeEventListener("pointerdown", cerrar, true);
      window.removeEventListener("keydown", cerrar, true);
    };
  }, [cerrar]);

  return (
    <div className={`bienvenida-overlay${saliendo ? " saliendo" : ""}`} role="status" aria-live="polite">
      <div className="glass bienvenida-tarjeta">
        <span className="brand-mark" aria-hidden="true">
          C
        </span>
        <p className="bienvenida-titulo">{titulo}</p>
        {subtitulo && <p className="bienvenida-subtitulo">{subtitulo}</p>}
      </div>
    </div>
  );
}
