"use client";

import { useEffect, useState } from "react";
import { useAcciones } from "../../lib/AccionesContext";
import { useDataProvider } from "../../lib/dataProvider";
import { MODULOS } from "../../lib/certificacion";
import { LIMITES_CERT, validarPersonaEquipo } from "../../lib/certificacionValidacion";
import { rolDe } from "../../lib/certificacionPagina";
import { formatoDolares } from "../../lib/moneda";
import { useCandado } from "../../lib/useCandado";
import { ETIQUETA_METODO } from "../../lib/metodoPago";
import Enlace from "../Enlace";
import { EsqueletoLista } from "../Esqueleto";
import PanelLateral from "../PanelLateral";
import { BarraAvance, CONCEPTO, PillPagado, fechaCortaOGuion } from "./comun";

function AvisoError({ texto }) {
  return texto ? (
    <div className="error-banner" role="alert">
      {texto}
    </div>
  ) : null;
}

// Inscribir un alumno activo que todavía no esté en la certificación.
export function PanelInscribir({ cert, alumnos, equipo, onClose, onInscripto }) {
  const provider = useDataProvider();
  const [alumnoId, setAlumnoId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [error, setError] = useState("");
  const candado = useCandado();
  const guardando = candado.ocupado;

  function guardar(e) {
    e.preventDefault();
    return candado.ejecutar(async () => {
      if (!alumnoId) return setError("Elegí el alumno que vas a inscribir.");
      setError("");
      try {
        await provider.inscribirAlumno({ certificacion_id: cert.id, alumno_id: alumnoId, coach_id: coachId || null });
        onInscripto({ alumno: alumnos.find((a) => a.id === alumnoId)?.nombre ?? "" });
      } catch (err) {
        setError(err.message || "Ocurrió un error de conexión.");
      }
    });
  }

  return (
    <PanelLateral titulo="Inscribir alumno" subtitulo={cert.nombre} onClose={onClose} bloqueado={guardando}>
      <form className="panel-bloque" onSubmit={guardar} noValidate>
        <AvisoError texto={error} />
        {alumnos.length === 0 ? (
          <p className="lbl">Todos los alumnos activos ya están inscriptos. Para sumar a alguien, primero cargalo en Cobros, pestaña Alumnos.</p>
        ) : (
          <>
            <label className="field">
              <span>Alumno</span>
              <select value={alumnoId} onChange={(e) => setAlumnoId(e.target.value)} autoFocus disabled={guardando}>
                <option value="">Elegí un alumno…</option>
                {alumnos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Coach</span>
              <select value={coachId} onChange={(e) => setCoachId(e.target.value)} disabled={guardando}>
                <option value="">Sin coach por ahora</option>
                {equipo.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              <small>Se crean sus 10 sesiones, una por módulo, con este coach.</small>
            </label>
          </>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" className="btn-gold" disabled={guardando || alumnos.length === 0}>
            {guardando ? "Inscribiendo…" : "Inscribir"}
          </button>
        </div>
      </form>
    </PanelLateral>
  );
}

// Ficha de un alumno en la certificación: avance, cambiar el coach y sus 10
// sesiones con módulo, coach, fecha y si está pagada.
export function PanelAlumno({ fila, equipo, onClose }) {
  const provider = useDataProvider();
  const { version, refrescar, avisar, abrirSesion } = useAcciones();
  const [ficha, setFicha] = useState(null);
  const [errorFicha, setErrorFicha] = useState("");
  const [coachId, setCoachId] = useState(fila.coach_id ?? "");
  const [errorCoach, setErrorCoach] = useState("");
  const candado = useCandado();

  useEffect(() => {
    let vigente = true;
    provider
      .obtenerInscripcion(fila.inscripcion_id)
      .then((r) => {
        if (!vigente) return;
        setFicha(r);
        setErrorFicha("");
      })
      .catch((err) => vigente && setErrorFicha(err.message || "No se pudo cargar la ficha."));
    return () => {
      vigente = false;
    };
  }, [provider, fila.inscripcion_id, version]);

  function guardarCoach(e) {
    e.preventDefault();
    return candado.ejecutar(async () => {
      if ((coachId || null) === (fila.coach_id ?? null)) return onClose();
      setErrorCoach("");
      try {
        await provider.cambiarCoach(fila.inscripcion_id, coachId || null);
        const coach = equipo.find((p) => p.id === coachId)?.nombre ?? "sin coach";
        refrescar();
        onClose();
        avisar(`${fila.alumno} ahora tiene de coach a ${coach}. Las sesiones ya hechas quedaron con el anterior.`);
      } catch (err) {
        setErrorCoach(err.message || "Ocurrió un error de conexión.");
      }
    });
  }

  const hechas = fila.sesiones_realizadas;
  return (
    <PanelLateral titulo={fila.alumno} subtitulo={`Coach: ${fila.coach ?? "sin asignar"}`} onClose={onClose} bloqueado={candado.ocupado}>
      <section className="panel-bloque" aria-label="Avance">
        <h3>Avance</h3>
        <BarraAvance hechas={hechas} total={fila.sesiones_totales} />
        {fila.en_condiciones && <span className="pill ok">Listo para certificar</span>}
        <button
          type="button"
          className="btn-ghost"
          disabled={hechas >= MODULOS}
          onClick={() => {
            onClose();
            abrirSesion({ inscripcionId: fila.inscripcion_id });
          }}
        >
          Marcar una sesión como hecha
        </button>
      </section>

      <form className="panel-bloque" onSubmit={guardarCoach} noValidate>
        <h3>Coach</h3>
        <AvisoError texto={errorCoach} />
        <p className="notice-banner" role="note">
          Las sesiones ya hechas quedan con el coach anterior; las pendientes pasan al nuevo.
        </p>
        <label className="field">
          <span>Coach de {fila.alumno}</span>
          <select value={coachId} onChange={(e) => setCoachId(e.target.value)} disabled={candado.ocupado}>
            <option value="">Sin coach</option>
            {equipo.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-gold" disabled={candado.ocupado}>
          {candado.ocupado ? "Guardando…" : "Guardar el coach"}
        </button>
      </form>

      <section className="panel-bloque" aria-label="Sus 10 sesiones">
        <h3>Sus {MODULOS} sesiones</h3>
        {errorFicha && !ficha ? (
          <AvisoError texto={errorFicha} />
        ) : !ficha ? (
          <EsqueletoLista items={4} />
        ) : (
          <ul className="panel-cuotas">
            {ficha.sesiones.map((s) => (
              <li key={s.id}>
                <span>
                  <b>Módulo {s.modulo}</b> · {s.coach ?? "sin coach"} · {s.realizada ? fechaCortaOGuion(s.fecha_realizada) : "falta hacerla"}
                </span>
                {s.pago_gasto_id ? <PillPagado /> : s.realizada ? <span className="lbl">Sin pagar</span> : <span className="celda-vacia">—</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </PanelLateral>
  );
}

// Alta (persona = null) o ficha de una persona del equipo: datos, lo cobrado y lo
// que se le debe, sus últimos pagos, y desactivarla o borrarla.
export function PanelPersona({ persona = null, onClose, onGuardada }) {
  const provider = useDataProvider();
  const { version, refrescar, avisar } = useAcciones();
  const editando = persona !== null;
  const [nombre, setNombre] = useState(persona?.nombre ?? "");
  const [contacto, setContacto] = useState(persona?.contacto ?? "");
  const [notas, setNotas] = useState(persona?.notas ?? "");
  const [error, setError] = useState("");
  const datos = useCandado();
  const estado = useCandado();
  const baja = useCandado();
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false);
  const [errorPie, setErrorPie] = useState("");
  const [ficha, setFicha] = useState(null);
  const [errorFicha, setErrorFicha] = useState("");

  useEffect(() => {
    if (!editando) return undefined;
    let vigente = true;
    provider
      .obtenerPersonaEquipo(persona.id)
      .then((r) => vigente && setFicha(r))
      .catch((err) => vigente && setErrorFicha(err.message || "No se pudo cargar la ficha."));
    return () => {
      vigente = false;
    };
  }, [provider, editando, persona?.id, version]);

  const ocupado = datos.ocupado || estado.ocupado || baja.ocupado;

  function guardar(e) {
    e.preventDefault();
    return datos.ejecutar(async () => {
      const { datos: cuerpo, error: invalido } = validarPersonaEquipo({ nombre, contacto, notas }, { creando: !editando });
      if (invalido) return setError(invalido);
      setError("");
      try {
        const guardada = editando ? await provider.actualizarPersonaEquipo(persona.id, cuerpo) : await provider.crearPersonaEquipo(cuerpo);
        onGuardada({ persona: guardada, editando });
      } catch (err) {
        setError(err.message || "Ocurrió un error de conexión.");
      }
    });
  }

  function alternar() {
    return estado.ejecutar(async () => {
      setErrorPie("");
      const nuevo = !persona.activo;
      try {
        await provider.actualizarPersonaEquipo(persona.id, { activo: nuevo });
        refrescar();
        onClose();
        avisar(
          nuevo ? `${persona.nombre} vuelve a estar activa.` : `${persona.nombre} quedó desactivada: ya no aparece para asignar.`,
          () => provider.actualizarPersonaEquipo(persona.id, { activo: !nuevo }).then(refrescar, (err) => avisar(err.message || "No se pudo deshacer."))
        );
      } catch (err) {
        setErrorPie(err.message || "Ocurrió un error de conexión.");
      }
    });
  }

  function borrar() {
    return baja.ejecutar(async () => {
      setErrorPie("");
      try {
        await provider.eliminarPersonaEquipo(persona.id);
        refrescar();
        onClose();
        avisar(`Se borró a ${persona.nombre}.`);
      } catch (err) {
        setErrorPie(err.message || "Ocurrió un error de conexión.");
        setConfirmandoBorrar(false);
      }
    });
  }

  const dioEncuentros = ficha?.encuentros.filter((e) => e.dictado).length ?? 0;
  const dioSesiones = ficha?.sesiones.filter((s) => s.realizada).length ?? 0;

  return (
    <PanelLateral
      titulo={editando ? persona.nombre : "Agregar al equipo"}
      subtitulo={editando ? rolDe({ es_profe: persona.es_profe, es_coach: persona.es_coach }) : "Profe, coach o las dos cosas"}
      onClose={onClose}
      bloqueado={ocupado}
    >
      {editando && (
        <section className="panel-bloque panel-resumen" aria-label="Resumen">
          {errorFicha && !ficha ? (
            <AvisoError texto={errorFicha} />
          ) : !ficha ? (
            <EsqueletoLista items={2} />
          ) : (
            <div className="panel-ancho">
              <div>
                <p className="lbl">Cobrado</p>
                <p className="value num">{formatoDolares(ficha.cobrado)}</p>
              </div>
              <div>
                <p className="lbl">Se le debe</p>
                <p className="value num">{ficha.pendiente.total === null ? "Falta tarifa" : formatoDolares(ficha.pendiente.total)}</p>
                <p className="lbl">
                  {ficha.pendiente.filas.length === 0
                    ? "Está al día"
                    : ficha.pendiente.filas.map((f) => `${f.cantidad} ${CONCEPTO[f.concepto].toLowerCase()}`).join(" y ")}
                </p>
              </div>
              <div>
                <p className="lbl">Dio</p>
                <p className="lbl">
                  {dioEncuentros} clases y {dioSesiones} sesiones
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      <form className="panel-bloque" onSubmit={guardar} noValidate>
        <h3>Datos</h3>
        <AvisoError texto={error} />
        <label className="field">
          <span>Nombre</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={LIMITES_CERT.nombrePersona} autoFocus={!editando} disabled={datos.ocupado} />
        </label>
        <label className="field">
          <span>Contacto, opcional</span>
          <input value={contacto} onChange={(e) => setContacto(e.target.value)} maxLength={LIMITES_CERT.contacto} placeholder="Ej: teléfono o mail" disabled={datos.ocupado} />
        </label>
        <label className="field">
          <span>Notas, opcional</span>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} maxLength={LIMITES_CERT.notas} disabled={datos.ocupado} />
        </label>
        <button type="submit" className="btn-gold" disabled={ocupado}>
          {datos.ocupado ? "Guardando…" : editando ? "Guardar los datos" : "Agregar"}
        </button>
      </form>

      {editando && (
        <section className="panel-bloque" aria-label="Últimos pagos">
          <h3>Últimos pagos</h3>
          {!ficha ? (
            <EsqueletoLista items={2} />
          ) : ficha.liquidaciones.length === 0 ? (
            <p className="lbl">Todavía no se le pagó nada.</p>
          ) : (
            <ul className="panel-cuotas">
              {ficha.liquidaciones.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <span>
                    {fechaCortaOGuion(p.fecha_pago)} · <span className="lbl">{p.descripcion}</span> · <span className="lbl">{ETIQUETA_METODO[p.metodo_pago] || "sin método"}</span>
                  </span>
                  <span className="num">{formatoDolares(p.monto)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {editando && ficha && (ficha.encuentros.length > 0 || ficha.sesiones.length > 0) && (
        <section className="panel-bloque" aria-label="Sus clases y sesiones">
          <h3>Sus clases y sesiones</h3>
          {ficha.encuentros.length > 0 && (
            <details>
              <summary>Clases ({ficha.encuentros.length})</summary>
              <ul className="panel-cuotas">
                {ficha.encuentros.map((e) => (
                  <li key={e.id}>
                    <span>
                      <Enlace href={`/certificacion/modulos/${e.modulo_id}`} className="link-action" onClick={onClose}>
                        Módulo {e.modulo}
                      </Enlace>{" "}
                      · {e.tipo === "practica_final" ? `práctica final ${e.numero}` : `clase ${e.numero}`} · {fechaCortaOGuion(e.fecha)}
                      {e.tarifa != null ? ` · tarifa especial ${formatoDolares(e.tarifa)}` : ""}
                    </span>
                    {e.pago_gasto_id ? <PillPagado /> : <span className="lbl">{e.dictado ? "Dada, sin pagar" : "Falta darla"}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {ficha.sesiones.length > 0 && (
            <details>
              <summary>Sesiones ({ficha.sesiones.length})</summary>
              <ul className="panel-cuotas">
                {ficha.sesiones.map((s) => (
                  <li key={s.id}>
                    <span>
                      <Enlace href={`/certificacion/modulos/${s.modulo_id}`} className="link-action" onClick={onClose}>
                        Módulo {s.modulo}
                      </Enlace>{" "}
                      · {s.alumno} · {s.realizada ? fechaCortaOGuion(s.fecha_realizada) : "falta hacerla"}
                    </span>
                    {s.pago_gasto_id ? <PillPagado /> : <span className="lbl">{s.realizada ? "Hecha, sin pagar" : "Falta hacerla"}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {editando && (
        <section className="panel-bloque panel-pie" aria-label="Otras acciones">
          <AvisoError texto={errorPie} />
          <button type="button" className="btn-ghost" onClick={alternar} disabled={ocupado}>
            {persona.activo ? "Desactivar" : "Volver a activar"}
          </button>
          {confirmandoBorrar ? (
            <div className="panel-confirmacion" role="alertdialog" aria-label="Confirmar el borrado">
              <p>¿Borrar a {persona.nombre}? Solo se puede si no tiene clases, sesiones, alumnos ni pagos.</p>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setConfirmandoBorrar(false)} disabled={baja.ocupado}>
                  No, dejarla
                </button>
                <button type="button" className="btn-gold" onClick={borrar} disabled={baja.ocupado}>
                  {baja.ocupado ? "Borrando…" : "Sí, borrar"}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn-ghost panel-baja" onClick={() => setConfirmandoBorrar(true)} disabled={ocupado}>
              Borrar
            </button>
          )}
        </section>
      )}
    </PanelLateral>
  );
}
