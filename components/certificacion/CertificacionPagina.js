"use client";

import { useEffect, useState } from "react";
import { useAcciones } from "../../lib/AccionesContext";
import { useCertificacion } from "../../lib/CertificacionContext";
import { useDataProvider } from "../../lib/dataProvider";
import { PESTANAS_CERT, estadoEnTira, leerRutaCert, pestanaCertValida } from "../../lib/certificacionPagina";
import { aNombreDeArchivo, descargarCSV } from "../../lib/csv";
import { hoyArgentinaISO } from "../../lib/fechas";
import { useNavegacion } from "../../lib/NavContext";
import { useMenu } from "../../lib/useMenu";
import { EsqueletoStats } from "../Esqueleto";
import Enlace from "../Enlace";
import ModuloPlanilla from "./ModuloPlanilla";
import TabAlumnos from "./TabAlumnos";
import TabEquipo from "./TabEquipo";
import TabModulos from "./TabModulos";
import { CertificacionModal } from "./Ventanas";
import { TEXTO_ESTADO } from "../../lib/certificacionPagina";
import { ETIQUETA_METODO } from "../../lib/metodoPago";
import { CLAVES_NAVEGADOR, enDemo } from "../../lib/navegador";

// Selector de certificación, solo si hay más de una. La elegida se recuerda.
export function SelectorCertificacion() {
  const { certificaciones, cert, elegir } = useCertificacion();
  if (certificaciones.length < 2) return null;
  return (
    <label className="selector-cert">
      <span className="lbl">Certificación</span>
      <select value={cert?.id ?? ""} onChange={(e) => elegir(e.target.value)} aria-label="Elegir certificación">
        {certificaciones.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
            {c.estado === "finalizada" ? " (finalizada)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

// Los 10 módulos de un vistazo, con su estado. Tocar uno abre su planilla.
function TiraModulos({ modulos, activoId }) {
  return (
    <nav className="tira-modulos" aria-label="Los 10 módulos">
      <ol>
        {modulos.map((m) => {
          const estado = estadoEnTira(m);
          return (
            <li key={m.modulo_id}>
              <Enlace
                href={`/certificacion/modulos/${m.modulo_id}`}
                className={`tira-mod ${estado}${activoId === m.modulo_id ? " activo" : ""}`}
                aria-label={`Módulo ${m.numero}: ${TEXTO_ESTADO[estado].toLowerCase()}`}
                aria-current={activoId === m.modulo_id ? "page" : undefined}
              >
                <span className="tira-numero">{m.numero}</span>
                <span className="tira-estado">{TEXTO_ESTADO[estado]}</span>
              </Enlace>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Toda la certificación en una sola pantalla: tira de los 10 módulos y las
// pestañas Módulos, Alumnos y Equipo. Las direcciones viejas (/modulos, /alumnos,
// /equipo y sus fichas) siguen respondiendo y caen en la pestaña que corresponde:
//   /certificacion                    la pestaña que se usó la última vez
//   /certificacion/modulos[/<id>]     Módulos / la planilla de ese módulo
//   /certificacion/alumnos[/<id>]     Alumnos / con la ficha de esa inscripción
//   /certificacion/equipo[/<id>]      Equipo / con la ficha de esa persona
export default function CertificacionPagina() {
  const provider = useDataProvider();
  const { ruta, ir } = useNavegacion();
  const { refrescar, avisar } = useAcciones();
  const { cert, resumen, cargando, error, elegir, recargar } = useCertificacion();
  const pedido = leerRutaCert(ruta);
  const [pestana, setPestana] = useState(pedido.pestana ?? "modulos");
  const [modal, setModal] = useState(null); // "nueva" | "editar"
  const [exportando, setExportando] = useState(false);
  const [errorLocal, setErrorLocal] = useState("");
  const { abierto, setAbierto, cerrar, contenedor, onKeyDownMenu } = useMenu('[role="menuitem"]');

  // Sin pestaña en la dirección, se abre la última que se usó (se lee después
  // de montar, para que el primer dibujo coincida con el del servidor).
  useEffect(() => {
    if (pedido.pestana || enDemo()) return;
    try {
      const guardada = pestanaCertValida(localStorage.getItem(CLAVES_NAVEGADOR.pestanaCertificacion));
      if (guardada) setPestana(guardada);
    } catch {
      // Sin localStorage, abre Módulos.
    }
    // Solo al montar: la dirección ya decidió si hay pestaña pedida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si la dirección cambia estando acá (un módulo de la tira, un enlace a una
  // persona), manda la dirección.
  useEffect(() => {
    if (pedido.pestana) setPestana(pedido.pestana);
  }, [ruta]); // eslint-disable-line react-hooks/exhaustive-deps

  function elegirPestana(nueva) {
    setPestana(nueva);
    try {
      if (!enDemo()) localStorage.setItem(CLAVES_NAVEGADOR.pestanaCertificacion, nueva);
    } catch {
      // Sin localStorage, la pestaña simplemente no se recuerda.
    }
    // Si había una planilla abierta, se sale de ella.
    if (pedido.pestana === "modulos" && pedido.id) ir(`/certificacion/${nueva}`);
  }

  function alGuardar({ cert: guardada, editando }) {
    setModal(null);
    if (!editando) elegir(guardada.id);
    refrescar();
    avisar(editando ? "Se guardaron los cambios de la certificación." : `Se creó “${guardada.nombre}” con sus 10 módulos.`);
  }

  async function exportarPagos() {
    setExportando(true);
    setErrorLocal("");
    try {
      const pagos = await provider.listarLiquidaciones(cert.id);
      descargarCSV(`pagos-al-equipo-${aNombreDeArchivo(cert.nombre)}-${hoyArgentinaISO()}.csv`, pagos, [
        { label: "Fecha de pago", value: (p) => p.fecha_pago },
        { label: "Persona", value: (p) => p.persona },
        { label: "Concepto", value: (p) => p.categoria },
        { label: "Módulo", value: (p) => (p.modulo == null ? "Pagos atrasados" : p.modulo) },
        { label: "Detalle", value: (p) => p.descripcion },
        { label: "Método de pago", value: (p) => ETIQUETA_METODO[p.metodo_pago] || "" },
        { label: "Monto (US$)", value: (p) => p.monto },
      ]);
      if (pagos.length === 0) avisar("Todavía no se le pagó nada al equipo: el archivo salió vacío.");
    } catch (err) {
      setErrorLocal(err.message || "No se pudo exportar.");
    } finally {
      setExportando(false);
    }
  }

  const ventana = modal ? (
    <CertificacionModal cert={modal === "editar" ? cert : null} onClose={() => setModal(null)} onGuardada={alGuardar} />
  ) : null;

  if (cargando) return <EsqueletoStats />;

  if (!cert) {
    return (
      <>
        <div className="page-header">
          <p>Todo lo de la certificación: los módulos, el equipo y los alumnos.</p>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            {error}{" "}
            <button type="button" className="link-action" onClick={recargar}>
              Reintentar
            </button>
          </div>
        )}
        {!error && (
          <div className="card estado-vacio">
            <h3>Todavía no hay ninguna certificación</h3>
            <p>
              Creala con su nombre, la fecha de inicio y las tarifas para el equipo. Se arman solos los 10 módulos con sus 4 clases, y
              después inscribís a los alumnos con su coach.
            </p>
            <div className="estado-vacio-acciones">
              <button type="button" className="btn-gold" onClick={() => setModal("nueva")}>
                Crear certificación
              </button>
            </div>
          </div>
        )}
        {ventana}
      </>
    );
  }

  const faltaTarifa = cert.tarifa_sesion == null || cert.tarifa_encuentro == null;
  const planilla = pestana === "modulos" && pedido.pestana === "modulos" ? pedido.id : null;
  const activoId = planilla;

  return (
    <>
      <div className="page-header">
        <div>
          <p>
            {cert.nombre}: qué módulo toca, a quién hay que pagarle y cómo avanzan los alumnos.
          </p>
        </div>
        <div className="acciones">
          <SelectorCertificacion />
          <div className="menu-wrap" ref={contenedor}>
            <button type="button" className="btn-ghost" aria-haspopup="menu" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
              Configurar
            </button>
            <div className={`menu glass${abierto ? " open" : ""}`} role="menu" aria-label="Configurar" onKeyDown={onKeyDownMenu}>
              <button
                type="button"
                role="menuitem"
                className="mi"
                tabIndex={abierto ? 0 : -1}
                onClick={() => {
                  cerrar();
                  setModal("editar");
                }}
              >
                Tarifas y datos de la certificación
              </button>
              <button
                type="button"
                role="menuitem"
                className="mi"
                tabIndex={abierto ? 0 : -1}
                onClick={() => {
                  cerrar();
                  setModal("nueva");
                }}
              >
                Nueva certificación
              </button>
              <button
                type="button"
                role="menuitem"
                className="mi"
                tabIndex={abierto ? 0 : -1}
                disabled={exportando}
                onClick={() => {
                  cerrar();
                  exportarPagos();
                }}
              >
                {exportando ? "Exportando…" : "Exportar los pagos al equipo a Excel"}
                <small>Se abre en Excel con columnas</small>
              </button>
            </div>
          </div>
        </div>
      </div>

      {(error || errorLocal) && (
        <div className="error-banner" role="alert">
          {error || errorLocal}
        </div>
      )}
      {faltaTarifa && (
        <p className="notice-banner" role="status">
          Faltan tarifas: sin la de sesión y la de clase no se puede pagar al equipo.{" "}
          <button type="button" className="link-action" onClick={() => setModal("editar")}>
            Definirlas ahora
          </button>
        </p>
      )}

      <TiraModulos modulos={resumen.modulos} activoId={activoId} />

      <div className="pestanas" role="tablist" aria-label="Certificación">
        {PESTANAS_CERT.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            className={`pestana${pestana === p.id ? " on" : ""}`}
            onClick={() => elegirPestana(p.id)}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {pestana === "modulos" &&
        (planilla ? (
          <ModuloPlanilla key={planilla} moduloId={planilla} onConfigurar={() => setModal("editar")} />
        ) : (
          <TabModulos onConfigurar={() => setModal("editar")} />
        ))}
      {pestana === "alumnos" && <TabAlumnos inicialId={pedido.pestana === "alumnos" ? pedido.id : null} />}
      {pestana === "equipo" && <TabEquipo inicialId={pedido.pestana === "equipo" ? pedido.id : null} />}

      {ventana}
    </>
  );
}
