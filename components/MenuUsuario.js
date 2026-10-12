"use client";

import { useMenu } from "../lib/useMenu";
import Avatar from "./Avatar";
import Enlace from "./Enlace";
import { IconoChevron } from "./Iconos";
import { RelojesDelMenu } from "./WorldClock";

// El usuario con su menú (Configuración, Ayuda y Cerrar sesión). En la barra lateral
// se ve con nombre y detalle y el menú se abre hacia arriba; en pantallas
// angostas (`variante="barra"`) es solo el avatar en la barra superior y el
// menú baja.
export default function MenuUsuario({ usuario, onSalir, variante = "lateral" }) {
  const { abierto, setAbierto, cerrar, contenedor, onKeyDownMenu } = useMenu('[role="menuitem"]');
  const enBarra = variante === "barra";
  const nombre = usuario?.nombre || "Mi cuenta";

  return (
    <div className={enBarra ? "top-usuario menu-wrap" : "user menu-wrap"} ref={contenedor}>
      <button
        type="button"
        className="user-boton"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={enBarra ? `Mi cuenta: ${nombre}` : undefined}
        onClick={() => setAbierto((a) => !a)}
      >
        <Avatar nombre={nombre} color="#2A3B5C">
          {nombre.slice(0, 1).toUpperCase()}
        </Avatar>
        {!enBarra && (
          <>
            <span className="user-datos">
              <span>{nombre}</span>
              <span className="lbl user-detalle">{usuario?.detalle}</span>
            </span>
            <span className="chev" aria-hidden="true">
              <IconoChevron size={12} />
            </span>
          </>
        )}
      </button>
      <div className={`menu ${enBarra ? "" : "menu-arriba "}glass${abierto ? " open" : ""}`} role="menu" aria-label="Mi cuenta" onKeyDown={onKeyDownMenu}>
        {enBarra && <RelojesDelMenu />}
        <Enlace href="/configuracion" role="menuitem" className="mi" tabIndex={abierto ? 0 : -1} onClick={() => cerrar()}>
          Configuración
        </Enlace>
        <Enlace href="/ayuda" role="menuitem" className="mi" tabIndex={abierto ? 0 : -1} onClick={() => cerrar()}>
          Ayuda: ¿cómo hago…?
        </Enlace>
        {onSalir && (
          <button type="button" role="menuitem" className="mi" tabIndex={abierto ? 0 : -1} onClick={onSalir}>
            Cerrar sesión
          </button>
        )}
      </div>
    </div>
  );
}
