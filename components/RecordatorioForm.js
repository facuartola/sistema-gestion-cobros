"use client";

import { useState } from "react";
import { useRecordatoriosContext } from "../lib/RecordatoriosContext";
import { hoyArgentinaISO } from "../lib/fechas";
import { useCandado } from "../lib/useCandado";
import PersonaSelect from "./PersonaSelect";

function valoresDefault(prefill) {
  return {
    titulo: prefill?.titulo ?? "",
    fecha: prefill?.fecha ?? hoyArgentinaISO(),
    tipo: prefill?.tipo ?? "general",
    nota: prefill?.nota ?? "",
    persona:
      prefill?.jugador_id || prefill?.alumno_id
        ? {
            tipo: prefill.jugador_id ? "jugador" : "alumno",
            id: prefill.jugador_id || prefill.alumno_id,
            nombre: prefill.nombrePersona || "",
          }
        : null,
  };
}

// Formulario rápido para crear un recordatorio: título, fecha y, si se quiere,
// una persona. Se puede precargar (prefill) desde una sugerencia o desde el panel
// de un cliente; el tipo y la nota de una sugerencia viajan sin mostrarse.
export default function RecordatorioForm({ personas, prefill, onCreado, onCancelar, enVentana = false }) {
  const { crear } = useRecordatoriosContext();
  const [valores, setValores] = useState(valoresDefault(prefill));
  const candado = useCandado();
  const guardando = candado.ocupado;
  const [error, setError] = useState("");
  const [resetPersona, setResetPersona] = useState(0);

  function set(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

  function guardar(e) {
    e.preventDefault();
    return candado.ejecutar(async () => {
      const titulo = valores.titulo.trim();
      if (!titulo) return setError("Escribí qué no te querés olvidar.");
      if (!valores.fecha) return setError("Elegí para qué día.");
      setError("");
      try {
        const nuevo = await crear({
          titulo,
          fecha: valores.fecha,
          tipo: valores.tipo,
          nota: valores.nota.trim() || null,
          jugador_id: valores.persona?.tipo === "jugador" ? valores.persona.id : null,
          alumno_id: valores.persona?.tipo === "alumno" ? valores.persona.id : null,
        });
        onCreado(nuevo);
        setValores(valoresDefault(null));
        setResetPersona((n) => n + 1);
      } catch (err) {
        setError(err.message || "Ocurrió un error de conexión.");
      }
    });
  }

  return (
    <form className={enVentana ? undefined : "card recordatorio-form"} onSubmit={guardar} noValidate>
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className={enVentana ? undefined : "recordatorio-form-grid"}>
        <label className="field">
          <span>¿Qué no te querés olvidar?</span>
          <input
            value={valores.titulo}
            onChange={(e) => set("titulo", e.target.value)}
            disabled={guardando}
            placeholder="Ej: Llamar a Juan por la cuota"
            autoFocus={enVentana || Boolean(prefill)}
          />
        </label>

        <label className="field">
          <span>Para el día</span>
          <input type="date" value={valores.fecha} onChange={(e) => set("fecha", e.target.value)} disabled={guardando} />
        </label>

        <label className="field">
          <span>Sobre una persona, si querés</span>
          <PersonaSelect key={resetPersona} personas={personas} valor={valores.persona} onChange={(p) => set("persona", p)} disabled={guardando} />
        </label>

        {!enVentana && (
          <div className="recordatorio-form-boton">
            <button type="submit" className="btn-gold" disabled={guardando}>
              {guardando ? "Agregando…" : "Agregar"}
            </button>
          </div>
        )}
      </div>

      {enVentana && (
        <div className="modal-actions">
          {onCancelar && (
            <button type="button" className="btn-ghost" onClick={onCancelar} disabled={guardando}>
              Cancelar
            </button>
          )}
          <button type="submit" className="btn-gold" disabled={guardando}>
            {guardando ? "Agregando…" : "Agregar"}
          </button>
        </div>
      )}
    </form>
  );
}
