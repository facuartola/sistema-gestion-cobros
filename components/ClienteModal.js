"use client";

import { useEffect, useRef, useState } from "react";
import { armarCuerpoCliente } from "../lib/clienteFormulario";
import { useDataProvider } from "../lib/dataProvider";
import { LIMITES } from "../lib/validacion";
import { useFocusTrap } from "../lib/useFocusTrap";

export const TIPOS = {
  jugador: { label: "Jugador" },
  alumno: { label: "Alumno de la certificación" },
};

// Modal único para agregar (cliente = null) o editar (cliente = fila existente) un
// jugador o alumno. En edición el tipo queda fijo: cambiarlo implicaría mover a la
// persona y su historial de tabla, y eso no está en el alcance.
export default function ClienteModal({ tipoInicial, cliente = null, onClose, onSaved }) {
  const provider = useDataProvider();
  const editando = cliente !== null;
  const [tipo, setTipo] = useState(tipoInicial);
  const [nombre, setNombre] = useState(cliente?.nombre ?? "");
  // El monto arranca vacío y es obligatorio: no hay un valor "normal" que sugerir.
  const [montoMensual, setMontoMensual] = useState(cliente?.monto_mensual != null ? String(cliente.monto_mensual) : "");
  const [montoTotal, setMontoTotal] = useState(cliente?.monto_total != null ? String(cliente.monto_total) : "");
  const [dia, setDia] = useState(cliente?.dia_vencimiento != null ? String(cliente.dia_vencimiento) : "");
  const [contacto, setContacto] = useState(cliente?.contacto ?? "");
  const [notas, setNotas] = useState(cliente?.notas ?? "");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  // Candado contra el doble envío: `guardando` deshabilita el botón recién en
  // el próximo dibujo, y dos clics (o Enter repetido) muy seguidos entraban los
  // dos. La referencia se marca en el acto.
  const enviando = useRef(false);
  const formRef = useRef(null);
  useFocusTrap(formRef, true);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !guardando) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, guardando]);

  async function guardar(e) {
    e.preventDefault();
    if (guardando || enviando.current) return;

    const { body, error: errorForm } = armarCuerpoCliente({
      nombre,
      montoMensual,
      montoTotal,
      dia,
      contacto,
      notas,
      esAlumno: tipo === "alumno",
    });
    if (errorForm) return setError(errorForm);
    const nombreLimpio = body.nombre;

    setGuardando(true);
    enviando.current = true;
    setError("");
    try {
      if (editando) {
        await provider.actualizarPersona(tipo, cliente.id, body);
      } else {
        await provider.crearPersona(tipo, body);
      }
      onSaved(tipo, nombreLimpio, editando);
    } catch (err) {
      setError(err.message || "Ocurrió un error de conexión.");
      setGuardando(false);
      enviando.current = false;
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !guardando) onClose();
      }}
    >
      <form
        ref={formRef}
        className="modal glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cliente-modal-titulo"
        onSubmit={guardar}
        noValidate
      >
        <h2 id="cliente-modal-titulo">{editando ? "Editar cliente" : "Agregar cliente"}</h2>

        {error && <div className="error-banner" role="alert">{error}</div>}

        <label className="field">
          <span>Nombre</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus disabled={guardando} />
        </label>

        <label className="field">
          <span>Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={editando || guardando}>
            {Object.entries(TIPOS).map(([valor, t]) => (
              <option key={valor} value={valor}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Monto mensual a abonar (US$), obligatorio</span>
          <input
            type="number"
            min="1"
            inputMode="decimal"
            value={montoMensual}
            onChange={(e) => setMontoMensual(e.target.value)}
            placeholder="Ej: 150"
            required
            aria-required="true"
            disabled={guardando}
          />
          {editando && (
            <small>Aplica a las cuotas nuevas; las ya cargadas conservan su monto.</small>
          )}
        </label>

        {tipo === "alumno" && (
          <label className="field">
            <span>Monto total a abonar (US$), opcional</span>
            <input
              type="number"
              min="1"
              inputMode="decimal"
              value={montoTotal}
              onChange={(e) => setMontoTotal(e.target.value)}
              placeholder="Vacío = pago mensual sin techo"
              disabled={guardando}
            />
          </label>
        )}

        <label className="field">
          <span>Día del mes en que debe pagar (1-31), opcional</span>
          <input
            type="number"
            min="1"
            max="31"
            inputMode="numeric"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            disabled={guardando}
          />
        </label>

        <label className="field">
          <span>Contacto, opcional</span>
          <input
            type="text"
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
            placeholder="Ej: teléfono, mail o cómo prefiere que le escriba"
            maxLength={LIMITES.contacto}
            disabled={guardando}
          />
          <small>Para tenerlo a mano: un teléfono, un mail o una nota. No se le envía nada.</small>
        </label>

        <label className="field">
          <span>Notas, opcional</span>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            disabled={guardando}
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" className="btn-gold" disabled={guardando}>
            {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Agregar cliente"}
          </button>
        </div>
      </form>
    </div>
  );
}
