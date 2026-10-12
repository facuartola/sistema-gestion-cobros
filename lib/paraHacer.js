// La lista "Para hacer" de Inicio, en dos grupos: Hoy y Esta semana. Junta lo que
// antes estaba en "Para hacer hoy", "Próximos 7 días" y las sugerencias sueltas:
// cobros atrasados o por vencer, gastos que vencen, pagos al equipo y
// recordatorios. Cada fila lleva lo que su botón necesita.
import { sumarDiasISO } from "./fechas";
import { fechaCorta } from "./resumen";

const SEMANA = new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: "UTC" });

// "mañana" o "jue 8".
export function etiquetaDia(fechaISO, hoy) {
  if (fechaISO === sumarDiasISO(hoy, 1)) return "mañana";
  const [a, m, d] = fechaISO.split("-").map(Number);
  return `${SEMANA.format(new Date(Date.UTC(a, m - 1, d))).replace(".", "")} ${d}`;
}

// Una fila de "Esta semana" con la forma de las de "Hoy".
function filaDeProximo(it, hoy, personas) {
  const base = { clave: it.clave, nombre: it.nombre, monto: it.monto ?? null, etiqueta: etiquetaDia(it.fecha, hoy), tono: "neutro" };
  if (it.tipo === "cobro") {
    const persona = personas.find((p) => p.tipo === it.personaTipo && p.id === it.personaId) || null;
    return { ...base, tipo: "cobro", persona, titulo: `Cobrar a ${it.nombre}`, detalle: `Vence la cuota el ${fechaCorta(it.fecha)}` };
  }
  if (it.tipo === "gasto") {
    return { ...base, tipo: "gasto", gasto: { id: it.categoriaId, periodo: it.periodo }, titulo: `Pagar ${it.nombre}`, detalle: `Vence el ${fechaCorta(it.fecha)}` };
  }
  return { ...base, tipo: "recordatorio", recordatorio: it.recordatorio, nombre: null, titulo: it.titulo, detalle: `Recordatorio para el ${fechaCorta(it.fecha)}` };
}

// pendientes: salida de armarPendientes. proximos: salida de agendaProxima.
// personas: jugadores y alumnos activos con `tipo`.
export function armarParaHacer({ pendientes, proximos, personas, hoy }) {
  pendientes = Array.isArray(pendientes) ? pendientes : [];
  proximos = Array.isArray(proximos) ? proximos : [];
  personas = Array.isArray(personas) ? personas : [];
  // Un gasto que todavía no vence va en "Esta semana"; el vencido o el de hoy, en "Hoy".
  const deHoy = pendientes.filter((f) => !(f.tipo === "gasto" && f.gasto?.estado === "pendiente"));
  const semana = proximos.map((it) => filaDeProximo(it, hoy, personas)).filter((f) => f.tipo !== "cobro" || f.persona);
  return { hoy: deHoy, semana };
}
