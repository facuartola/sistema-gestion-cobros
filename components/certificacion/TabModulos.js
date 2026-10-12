"use client";

import { useState } from "react";
import { useAcciones } from "../../lib/AccionesContext";
import { useCertificacion } from "../../lib/CertificacionContext";
import { useDataProvider } from "../../lib/dataProvider";
import { resumenLiquidacion } from "../../lib/certificacion";
import { textoAtrasados, textoModuloListo } from "../../lib/certificacionPagina";
import { diaArgentinaDe, fechaDMA } from "../../lib/fechas";
import Enlace from "../Enlace";
import MenuMas, { EncabezadoImpreso, ITEM_IMPRIMIR } from "./MenuMas";
import PagarEquipoModal, { PagarModuloModal } from "./PagarEquipoModal";
import { PillModulo } from "./comun";

// Pestaña Módulos: el aviso de lo que hay que pagar al terminar un módulo, el de
// los pagos atrasados y la lista de los 10 módulos con su avance.
export default function TabModulos() {
  const provider = useDataProvider();
  const { refrescar } = useAcciones();
  const { cert, resumen } = useCertificacion();
  const [pagando, setPagando] = useState(null); // { tipo: "modulo", modulo } | { tipo: "atrasado" }

  const listos = resumen.listos ?? [];
  const atrasados = resumen.tardios ?? null;
  const pendientes = resumen.pendientes ?? [];
  // "Pagar lo atrasado" paga todo lo hecho y no pagado; si hay hechos en módulos
  // todavía abiertos, también entran: la ventana lo aclara.
  const total = resumenLiquidacion(pendientes);
  const incluyeAbiertos = atrasados && !total.faltaTarifa && !atrasados.faltaTarifa && total.total !== atrasados.total;

  return (
    <>
      <div className="barra-tab">
        <p className="lbl">Cada módulo tiene 4 clases y 10 sesiones. Tocá un módulo para ver su planilla.</p>
        <div className="acciones">
          <MenuMas items={[ITEM_IMPRIMIR()]} />
        </div>
      </div>

      {listos.map((m) => (
        <div key={m.modulo_id} className="aviso-destacado" role="status">
          <p>{textoModuloListo(m)}</p>
          <button type="button" className="btn-gold" onClick={() => setPagando({ tipo: "modulo", modulo: m })} disabled={m.faltaTarifa}>
            Pagar al equipo
          </button>
        </div>
      ))}
      {atrasados && (
        <div className="aviso-destacado atrasado" role="status">
          <p>{textoAtrasados(atrasados)}</p>
          <button type="button" className="btn-gold" onClick={() => setPagando({ tipo: "atrasado" })} disabled={atrasados.faltaTarifa}>
            Pagar lo atrasado
          </button>
        </div>
      )}

      <div className="print-area">
      <EncabezadoImpreso titulo="Resumen de módulos" certificacion={cert.nombre} />
      <ul className="modulos-grid">
        {resumen.modulos.map((m) => (
          <li key={m.modulo_id}>
            <Enlace href={`/certificacion/modulos/${m.modulo_id}`} className="card modulo-tarjeta">
              <div className="modulo-cabecera">
                <span className="modulo-numero">Módulo {m.numero}</span>
                <PillModulo fila={m} />
              </div>
              <span className="detalle">
                Clases dadas: <b className="num">{m.encuentros_dictados}</b> de {m.encuentros_total}
              </span>
              <span className="detalle">
                Sesiones hechas: <b className="num">{m.sesiones_realizadas}</b> de {m.sesiones_total}
              </span>
              {m.cerrado_en && <span className="lbl">Pagado el {fechaDMA(diaArgentinaDe(m.cerrado_en))}</span>}
            </Enlace>
          </li>
        ))}
      </ul>
      </div>

      {pagando?.tipo === "modulo" && (
        <PagarModuloModal modulo={pagando.modulo} onTerminado={() => refrescar()} onClose={() => setPagando(null)} />
      )}
      {pagando?.tipo === "atrasado" && (
        <PagarEquipoModal
          titulo="Pagar lo atrasado"
          explicacion={`Paga todo lo hecho y no pagado de ${cert.nombre} sin cerrar ningún módulo: sirve para clases o sesiones que se completaron tarde.${
            incluyeAbiertos ? " Incluye también lo ya hecho en módulos que todavía no terminaron." : ""
          }`}
          filas={pendientes}
          equipo={resumen.equipo}
          confirmar={(datos) => provider.liquidarPendientes(cert.id, datos)}
          onTerminado={() => refrescar()}
          onClose={() => setPagando(null)}
        />
      )}
    </>
  );
}
