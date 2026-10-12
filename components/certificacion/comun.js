import { estadoEnTira, TEXTO_ESTADO } from "../../lib/certificacionPagina";
import { formatoDolares } from "../../lib/moneda";
import { fechaDMA } from "../../lib/fechas";
import Enlace from "../Enlace";

const TONO_ESTADO = { pagado: "neutro", listo: "ok", en_curso: "", sin_empezar: "neutro" };

export function PillModulo({ fila }) {
  const estado = estadoEnTira(fila);
  return <span className={`pill ${TONO_ESTADO[estado]}`}>{TEXTO_ESTADO[estado]}</span>;
}

export const NOTA_PAGADO =
  "Lo que dice “Pagado” ya se pagó y no se puede cambiar. Para corregirlo, primero eliminá el pago en Gastos (Pago de sesiones o Pago de encuentros): vuelve a quedar sin pagar.";

export function PillPagado() {
  return (
    <span className="pill ok" title="Ya se pagó. Para corregirlo, primero eliminá el pago en Gastos.">
      Pagado
    </span>
  );
}

// Barra "7 de 10".
export function BarraAvance({ hechas, total }) {
  const pct = total > 0 ? Math.round((hechas / total) * 100) : 0;
  return (
    <div className="avance">
      <div className={`progreso-barra${hechas >= total && total > 0 ? " completo" : ""}`} role="img" aria-label={`${hechas} de ${total} sesiones`}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <span className="lbl num">
        {hechas} de {total} sesiones
      </span>
    </div>
  );
}

export function tarifaTexto(valor, respaldo) {
  if (valor != null) return formatoDolares(valor);
  return respaldo ?? "Sin definir";
}

export const CONCEPTO = { sesiones: "Sesiones", encuentros: "Clases" };

// Tabla de lo que se debe pagar al equipo:
// por persona y concepto, con el total general. Si falta una tarifa, lo dice y
// lleva a configurarla.
export function TablaLiquidacion({ filas, vacio = "No hay nada para pagar.", onConfigurar }) {
  if (filas.length === 0) return <p className="vacio-lista">{vacio}</p>;
  const faltaTarifa = filas.some((f) => f.total === null);
  const total = filas.reduce((acc, f) => acc + (f.total ?? 0), 0);
  return (
    <>
      <div className="table-card">
        <table className="apilable tabla-liquidacion">
          <thead>
            <tr>
              <th>Persona</th>
              <th>Concepto</th>
              <th>Cantidad</th>
              <th>Total (US$)</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={`${f.equipo_id}-${f.concepto}`}>
                <td>
                  <Enlace href={`/certificacion/equipo/${f.equipo_id}`} className="link-action">
                    {f.nombre}
                  </Enlace>
                </td>
                <td data-label="Concepto">{CONCEPTO[f.concepto]}</td>
                <td data-label="Cantidad" className="num">
                  {f.cantidad}
                </td>
                <td data-label="Total (US$)" className="num">
                  {f.total === null ? <span className="texto-alerta">Falta definir la tarifa</span> : formatoDolares(f.total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Total</td>
              <td className="num">{faltaTarifa ? "—" : formatoDolares(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {faltaTarifa && (
        <p className="notice-banner" role="status">
          Falta definir la tarifa de la certificación para calcular el total.
          {onConfigurar && (
            <>
              {" "}
              <button type="button" className="link-action" onClick={onConfigurar}>
                Definir las tarifas
              </button>
            </>
          )}
        </p>
      )}
    </>
  );
}

export function fechaCortaOGuion(fecha) {
  return fecha ? fechaDMA(fecha) : "—";
}
