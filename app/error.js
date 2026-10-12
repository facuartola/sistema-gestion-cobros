"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { registrarErrorFrontend } from "../lib/registrarErrorFrontend";

// Error boundary de Next para cualquier error de render dentro del layout
// normal (con sidebar). app/global-error.js cubre el caso más raro: que
// falle el layout raíz en sí.
export default function ErrorBoundary({ error, reset }) {
  const pathname = usePathname();

  useEffect(() => {
    registrarErrorFrontend({ mensaje: error?.message, stack: error?.stack, ruta: pathname });
  }, [error, pathname]);

  return (
    <div className="card" style={{ padding: "40px 36px", maxWidth: 480 }}>
      <p style={{ fontFamily: "var(--serif)", fontSize: 22, margin: "0 0 10px" }}>Algo salió mal</p>
      <p style={{ fontSize: 14, color: "var(--suave)", margin: "0 0 20px", lineHeight: 1.6 }}>
        Hubo un error inesperado en esta pantalla. Ya quedó registrado. Podés intentar de nuevo, o volver a
        cargar la página si el problema sigue.
      </p>
      <button className="btn-gold" onClick={reset}>
        Intentar de nuevo
      </button>
    </div>
  );
}
