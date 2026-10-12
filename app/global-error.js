"use client";

import { useEffect } from "react";
import { registrarErrorFrontend } from "../lib/registrarErrorFrontend";

// Cubre el caso extremo de que falle el layout raíz (AuthGate, fuentes,
// etc.): Next descarta TODO el layout normal acá, así que este archivo
// arma su propio <html>/<body> mínimo.
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    registrarErrorFrontend({ mensaje: error?.message, stack: error?.stack, ruta: "global" });
  }, [error]);

  return (
    <html lang="es">
      <body style={{ margin: 0, background: "#0F1A2A", color: "#ECE5D7", fontFamily: "sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ maxWidth: 420, textAlign: "center", padding: 24 }}>
            <p style={{ fontSize: 20, margin: "0 0 10px" }}>Algo salió mal</p>
            <p style={{ fontSize: 14, color: "#97A0AE", margin: "0 0 20px", lineHeight: 1.6 }}>
              Hubo un error inesperado y ya quedó registrado. Probá recargar la página.
            </p>
            <button
              onClick={reset}
              style={{
                background: "#D9B66F",
                color: "#1c1406",
                border: "none",
                borderRadius: 9,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
