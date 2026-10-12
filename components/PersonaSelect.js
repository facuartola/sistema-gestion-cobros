"use client";

import { useState } from "react";

// Selector con búsqueda simple entre jugadores y alumnos activos. Guarda la
// selección como { tipo: "jugador"|"alumno", id, nombre } o null.
// Nota: el texto tipeado es estado interno (no se sincroniza con `valor` en
// cada render) para no pelear con lo que la persona está escribiendo. Cuando
// el padre necesita limpiar la selección de verdad (p. ej. tras guardar),
// debe remontar este componente cambiando su `key`.
export default function PersonaSelect({ personas, valor, onChange, disabled, autoFocus = false }) {
  const [texto, setTexto] = useState(valor?.nombre ?? "");
  const [abierto, setAbierto] = useState(false);

  const coincidencias =
    texto.trim() === ""
      ? []
      : personas
          .filter((p) => p.nombre.toLowerCase().includes(texto.trim().toLowerCase()))
          .slice(0, 8);

  function elegir(p) {
    onChange({ tipo: p.tipo, id: p.id, nombre: p.nombre });
    setTexto(p.nombre);
    setAbierto(false);
  }

  function limpiar() {
    onChange(null);
    setTexto("");
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        value={texto}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder="Buscar jugador o alumno…"
        aria-label="Buscar jugador o alumno"
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
          if (valor && e.target.value !== valor.nombre) onChange(null);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
      />
      {valor && (
        <button type="button" className="link-action" style={{ marginTop: 4 }} onClick={limpiar} disabled={disabled}>
          Quitar {valor.tipo === "jugador" ? "jugador" : "alumno"} asociado
        </button>
      )}
      {abierto && coincidencias.length > 0 && (
        <ul className="persona-select-lista glass">
          {coincidencias.map((p) => (
            <li key={`${p.tipo}-${p.id}`}>
              <button type="button" onMouseDown={() => elegir(p)}>
                {p.nombre}
                <span className="persona-select-tipo">{p.tipo === "jugador" ? "Jugador" : "Alumno"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
