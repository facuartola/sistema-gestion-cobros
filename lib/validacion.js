// Validaciones de forma compartidas por las rutas API. El frontend ya valida
// lo mismo, pero el backend no puede confiar en eso: cualquier request puede
// llegar armada a mano.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const LIMITES = {
  nombre: 120,
  notas: 2000,
  contacto: 300,
  titulo: 200,
  nota: 2000,
  // Tope de cordura para un monto: evita que un typo (un 0 de más varias
  // veces) o un número absurdo quede guardado como dato real.
  montoMaximo: 100_000_000,
};

export function esUuid(valor) {
  return typeof valor === "string" && UUID_RE.test(valor);
}

// "YYYY-MM-DD" que además existe en el calendario (rechaza 2026-02-30).
export function esFechaISO(valor) {
  if (typeof valor !== "string" || !FECHA_RE.test(valor)) return false;
  const [anio, mes, dia] = valor.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia)); // calendario puro, sin huso
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

export function esMesISO(valor) {
  return typeof valor === "string" && MES_RE.test(valor);
}

// Las cuotas se guardan siempre con mes = primer día del mes. Si el backend
// aceptara "2026-09-15" tal cual, el unique (persona, mes) no lo vería como
// el mismo mes que "2026-09-01" y quedarían dos cuotas para septiembre.
export function normalizarMesCuota(valor) {
  if (typeof valor !== "string") return null;
  const mes = valor.slice(0, 7);
  if (!esMesISO(mes)) return null;
  if (valor.length > 7 && !esFechaISO(valor)) return null;
  return `${mes}-01`;
}

// Una fecha de pago no puede ser futura (nadie pagó mañana) ni de antes de que
// existiera el sistema: una fecha así inflaría "cobrado" o "gastado" sin que
// nadie se dé cuenta. Devuelve el mensaje de error o null.
const FECHA_MINIMA_PAGO = "2020-01-01";
export function errorFechaDePago(fecha, hoy, nombre = "La fecha de pago") {
  if (fecha > hoy) return `${nombre} no puede ser posterior a hoy.`;
  if (fecha < FECHA_MINIMA_PAGO) return `${nombre} es demasiado antigua. Revisá el año.`;
  return null;
}

// El mes de una cuota ("YYYY-MM-01") no puede estar más de un año adelante ni
// ser anterior a 2020. `mesActual` es "YYYY-MM" (hora Argentina).
export function errorMesDeCuota(mes, mesActual) {
  const [anio, m] = mesActual.split("-").map(Number);
  const limite = new Date(Date.UTC(anio, m - 1 + 12, 1)).toISOString().slice(0, 7);
  if (mes.slice(0, 7) > limite) return "El mes de la cuota está demasiado adelante. Revisá el año.";
  if (mes < FECHA_MINIMA_PAGO) return "El mes de la cuota es demasiado antiguo. Revisá el año.";
  return null;
}

export const METODOS_PAGO = ["efectivo", "transferencia"];

// Método con el que se cobró una cuota. Devuelve { metodo } listo para
// mezclar en el upsert: {} si no vino (no se toca), { metodo_pago: null } si
// vino vacío, { metodo_pago: "efectivo" | "transferencia" }; o { error }.
export function parseMetodoPago(valor) {
  if (valor === undefined) return { metodo: {} };
  if (valor === null || valor === "") return { metodo: { metodo_pago: null } };
  if (!METODOS_PAGO.includes(valor)) return { error: "El método de pago tiene que ser efectivo o transferencia." };
  return { metodo: { metodo_pago: valor } };
}
