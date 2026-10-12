"use client";

import { useEffect, useState } from "react";
import { useAcciones } from "../../lib/AccionesContext";
import { useCertificacion } from "../../lib/CertificacionContext";
import { useDataProvider } from "../../lib/dataProvider";
import { deudaDe, rolDe } from "../../lib/certificacionPagina";
import { formatoDolares } from "../../lib/moneda";
import Avatar from "../Avatar";
import { EsqueletoLista } from "../Esqueleto";
import MenuMas, { EncabezadoImpreso, ITEM_IMPRIMIR } from "./MenuMas";
import { PanelPersona } from "./Paneles";

// Pestaña Equipo: las personas que cobran por clases y sesiones, con su rol
// (profe, coach o ambos), lo cobrado y lo que se les debe. Alta, edición y
// desactivación en un panel lateral (con historial no se borran: se desactivan).
export default function TabEquipo({ inicialId = null }) {
  const provider = useDataProvider();
  const { version, refrescar, avisar } = useAcciones();
  const { cert, resumen } = useCertificacion();
  const [equipo, setEquipo] = useState(null);
  const [error, setError] = useState("");
  const [abiertoId, setAbiertoId] = useState(inicialId);
  const [alta, setAlta] = useState(false);

  useEffect(() => {
    if (inicialId) setAbiertoId(inicialId);
  }, [inicialId]);

  useEffect(() => {
    let vigente = true;
    provider
      .listarEquipo({ resumen: true })
      .then((r) => {
        if (!vigente) return;
        setEquipo(r);
        setError("");
      })
      .catch((err) => vigente && setError(err.message || "No se pudo cargar el equipo."));
    return () => {
      vigente = false;
    };
  }, [provider, version]);

  const abierta = abiertoId && equipo ? equipo.find((p) => p.id === abiertoId) ?? null : null;
  const pendientes = resumen.pendientes ?? [];

  return (
    <>
      <div className="barra-tab">
        <p className="lbl">Las personas que cobran por clases y sesiones. Tocá a una para ver lo que se le pagó y lo que se le debe.</p>
        <div className="acciones">
          <button type="button" className="btn-gold" onClick={() => setAlta(true)}>
            Agregar persona
          </button>
          <MenuMas items={[ITEM_IMPRIMIR(!equipo || equipo.length === 0)]} />
        </div>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      <div className="print-area">
      <EncabezadoImpreso titulo="Equipo" certificacion={cert.nombre} />
      {!equipo && !error ? (
        <div className="card panel">
          <EsqueletoLista items={3} />
        </div>
      ) : equipo && equipo.length === 0 ? (
        <div className="card estado-vacio">
          <h3>Todavía no cargaste a nadie del equipo</h3>
          <p>Sumá a los profes y coaches: después los elegís en cada clase y como coach de cada alumno.</p>
          <div className="estado-vacio-acciones">
            <button type="button" className="btn-gold" onClick={() => setAlta(true)}>
              Agregar la primera persona
            </button>
          </div>
        </div>
      ) : (
        equipo && (
          <ul className="cert-lista card" aria-label="Equipo">
            {equipo.map((p) => {
              const deuda = deudaDe(p.id, pendientes);
              return (
                <li key={p.id} className={`cert-fila equipo${p.activo ? "" : " fila-inactiva"}`} onClick={() => setAbiertoId(p.id)}>
                  <div className="cert-nombre">
                    <Avatar nombre={p.nombre} />
                    <div className="cert-nombre-texto">
                      <button
                        type="button"
                        className="cobro-abrir"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAbiertoId(p.id);
                        }}
                        aria-label={`Ver la ficha de ${p.nombre}`}
                      >
                        {p.nombre}
                      </button>
                      <span className="row-sub">{p.contacto}</span>
                    </div>
                  </div>
                  <div className="cert-dato" data-etiqueta="Rol">
                    <span className="pill">{rolDe(p)}</span>
                  </div>
                  <div className="cert-dato num" data-etiqueta="Cobrado">
                    {formatoDolares(p.cobrado ?? 0)}
                  </div>
                  <div className="cert-dato" data-etiqueta="Se le debe">
                    {deuda.faltaTarifa ? (
                      <span className="texto-alerta">Falta la tarifa</span>
                    ) : deuda.total > 0 ? (
                      <b className="num">{formatoDolares(deuda.total)}</b>
                    ) : (
                      <span className="lbl">Al día</span>
                    )}
                  </div>
                  <div className="cert-marca">{!p.activo && <span className="pill">Desactivada</span>}</div>
                </li>
              );
            })}
          </ul>
        )
      )}
      </div>

      {abierta && (
        <PanelPersona
          key={abierta.id}
          persona={abierta}
          onClose={() => setAbiertoId(null)}
          onGuardada={({ persona }) => {
            setAbiertoId(null);
            refrescar();
            avisar(`Se guardaron los cambios de ${persona.nombre}.`);
          }}
        />
      )}
      {alta && (
        <PanelPersona
          onClose={() => setAlta(false)}
          onGuardada={({ persona }) => {
            setAlta(false);
            refrescar();
            avisar(`Se agregó a ${persona.nombre} al equipo.`);
          }}
        />
      )}
    </>
  );
}
