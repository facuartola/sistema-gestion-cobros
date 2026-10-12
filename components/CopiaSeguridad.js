"use client";

import { useEffect, useState } from "react";
import { avisoDeCopia, leerUltimaCopia } from "../lib/copiaAviso";
import { useCopia } from "../lib/useCopia";

function Mensaje({ estado }) {
  if (!estado.tipo) return null;
  return (
    <p className={estado.tipo === "error" ? "error-banner" : "lbl"} role={estado.tipo === "error" ? "alert" : "status"}>
      {estado.texto}
    </p>
  );
}

// Configuración › Copia de seguridad.
export default function CopiaSeguridad() {
  const { descargar, ocupado, estado } = useCopia();
  return (
    <section className="card config-exportar" aria-label="Copia de seguridad">
      <h2 className="panel-titulo">Copia de seguridad</h2>
      <p className="lbl">
        Una copia de todos tus datos (clientes, cobros, gastos, certificación y recordatorios) para guardar por si algo falla. Se descarga en un solo archivo .zip.
      </p>
      <button type="button" className="btn-gold" onClick={descargar} disabled={ocupado}>
        {ocupado ? "Armando la copia…" : "Descargar copia de todos los datos"}
      </button>
      <Mensaje estado={estado} />
    </section>
  );
}

// Tarjeta discreta del Inicio: aparece si nunca se bajó una copia en este
// navegador o si pasaron más de 30 días.
export function AvisoCopia() {
  const [aviso, setAviso] = useState({ mostrar: false, texto: "" });
  useEffect(() => {
    setAviso(avisoDeCopia(leerUltimaCopia()));
  }, []);
  const { descargar, ocupado, estado } = useCopia({ onListo: () => setAviso({ mostrar: false, texto: "" }) });
  if (!aviso.mostrar && !estado.tipo) return null;
  return (
    <section className="card aviso-copia" aria-label="Aviso de copia de seguridad">
      <div>
        <p>{aviso.texto || "Listo."}</p>
        <p className="lbl">El aviso es por navegador: si usás otra compu o el celular, también te lo va a mostrar.</p>
        <Mensaje estado={estado} />
      </div>
      {aviso.mostrar && (
        <button type="button" className="btn-ghost" onClick={descargar} disabled={ocupado}>
          {ocupado ? "Armando la copia…" : "Descargar copia"}
        </button>
      )}
    </section>
  );
}
