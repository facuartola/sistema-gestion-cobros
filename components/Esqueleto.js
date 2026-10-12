// Bloques de carga con la misma forma que el contenido real: así, cuando
// llega el dato, nada salta de lugar (antes un "Cargando…" de una línea se
// reemplazaba por tarjetas y tablas enteras y empujaba todo para abajo).

export function Esqueleto({ ancho = "100%", alto = 12, radio = 7, style }) {
  return <span className="esqueleto" style={{ width: ancho, height: alto, borderRadius: radio, ...style }} />;
}

// Réplica de .stats-row: cuatro tarjetas.
export function EsqueletoStats() {
  return (
    <div className="stats-row" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="stat card">
          <Esqueleto ancho={80} alto={10} />
          <Esqueleto ancho={90} alto={22} style={{ marginTop: 9 }} />
        </div>
      ))}
    </div>
  );
}

// Filas de tabla con la altura de una fila real.
export function EsqueletoFilas({ columnas, filas = 5 }) {
  const anchos = ["70%", "55%", "40%", "65%", "50%", "45%", "30%"];
  return Array.from({ length: filas }, (_, f) => (
    <tr key={f} className="fila-esqueleto" aria-hidden="true">
      {Array.from({ length: columnas }, (_, c) => (
        <td key={c}>
          <Esqueleto ancho={anchos[(c + f) % anchos.length]} alto={12} />
        </td>
      ))}
    </tr>
  ));
}

// Lista genérica (Inicio, /recordatorios).
export function EsqueletoLista({ items = 3, alto = 14 }) {
  return (
    <div className="esqueleto-lista" aria-hidden="true">
      {Array.from({ length: items }, (_, i) => (
        <div key={i} className="esqueleto-lista-item">
          <Esqueleto ancho={`${75 - i * 12}%`} alto={alto} />
          <Esqueleto ancho="35%" alto={10} style={{ marginTop: 7 }} />
        </div>
      ))}
    </div>
  );
}
