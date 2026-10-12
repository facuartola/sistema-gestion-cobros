import { cuotaAtrasada, mesesEntre } from "./fechas";

// Cuenta hace cuántos meses una persona debe, contando desde el mes de
// "inicio de deuda" (ver decisión en el README) hasta el mes actual.
//
// Criterio de qué mes cuenta como "debido":
// - Cualquier mes anterior al actual sin una cuota "pagado": cuenta siempre
//   (su vencimiento ya pasó, sin importar el día de vencimiento).
// - El mes actual: cuenta solo si además está "atrasado" (mismo criterio que
//   el badge de la tabla, cuotaAtrasada). Si todavía no venció, no se cuenta
//   como deuda: es una cuota pendiente normal, no algo que "deba".
// - Un mes con cuota "pagado" nunca cuenta, esté pagado el monto que esté
//   (no hay pagos parciales en este sistema).
//
// mesesPagados: Set<string> con los "YYYY-MM" que tienen una cuota "pagado".
export function mesesAdeudados({ mesInicio, mesActual, mesesPagados, diaVencimiento, ahora }) {
  let cuenta = 0;
  for (const mes of mesesEntre(mesInicio, mesActual)) {
    if (mesesPagados.has(mes)) continue;
    if (mes < mesActual) {
      cuenta++;
    } else if (cuotaAtrasada(mesActual, diaVencimiento, ahora)) {
      cuenta++;
    }
  }
  return cuenta;
}
