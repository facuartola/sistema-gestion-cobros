"use client";

import { tituloDe } from "../lib/navegacion";
import { useGastos } from "../lib/GastosContext";
import { useNavegacion } from "../lib/NavContext";
import BarraInferior from "./BarraInferior";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

// Estructura común de toda la app: barra lateral única, barra superior y el
// contenido. Lo usan la app con login (AuthGate) y /demo. En el celular la
// barra lateral se reemplaza por una barra de navegación fija abajo, y el menú
// del usuario (Configuración y Cerrar sesión) pasa a la barra superior.
export default function Shell({ usuario, onSalir, banner, children }) {
  const { ruta } = useNavegacion();
  const { nav } = useGastos();

  return (
    <div className="app">
      <Sidebar usuario={usuario} onSalir={onSalir} />
      <div className="main">
        {banner}
        <Topbar titulo={tituloDe(ruta, nav)} usuario={usuario} onSalir={onSalir} />
        <main className="content">{children}</main>
      </div>
      <BarraInferior />
    </div>
  );
}
