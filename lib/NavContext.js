"use client";

import { createContext, useContext } from "react";

// Cómo se navega depende de dónde se esté: en la app real, con el router de
// Next; en /demo, cambiando una pestaña en memoria (una navegación de verdad
// perdería los datos de ejemplo). Todo lo que navega (barra lateral, buscador,
// atajos, enlaces de Inicio) lo hace a través de este contexto.
//   ruta: ruta actual ("/", "/jugadores", ...).
//   ir(href): navega. El href puede traer query (?persona_tipo=...).
//   interceptar: true en /demo; los <a> frenan la navegación del navegador.
const NavContext = createContext({ ruta: "/", ir: () => {}, interceptar: false });

export function NavProvider({ ruta, ir, interceptar = false, children }) {
  return <NavContext.Provider value={{ ruta, ir, interceptar }}>{children}</NavContext.Provider>;
}

export function useNavegacion() {
  return useContext(NavContext);
}
