"use client";

import { useState } from "react";
import { DataProviderProvider } from "../../lib/dataProvider";
import { crearProveedorDemo } from "../../lib/dataProviderDemo";
import { NavProvider } from "../../lib/NavContext";
import { RecordatoriosProvider } from "../../lib/RecordatoriosContext";
import AccionesProvider from "../../components/AccionesProvider";
import AyudaPagina from "../../components/AyudaPagina";
import ConfiguracionPagina from "../../components/ConfiguracionPagina";
import GastosRutas from "../../components/GastosRutas";
import CertificacionPagina from "../../components/certificacion/CertificacionPagina";
import CobrosPagina from "../../components/CobrosPagina";
import Shell from "../../components/Shell";
import Home from "../page";
import RecordatoriosPage from "../recordatorios/page";

// Todo lo que se ve acá son los mismos componentes reales (Shell, Home,
// PersonasPage, RecordatoriosPage) que usa la app con login: lo único que
// cambia es la capa de datos. En vez de DataProviderProvider apuntando a
// dataProviderReal (el default del Context), acá se pasa dataProviderDemo, que
// vive en memoria y nunca pega a /api ni a Supabase. Cambiar de página acá es
// un useState (NavProvider con `interceptar`), no una navegación de Next, para
// no perder esos datos en memoria con una recarga.
function ShellDemo() {
  const [ruta, setRuta] = useState("/");
  // Las pantallas viejas de Cobros ahora son una sola, con pestañas.
  const [tipoPedido, setTipoPedido] = useState(null);
  const ir = (href) => {
    const [camino, consulta = ""] = href.split("?");
    const viejo = camino === "/jugadores" ? "jugador" : camino === "/alumnos" ? "alumno" : null;
    setTipoPedido(viejo || new URLSearchParams(consulta).get("tipo"));
    setRuta(viejo ? "/cobros" : camino);
  };

  const banner = (
    <div className="demo-banner">
      <span>
        <b>Modo demo:</b> los datos son de ejemplo.
      </span>
      <button type="button" className="btn-ghost btn-sm" onClick={() => window.location.reload()}>
        Reiniciar demo
      </button>
    </div>
  );

  return (
    <NavProvider ruta={ruta} ir={ir} interceptar>
      {/* persistirMes=false: la demo no escribe nada en el navegador. */}
      <AccionesProvider usuario={null} persistirMes={false}>
        <Shell usuario={{ nombre: "Demo", detalle: "Datos de ejemplo" }} banner={banner}>
          {/* key: cada cambio de página vuelve a montar el contenedor y repite
              la misma entrada que las páginas reales. */}
          <div className="enter" key={ruta}>
            {ruta === "/cobros" ? (
              <CobrosPagina tipoPedido={tipoPedido} />
            ) : ruta === "/recordatorios" ? (
              <RecordatoriosPage />
            ) : ruta === "/ayuda" ? (
              <AyudaPagina />
            ) : ruta === "/configuracion" ? (
              <ConfiguracionPagina />
            ) : ruta === "/gastos" || ruta.startsWith("/gastos/") ? (
              <GastosRutas />
            ) : ruta === "/certificacion" || ruta.startsWith("/certificacion/") ? (
              <CertificacionPagina />
            ) : (
              <Home />
            )}
          </div>
        </Shell>
      </AccionesProvider>
    </NavProvider>
  );
}

export default function DemoPage() {
  // useState (no useMemo) a propósito: garantiza una única instancia por
  // montaje de página, y como esta página no navega con next/link, un F5
  // real vuelve a montar todo desde cero: eso es "reiniciar la demo" (el
  // botón de arriba solo fuerza ese mismo reload).
  const [proveedorDemo] = useState(() => crearProveedorDemo());

  return (
    <DataProviderProvider value={proveedorDemo}>
      <RecordatoriosProvider>
        <ShellDemo />
      </RecordatoriosProvider>
    </DataProviderProvider>
  );
}
