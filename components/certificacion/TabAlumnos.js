"use client";

import { useEffect, useState } from "react";
import { useAcciones } from "../../lib/AccionesContext";
import { useCertificacion } from "../../lib/CertificacionContext";
import { aNombreDeArchivo, descargarCSV } from "../../lib/csv";
import { hoyArgentinaISO } from "../../lib/fechas";
import { useMenu } from "../../lib/useMenu";
import Avatar from "../Avatar";
import { BarraAvance } from "./comun";
import { EncabezadoImpreso } from "./MenuMas";
import { PanelAlumno, PanelInscribir } from "./Paneles";

// Pestaña Alumnos: el avance de cada alumno inscripto ("X de 10 sesiones"), su
// coach actual y la marca "Listo para certificar". Tocar una fila abre su panel
// (ficha con las 10 sesiones y cambio de coach); desde acá también se inscribe.
export default function TabAlumnos({ inicialId = null }) {
  const { refrescar, avisar, abrirSesion } = useAcciones();
  const { cert, resumen } = useCertificacion();
  const [abiertoId, setAbiertoId] = useState(inicialId);
  const [inscribiendo, setInscribiendo] = useState(false);
  const { abierto, setAbierto, cerrar, contenedor, onKeyDownMenu } = useMenu('[role="menuitem"]');

  // Llegar por una dirección vieja (/alumnos/<id>) abre su panel.
  useEffect(() => {
    if (inicialId) setAbiertoId(inicialId);
  }, [inicialId]);

  const { avance, equipo, alumnos } = resumen;
  const activos = equipo.filter((p) => p.activo);
  const inscriptos = new Set(avance.map((a) => a.alumno_id));
  const disponibles = alumnos.filter((a) => !inscriptos.has(a.id));
  const abierta = abiertoId ? avance.find((a) => a.inscripcion_id === abiertoId) ?? null : null;

  function exportar() {
    descargarCSV(`avance-${aNombreDeArchivo(cert.nombre)}-${hoyArgentinaISO()}.csv`, avance, [
      { label: "Alumno", value: (a) => a.alumno },
      { label: "Coach actual", value: (a) => a.coach ?? "" },
      { label: "Sesiones hechas", value: (a) => a.sesiones_realizadas },
      { label: "Sesiones totales", value: (a) => a.sesiones_totales },
      { label: "Listo para certificar", value: (a) => (a.en_condiciones ? "Sí" : "No") },
    ]);
  }

  return (
    <>
      <div className="barra-tab">
        <p className="lbl">Las 10 sesiones son requisito para certificar. Tocá a un alumno para ver sus sesiones o cambiarle el coach.</p>
        <div className="acciones">
          <button type="button" className="btn-gold" onClick={() => setInscribiendo(true)}>
            Inscribir alumno
          </button>
          <button type="button" className="btn-ghost" onClick={() => abrirSesion()} disabled={avance.length === 0}>
            Marcar una sesión
          </button>
          <div className="menu-wrap" ref={contenedor}>
            <button
              type="button"
              className="btn-ghost"
              aria-haspopup="menu"
              aria-expanded={abierto}
              aria-label="Más acciones"
              onClick={() => setAbierto((a) => !a)}
            >
              ⋯
            </button>
            <div className={`menu glass${abierto ? " open" : ""}`} role="menu" aria-label="Más acciones" onKeyDown={onKeyDownMenu}>
              <button
                type="button"
                role="menuitem"
                className="mi"
                tabIndex={abierto ? 0 : -1}
                disabled={avance.length === 0}
                onClick={() => {
                  cerrar();
                  exportar();
                }}
              >
                Exportar el avance a Excel
                <small>Se abre en Excel con columnas</small>
              </button>
              <button
                type="button"
                role="menuitem"
                className="mi"
                tabIndex={abierto ? 0 : -1}
                disabled={avance.length === 0}
                onClick={() => {
                  cerrar();
                  window.print();
                }}
              >
                Imprimir
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="print-area">
      <EncabezadoImpreso titulo="Avance de los alumnos" certificacion={cert.nombre} />
      {avance.length === 0 ? (
        <div className="card estado-vacio">
          <h3>Todavía no hay alumnos inscriptos</h3>
          <p>Inscribí a cada alumno con su coach: se le crean las 10 sesiones, una por módulo.</p>
          <div className="estado-vacio-acciones">
            <button type="button" className="btn-gold" onClick={() => setInscribiendo(true)}>
              Inscribir el primero
            </button>
          </div>
        </div>
      ) : (
        <ul className="cert-lista card" aria-label="Alumnos inscriptos">
          {avance.map((a) => (
            <li key={a.inscripcion_id} className="cert-fila" onClick={() => setAbiertoId(a.inscripcion_id)}>
              <div className="cert-nombre">
                <Avatar nombre={a.alumno} />
                <div className="cert-nombre-texto">
                  <button
                    type="button"
                    className="cobro-abrir"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAbiertoId(a.inscripcion_id);
                    }}
                    aria-label={`Ver la ficha de ${a.alumno}`}
                  >
                    {a.alumno}
                  </button>
                  <span className="row-sub">Coach: {a.coach ?? "sin asignar"}</span>
                </div>
              </div>
              <BarraAvance hechas={a.sesiones_realizadas} total={a.sesiones_totales} />
              <div className="cert-marca">{a.en_condiciones && <span className="pill ok">Listo para certificar</span>}</div>
            </li>
          ))}
        </ul>
      )}
      </div>

      {abierta && <PanelAlumno key={abierta.inscripcion_id} fila={abierta} equipo={activos} onClose={() => setAbiertoId(null)} />}
      {inscribiendo && (
        <PanelInscribir
          cert={cert}
          alumnos={disponibles}
          equipo={activos}
          onClose={() => setInscribiendo(false)}
          onInscripto={({ alumno }) => {
            setInscribiendo(false);
            refrescar();
            avisar(`Se inscribió a ${alumno}: ya tiene sus 10 sesiones.`);
          }}
        />
      )}
    </>
  );
}
