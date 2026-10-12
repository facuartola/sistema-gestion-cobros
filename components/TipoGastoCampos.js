"use client";

// Piezas compartidas por la ventana de Mis gastos y por "Crear un tipo nuevo" al
// registrar un pago: la carpeta ("Dentro de") y "¿Se repite?".

const REPETICIONES = [
  { valor: "ninguna", etiqueta: "No" },
  { valor: "mensual", etiqueta: "Cada mes" },
  { valor: "anual", etiqueta: "Una vez al año" },
];

// ¿Se repite? Tres botones: un clic elige, sin abrir listas.
export function SeRepite({ valor, onChange, deshabilitado = false, ayuda }) {
  return (
    <div className="field" role="radiogroup" aria-label="¿Se repite?">
      <span>¿Se repite?</span>
      <div className="opciones">
        {REPETICIONES.map((r) => (
          <button
            key={r.valor}
            type="button"
            role="radio"
            aria-checked={valor === r.valor}
            className={`opcion${valor === r.valor ? " elegida" : ""}`}
            onClick={() => onChange(r.valor)}
            disabled={deshabilitado}
          >
            {r.etiqueta}
          </button>
        ))}
      </div>
      {ayuda && <small>{ayuda}</small>}
    </div>
  );
}

// Dentro de: el primer nivel o una de las carpetas posibles (lib/gastos.js › carpetasPosibles).
export function CarpetaSelect({ valor, onChange, carpetas, deshabilitado = false, ayuda }) {
  return (
    <label className="field">
      <span>Dentro de</span>
      <select value={valor} onChange={(e) => onChange(e.target.value)} disabled={deshabilitado}>
        <option value="">Ninguna (queda en el primer nivel)</option>
        {carpetas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.texto}
          </option>
        ))}
      </select>
      {ayuda && <small>{ayuda}</small>}
    </label>
  );
}
