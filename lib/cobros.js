import { cuotaAtrasada } from "./fechas";
import { formatoDolares } from "./moneda";

// Estado de una fila de Cobros, con las palabras de la administradora:
//   "Pagó" · "Atrasado" · "Vence el 10" · "Sin vencimiento".
// `tono` pinta la etiqueta: pagado, atrasado o pendiente.
export function estadoDeCobro(persona, mes, ahora = new Date()) {
  const cuota = persona.cuota_actual;
  if (cuota?.estado === "pagado") return { clave: "pagado", texto: "Pagó", tono: "pagado" };
  if (cuotaAtrasada(mes, persona.dia_vencimiento, ahora)) return { clave: "atrasado", texto: "Atrasado", tono: "atrasado" };
  if (persona.dia_vencimiento) return { clave: "vence", texto: `Vence el ${persona.dia_vencimiento}`, tono: "pendiente" };
  return { clave: "sin-vencimiento", texto: "Sin vencimiento", tono: "pendiente" };
}

export function montoDeCuota(persona) {
  return Number(persona.cuota_actual?.monto ?? persona.monto_mensual ?? 0);
}

// "Faltan US$ 14.799 de 5 personas" / "Falta US$ 500 de 1 persona" /
// "Todos pagaron este mes" / null si no hay nadie cargado.
export function fraseDeResumen(personas) {
  if (personas.length === 0) return null;
  const faltan = personas.filter((p) => p.cuota_actual?.estado !== "pagado");
  if (faltan.length === 0) return "Todos pagaron este mes.";
  const total = faltan.reduce((acc, p) => acc + montoDeCuota(p), 0);
  return `${faltan.length === 1 ? "Falta" : "Faltan"} ${formatoDolares(total)} de ${faltan.length} ${faltan.length === 1 ? "persona" : "personas"}.`;
}

// "debe 2 meses" para la deuda acumulada (null si no debe nada).
export function textoDeuda(meses) {
  const n = Number(meses) || 0;
  return n > 0 ? `debe ${n} ${n === 1 ? "mes" : "meses"}` : null;
}

// Porcentaje abonado del monto total de un alumno, entre 0 y 100.
export function porcentajeAbonado(abonado, total) {
  const t = Number(total);
  if (!t || t <= 0) return 0;
  return Math.min(100, Math.round((Number(abonado) / t) * 100));
}

// Pestañas de Cobros. La elegida se recuerda en el navegador.
export const PESTANAS_COBROS = [
  { tipo: "jugador", etiqueta: "Jugadores" },
  { tipo: "alumno", etiqueta: "Alumnos de la certificación" },
];
export function tipoValido(tipo) {
  return tipo === "alumno" || tipo === "jugador" ? tipo : null;
}
