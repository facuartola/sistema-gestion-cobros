"use client";

import { useState } from "react";
import { useDataProvider } from "./dataProvider";
import { separadorDelNavegador } from "./csv";
import { guardarUltimaCopia } from "./copiaAviso";
import { useCandado } from "./useCandado";
import { enDemo } from "./navegador";

function bajarArchivo(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Descarga de la copia de seguridad, con candado contra el doble clic: tres
// clics seguidos bajan un solo archivo. `onListo` avisa a quien la use (por
// ejemplo para esconder el aviso de copia vieja).
export function useCopia({ onListo } = {}) {
  const proveedor = useDataProvider();
  const { ocupado, ejecutar } = useCandado();
  const [estado, setEstado] = useState({ tipo: null, texto: "" });

  function descargar() {
    return ejecutar(async () => {
      setEstado({ tipo: null, texto: "" });
      try {
        const { blob, nombre, cercaDelLimite } = await proveedor.descargarCopia(separadorDelNavegador());
        bajarArchivo(blob, nombre);
        // La demo no escribe nada en el navegador.
        if (!enDemo()) guardarUltimaCopia();
        onListo?.();
        setEstado({
          tipo: "ok",
          texto: cercaDelLimite
            ? "Copia descargada. Ojo: ya pesa más de 5 MB y pronto el servidor no va a poder armarla. Avisale a quien mantiene el sistema."
            : "Copia descargada. Guardala en un lugar seguro, por ejemplo en tu Drive o en un pendrive.",
        });
      } catch (err) {
        setEstado({ tipo: "error", texto: err?.message || "No se pudo completar la copia. Probá de nuevo en un momento." });
      }
    });
  }

  return { descargar, ocupado, estado };
}
