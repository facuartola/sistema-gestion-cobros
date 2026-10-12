"use client";

import { useState } from "react";
import { useDataProvider } from "../../lib/dataProvider";
import { LIMITES_CERT, validarCertificacion } from "../../lib/certificacionValidacion";
import { useCandado } from "../../lib/useCandado";
import Ventana from "../Ventana";

function AvisoError({ texto }) {
  return texto ? (
    <div className="error-banner" role="alert">
      {texto}
    </div>
  ) : null;
}

function CampoTarifa({ etiqueta, valor, onChange, disabled, ayuda, placeholder = "Ej: 50" }) {
  return (
    <label className="field">
      <span>{etiqueta}</span>
      <input type="number" min="0" step="any" inputMode="decimal" value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} />
      {ayuda && <small>{ayuda}</small>}
    </label>
  );
}

const texto = (v) => (v === null || v === undefined ? "" : String(v));

// Crear una certificación (cert = null) o editar la existente.
export function CertificacionModal({ cert = null, onClose, onGuardada }) {
  const provider = useDataProvider();
  const editando = cert !== null;
  const [nombre, setNombre] = useState(cert?.nombre ?? "");
  const [fecha, setFecha] = useState(cert?.fecha_inicio ?? "");
  const [sesion, setSesion] = useState(texto(cert?.tarifa_sesion));
  const [encuentro, setEncuentro] = useState(texto(cert?.tarifa_encuentro));
  const [practica, setPractica] = useState(texto(cert?.tarifa_practica));
  const [estado, setEstado] = useState(cert?.estado ?? "en_curso");
  const [error, setError] = useState("");
  const candado = useCandado();
  const guardando = candado.ocupado;

  function guardar(e) {
    e.preventDefault();
    return candado.ejecutar(async () => {
      const cuerpo = {
        nombre,
        fecha_inicio: fecha,
        tarifa_sesion: sesion,
        tarifa_encuentro: encuentro,
        tarifa_practica: practica,
        ...(editando ? { estado } : {}),
      };
      const { datos, error: invalido } = validarCertificacion(cuerpo, { creando: !editando });
      if (invalido) return setError(invalido);
      setError("");
      try {
        const guardada = editando ? await provider.actualizarCertificacion(cert.id, datos) : await provider.crearCertificacion(datos);
        onGuardada({ cert: guardada, editando });
      } catch (err) {
        setError(err.message || "Ocurrió un error de conexión.");
      }
    });
  }

  return (
    <Ventana titulo={editando ? "Editar certificación" : "Nueva certificación"} onClose={onClose} bloqueada={guardando} formulario={guardar} ancho={480}>
      <AvisoError texto={error} />
      {editando && (
        <p className="notice-banner" role="note">
          Cambiar las tarifas no modifica lo que ya se pagó: las nuevas valen para lo que todavía no se pagó.
        </p>
      )}
      <label className="field">
        <span>Nombre</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={LIMITES_CERT.nombreCertificacion} placeholder="Ej: Certificación 2026" autoFocus disabled={guardando} />
      </label>
      <label className="field">
        <span>Fecha de inicio, opcional</span>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={guardando} />
      </label>
      <CampoTarifa etiqueta="Tarifa por sesión de coaching (US$)" valor={sesion} onChange={setSesion} disabled={guardando} />
      <CampoTarifa etiqueta="Tarifa por clase (US$)" valor={encuentro} onChange={setEncuentro} disabled={guardando} placeholder="Ej: 40" />
      <CampoTarifa
        etiqueta="Tarifa por práctica final (US$), opcional"
        valor={practica}
        onChange={setPractica}
        disabled={guardando}
        placeholder="Vacía = la tarifa por clase"
        ayuda="Si la dejás vacía, las prácticas finales de los módulos 9 y 10 se pagan con la tarifa por clase."
      />
      <p className="lbl" style={{ marginBottom: 14 }}>
        A un invitado se le puede poner una tarifa especial en la clase o la sesión que dé. Mientras falte una tarifa, no se puede pagar al equipo.
      </p>
      {editando && (
        <label className="field">
          <span>Estado</span>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} disabled={guardando}>
            <option value="en_curso">En curso</option>
            <option value="finalizada">Finalizada (deja de aparecer en Inicio)</option>
          </select>
        </label>
      )}
      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" className="btn-gold" disabled={guardando}>
          {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear certificación"}
        </button>
      </div>
    </Ventana>
  );
}
