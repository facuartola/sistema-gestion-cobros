"use client";

import { entradaActiva, NAV_MENU } from "../lib/navegacion";
import { useNavegacion } from "../lib/NavContext";
import { useRecordatoriosContext } from "../lib/RecordatoriosContext";
import Enlace from "./Enlace";
import { IconoCampana, IconoCertificacion, IconoCobros, IconoGastos, IconoInicio } from "./Iconos";

const ICONOS = { inicio: IconoInicio, cobros: IconoCobros, gastos: IconoGastos, certificacion: IconoCertificacion, recordatorios: IconoCampana };

// Barra de navegación fija abajo en pantallas angostas: las mismas cinco
// entradas del menú lateral, con el contador en Recordatorios. En pantallas
// anchas no se ve (la barra lateral hace de menú).
export default function BarraInferior() {
  const { ruta } = useNavegacion();
  const { urgentes } = useRecordatoriosContext();
  const contadores = { recordatorios: urgentes };

  return (
    <nav className="barra-inferior" aria-label="Navegación principal">
      {NAV_MENU.map((e) => {
        const activo = entradaActiva(e, ruta);
        const cuenta = e.contador ? contadores[e.contador] : 0;
        const Icono = ICONOS[e.id];
        return (
          <Enlace key={e.id} href={e.href} className={`bi-it${activo ? " on" : ""}`} aria-current={activo ? "page" : undefined}>
            <span className="bi-icono">
              <Icono size={22} />
              {cuenta > 0 && (
                <span className="badge-nav bi-contador" aria-label={`${cuenta} por hacer`}>
                  {cuenta}
                </span>
              )}
            </span>
            <span className="bi-texto">{e.etiqueta}</span>
          </Enlace>
        );
      })}
    </nav>
  );
}
