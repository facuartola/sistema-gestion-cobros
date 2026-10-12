"use client";

import { useEffect, useState } from "react";
import { horasMundiales } from "../lib/horasMundiales";
import { useMenu } from "../lib/useMenu";

// Se actualiza cada minuto: el formato solo muestra HH:mm.
const INTERVALO_MS = 60 * 1000;

// Las horas de Argentina, Miami, Paraguay y México, con zonas horarias reales.
// null hasta montar en el cliente: evita el error de hidratación de Next.
export function useHoras() {
  const [horas, setHoras] = useState(null);
  useEffect(() => {
    function actualizar() {
      setHoras(horasMundiales(new Date()));
    }
    actualizar();
    const id = setInterval(actualizar, INTERVALO_MS);
    return () => clearInterval(id);
  }, []);
  return horas;
}

function textoDia(h) {
  return h.diferenciaDias != null ? ` ${h.diferenciaDias > 0 ? `+${h.diferenciaDias}` : h.diferenciaDias} día` : "";
}

// Barra superior. Según el ancho se ve una de dos formas (lo decide el CSS):
//  - 1280 px o más: las cuatro ciudades con su hora, en una línea.
//  - menos: un reloj compacto con la hora de Argentina; al tocarlo se ven las otras tres.
// En el celular los relojes están en el menú del usuario (RelojesDelMenu).
export default function WorldClock() {
  const horas = useHoras();
  const { abierto, setAbierto, contenedor } = useMenu("[data-hora]");
  const argentina = horas?.find((h) => h.id === "argentina");
  const otras = horas?.filter((h) => h.id !== "argentina") ?? [];

  return (
    <>
      <div className="relojes-linea num" role="group" aria-label="Hora en cuatro ciudades">
        {(horas ?? []).map((h) => (
          <span key={h.id} className="reloj-ciudad">
            {h.nombre} <b>{h.hora}</b>
            {h.diferenciaDias != null && <span className="dia">{textoDia(h)}</span>}
          </span>
        ))}
      </div>
      <div className="menu-wrap relojes-compacto" ref={contenedor}>
        <button type="button" className="clocks num reloj-boton" aria-haspopup="true" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
          <span>
            Argentina <b>{argentina?.hora ?? ""}</b>
          </span>
        </button>
        <div className={`menu glass${abierto ? " open" : ""}`} role="group" aria-label="Hora en otras ciudades" aria-hidden={!abierto}>
          {otras.map((h) => (
            <div key={h.id} className="mi num" data-hora tabIndex={abierto ? 0 : -1}>
              {h.nombre}
              <span>
                <b>{h.hora}</b>
                {h.diferenciaDias != null && <span className="lbl">{textoDia(h)}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// Las cuatro horas dentro del menú del usuario (celular).
export function RelojesDelMenu() {
  const horas = useHoras();
  if (!horas) return null;
  return (
    <div className="menu-relojes" role="group" aria-label="Hora en cuatro ciudades">
      {horas.map((h) => (
        <div key={h.id} className="mi-reloj num">
          {h.nombre}
          <span>
            <b>{h.hora}</b>
            {h.diferenciaDias != null && <span className="lbl">{textoDia(h)}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
