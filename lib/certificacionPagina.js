// Lógica pura de la pantalla única de Certificación (sin React ni red): qué
// pestaña y qué módulo o persona pide la dirección, el estado de cada módulo en
// la tira, los textos de los avisos y el rol de cada persona del equipo.
import { formatoDolares } from "./moneda";

export const PESTANAS_CERT = [
  { id: "modulos", etiqueta: "Módulos" },
  { id: "alumnos", etiqueta: "Alumnos" },
  { id: "equipo", etiqueta: "Equipo" },
];

export const pestanaCertValida = (valor) => (PESTANAS_CERT.some((p) => p.id === valor) ? valor : null);

// "/certificacion/alumnos/abc" -> { pestana: "alumnos", id: "abc" }. Las
// direcciones viejas (resumen, módulos, alumnos, equipo y sus fichas) siguen
// respondiendo: cada una cae en la pestaña que le corresponde.
export function leerRutaCert(ruta) {
  const [, seccion, id] = String(ruta ?? "").split("/").filter(Boolean);
  return { pestana: pestanaCertValida(seccion), id: id || null };
}

// Estado de un módulo en la tira, a partir de una fila de estado_modulos.
//   pagado | listo (para pagar al equipo) | en_curso | sin_empezar
export function estadoEnTira(fila) {
  if (fila.cerrado_en) return "pagado";
  if (fila.listo_para_liquidar) return "listo";
  if (!fila.encuentros_dictados && !fila.sesiones_realizadas) return "sin_empezar";
  return "en_curso";
}

export const TEXTO_ESTADO = {
  pagado: "Pagado",
  listo: "Listo para pagar",
  en_curso: "En curso",
  sin_empezar: "Sin empezar",
};

const personas = (n) => (n === 1 ? "1 persona" : `${n} personas`);

// "El Módulo 3 terminó: hay que pagar US$ 450 a 2 personas". Si falta una
// tarifa, no hay total: lo dice.
export function textoModuloListo({ numero, total, personas: n, faltaTarifa }) {
  if (faltaTarifa || total === null || total === undefined) return `El Módulo ${numero} terminó, pero falta definir la tarifa para saber cuánto pagar.`;
  return `El Módulo ${numero} terminó: hay que pagar ${formatoDolares(total)} a ${personas(n)}.`;
}

// "Pagos atrasados al equipo: US$ 50"
export function textoAtrasados({ total, faltaTarifa }) {
  if (faltaTarifa || total === null || total === undefined) return "Pagos atrasados al equipo: falta definir la tarifa.";
  return `Pagos atrasados al equipo: ${formatoDolares(total)}`;
}

// Rol de una persona según lo que tiene asignado: profe (encuentros), coach
// (sesiones o alumnos) o las dos cosas. La base no guarda el rol: se deduce.
export function rolDe({ es_profe: profe, es_coach: coach }) {
  if (profe && coach) return "Profe y coach";
  if (profe) return "Profe";
  if (coach) return "Coach";
  return "Sin asignar";
}

// Lo que se le debe a una persona (filas de calcular_pendientes): { total,
// faltaTarifa }. total 0 = al día.
export function deudaDe(personaId, pendientes) {
  const propias = pendientes.filter((f) => f.equipo_id === personaId);
  const faltaTarifa = propias.some((f) => f.total === null);
  return { total: faltaTarifa ? null : propias.reduce((acc, f) => acc + Number(f.total), 0), faltaTarifa };
}

// El módulo a mostrar cuando alguien dice "registré una clase o sesión": el
// primero que todavía no se pagó.
export function moduloParaRegistrar(modulos) {
  return (modulos ?? []).find((m) => !m.cerrado_en) ?? null;
}
