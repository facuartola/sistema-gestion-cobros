"use client";

import { useEffect, useRef, useState } from "react";
import { useCertificacion } from "../lib/CertificacionContext";
import { useDataProvider } from "../lib/dataProvider";
import { hoyArgentinaISO } from "../lib/fechas";
import { moduloEnCurso } from "../lib/certificacion";
import Enlace from "./Enlace";
import Ventana from "./Ventana";

// "Marcar sesión realizada" (tecla S o "+ Nuevo"): se elige el alumno de la
// certificación elegida y el módulo (por defecto, la primera sesión que le falta),
// con fecha de hoy. Se puede abrir con `inicial.inscripcionId` desde su ficha.
export default function MarcarSesionModal({ inicial = {}, onClose, onGuardado }) {
  const provider = useDataProvider();
  const { cert, resumen, cargando } = useCertificacion();
  const avance = resumen?.avance ?? [];
  const [inscripcionId, setInscripcionId] = useState(inicial.inscripcionId || "");
  const [ficha, setFicha] = useState(null);
  const [sesionId, setSesionId] = useState("");
  const [fecha, setFecha] = useState(hoyArgentinaISO());
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  // Candado contra el doble envío: `guardando` deshabilita el botón recién en
  // el próximo dibujo, y dos clics (o Enter repetido) muy seguidos entraban los
  // dos. La referencia se marca en el acto.
  const enviando = useRef(false);

  useEffect(() => {
    if (!inscripcionId) {
      setFicha(null);
      return undefined;
    }
    let vigente = true;
    provider
      .obtenerInscripcion(inscripcionId)
      .then((r) => {
        if (!vigente) return;
        setFicha(r);
        setSesionId(r.sesiones.find((s) => !s.realizada)?.id ?? "");
        setError("");
      })
      .catch((err) => vigente && setError(err.message || "No se pudieron cargar las sesiones."));
    return () => {
      vigente = false;
    };
  }, [provider, inscripcionId]);

  const pendientes = ficha?.sesiones.filter((s) => !s.realizada) ?? [];
  const elegida = pendientes.find((s) => s.id === sesionId);

  async function guardar(e) {
    e.preventDefault();
    if (guardando || enviando.current) return;
    if (!inscripcionId) return setError("Elegí el alumno.");
    if (!elegida) return setError("Elegí el módulo de la sesión.");
    if (!elegida.coach_id) return setError("Esta sesión no tiene coach: asignale uno al alumno antes de marcarla.");
    if (!fecha) return setError("Indicá la fecha de la sesión.");
    setGuardando(true);
    enviando.current = true;
    setError("");
    try {
      await provider.actualizarSesion(elegida.id, { realizada: true, fecha_realizada: fecha });
      onGuardado({ alumno: ficha.alumno, modulo: elegida.modulo });
    } catch (err) {
      setError(err.message || "Ocurrió un error de conexión.");
      setGuardando(false);
      enviando.current = false;
    }
  }

  return (
    <Ventana titulo="Marcar sesión realizada" onClose={onClose} bloqueada={guardando} formulario={guardar}>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {!cargando && !cert ? (
        <p className="lbl">Todavía no hay ninguna certificación. Creala en Certificación.</p>
      ) : avance.length === 0 ? (
        <p className="lbl">No hay alumnos inscriptos en {cert?.nombre ?? "la certificación"}.</p>
      ) : (
        <>
          <label className="field">
            <span>Alumno</span>
            <select value={inscripcionId} onChange={(e) => setInscripcionId(e.target.value)} autoFocus={!inscripcionId} disabled={guardando}>
              <option value="">Elegí un alumno…</option>
              {avance.map((a) => (
                <option key={a.inscripcion_id} value={a.inscripcion_id}>
                  {a.alumno} ({a.sesiones_realizadas} de {a.sesiones_totales})
                </option>
              ))}
            </select>
          </label>
          {ficha && pendientes.length === 0 && <p className="notice-banner">{ficha.alumno} ya hizo las 10 sesiones.</p>}
          {ficha && pendientes.length > 0 && (
            <>
              <label className="field">
                <span>Módulo</span>
                <select value={sesionId} onChange={(e) => setSesionId(e.target.value)} autoFocus={Boolean(inicial.inscripcionId)} disabled={guardando}>
                  {pendientes.map((s) => (
                    <option key={s.id} value={s.id}>
                      Módulo {s.modulo} · {s.coach ?? "sin coach"}
                    </option>
                  ))}
                </select>
                {elegida && <small>La da {elegida.coach ?? "nadie todavía: asigná un coach"}.</small>}
              </label>
              <label className="field">
                <span>Fecha</span>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={guardando} />
              </label>
            </>
          )}
        </>
      )}
      {resumen?.modulos && moduloEnCurso(resumen.modulos) && (
        <p className="lbl" style={{ marginTop: 4 }}>
          ¿Fue una clase y no una sesión?{" "}
          <Enlace href={`/certificacion/modulos/${moduloEnCurso(resumen.modulos).modulo_id}`} className="link-action" onClick={onClose}>
            Marcala en el módulo
          </Enlace>
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" className="btn-gold" disabled={guardando || !elegida}>
          {guardando ? "Guardando…" : "Marcar como realizada"}
        </button>
      </div>
    </Ventana>
  );
}
