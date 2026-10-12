"use client";

import { entradaActiva, NAV_MENU } from "../lib/navegacion";
import { useNavegacion } from "../lib/NavContext";
import { useRecordatoriosContext } from "../lib/RecordatoriosContext";
import Enlace from "./Enlace";
import MenuUsuario from "./MenuUsuario";

// Barra lateral: cinco entradas (Inicio, Cobros, Gastos, Certificación y
// Recordatorios). Las pantallas de adentro se alcanzan desde cada entrada; la
// entrada madre queda marcada. Abajo, el usuario con Configuración y Cerrar
// sesión. En el celular no se ve: ahí manda la barra inferior (BarraInferior).
export default function Sidebar({ usuario, onSalir }) {
  const { ruta } = useNavegacion();
  const { urgentes } = useRecordatoriosContext();
  const contadores = { recordatorios: urgentes };

  return (
    <aside className="side" aria-label="Navegación" id="barra-lateral">
      <div className="side-cuerpo">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            C
          </span>
          <div>
            <p className="brand-title">Contabilidad</p>
            <p className="brand-sub">Coaching deportivo</p>
          </div>
        </div>

        <nav>
          {NAV_MENU.map((e) => {
            const activo = entradaActiva(e, ruta);
            const cuenta = e.contador ? contadores[e.contador] : 0;
            return (
              <Enlace key={e.id} href={e.href} className={`it${activo ? " on" : ""}`} aria-current={activo ? "page" : undefined}>
                <span>{e.etiqueta}</span>
                {cuenta > 0 && (
                  <span className="badge-nav" aria-label={`${cuenta} por hacer`}>
                    {cuenta}
                  </span>
                )}
              </Enlace>
            );
          })}
        </nav>
      </div>

      <MenuUsuario usuario={usuario} onSalir={onSalir} />
    </aside>
  );
}
