"use client";

import { useAcciones } from "../lib/AccionesContext";
import { useRegistrarClase } from "../lib/useRegistrarClase";
import { useMenu } from "../lib/useMenu";
import { IconoBuscar } from "./Iconos";
import Enlace from "./Enlace";
import MenuUsuario from "./MenuUsuario";
import WorldClock from "./WorldClock";

// Barra superior con vidrio: título de la página, buscador, relojes y el menú
// "+ Nuevo". En el celular esconde los relojes y suma el menú del usuario
// (Configuración y Cerrar sesión), porque ahí no hay barra lateral.
export default function Topbar({ titulo, usuario, onSalir }) {
  const { abrirPaleta, abrirCobro, abrirPago, abrirCliente, abrirRecordatorio } = useAcciones();
  const registrarClase = useRegistrarClase();
  const { abierto, setAbierto, cerrar, contenedor, onKeyDownMenu } = useMenu('[role="menuitem"]');
  const opciones = [
    // Los atajos de teclado (C, G, S, N, R y Ctrl+K) siguen funcionando, pero no se muestran.
    { etiqueta: "Cobré a alguien", accion: () => abrirCobro() },
    { etiqueta: "Pagué un gasto", accion: () => abrirPago() },
    { etiqueta: "Registré una clase o sesión", accion: registrarClase },
    { etiqueta: "Nuevo cliente", accion: abrirCliente },
    { etiqueta: "Nuevo recordatorio", accion: abrirRecordatorio },
  ];

  return (
    <header className="top">
      <h1 className="title">{titulo}</h1>
      <button
        type="button"
        className="search"
        onClick={abrirPaleta}
        aria-label="Buscar persona, tipo de gasto o sección"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <IconoBuscar className="search-icono" size={18} />
        <span className="search-texto">Buscar persona o tipo de gasto</span>
      </button>
      <div className="top-espacio" />
      <WorldClock />
      <Enlace href="/ayuda" className="btn-ghost top-ayuda" aria-label="Ayuda: ¿cómo hago…?" title="Ayuda: ¿cómo hago…?">
        ?
      </Enlace>
      <div className="menu-wrap" ref={contenedor}>
        <button
          type="button"
          className="btn-gold"
          aria-haspopup="menu"
          aria-expanded={abierto}
          onClick={() => setAbierto((a) => !a)}
        >
          + Nuevo
        </button>
        <div className={`menu glass${abierto ? " open" : ""}`} role="menu" aria-label="Crear" onKeyDown={onKeyDownMenu}>
          {opciones.map((o) => (
            <button
              key={o.etiqueta}
              type="button"
              role="menuitem"
              className="mi"
              tabIndex={abierto ? 0 : -1}
              onClick={() => {
                cerrar();
                o.accion();
              }}
            >
              {o.etiqueta}
            </button>
          ))}
        </div>
      </div>
      <div className="top-solo-celular">
        <MenuUsuario usuario={usuario} onSalir={onSalir} variante="barra" />
      </div>
    </header>
  );
}
