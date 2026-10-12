// Lecturas y formas compartidas por las rutas API de la certificación y el
// equipo. Todo con la sesión del usuario (RLS "solo admins").
import { supabaseForRequest } from "./supabaseServer";
import { exigirSesion } from "./apiAuth";

export const COLUMNAS_CERT = "id, nombre, fecha_inicio, tarifa_sesion, tarifa_encuentro, tarifa_practica, estado, created_at";
export const COLUMNAS_EQUIPO = "id, nombre, contacto, notas, activo, created_at";
export const COLUMNAS_MODULO = "id, certificacion_id, numero, fecha_inicio, fecha_fin, cerrado_en";
export const COLUMNAS_ENCUENTRO = "id, modulo_id, tipo, numero, fecha, profe_id, tarifa, dictado, pago_gasto_id";
export const COLUMNAS_SESION = "id, inscripcion_id, modulo_id, coach_id, realizada, fecha_realizada, tarifa, pago_gasto_id";

export const NO_ENCONTRADA_CERT = "No se encontró la certificación. Puede que se haya borrado.";
export const NO_ENCONTRADO_MODULO = "No se encontró el módulo.";
export const NO_ENCONTRADO_ENCUENTRO = "No se encontró el encuentro.";
export const NO_ENCONTRADA_SESION = "No se encontró la sesión.";
export const NO_ENCONTRADA_INSCRIPCION = "No se encontró la inscripción.";
export const NO_ENCONTRADA_PERSONA = "No se encontró a esa persona del equipo.";

// Mensajes de base con sentido en este módulo (ver errorDeBase).
export const MENSAJES_CERT = {
  23503: { texto: "La persona, el alumno o el módulo elegido ya no existe.", status: 404 },
  23505: "Ese alumno ya está inscripto en esta certificación.",
  23514: { texto: "Alguno de los datos no es válido: un encuentro dictado necesita profe y una sesión realizada necesita coach.", status: 400 },
};

export async function abrirSesion(request) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  return { supabase, rtaSesion };
}

const aNumero = (v) => (v === null || v === undefined ? null : Number(v));

export function certParaCliente(c) {
  return {
    ...c,
    tarifa_sesion: aNumero(c.tarifa_sesion),
    tarifa_encuentro: aNumero(c.tarifa_encuentro),
    tarifa_practica: aNumero(c.tarifa_practica),
  };
}

export function conTarifa(fila) {
  return { ...fila, tarifa: aNumero(fila.tarifa) };
}

export function filaLiquidacion(f) {
  return { ...f, total: aNumero(f.total) };
}

// Ids de los pagos que cubren encuentros o sesiones de estos módulos. Es la forma
// segura de saber qué pagos son de una certificación (la descripción se puede
// editar en Gastos). { data: Set } o { error }.
export async function pagosReferenciados(supabase, moduloIds) {
  if (moduloIds.length === 0) return { data: new Set() };
  const [enc, ses] = await Promise.all([
    supabase.from("encuentros").select("pago_gasto_id").in("modulo_id", moduloIds).not("pago_gasto_id", "is", null),
    supabase.from("sesiones").select("pago_gasto_id").in("modulo_id", moduloIds).not("pago_gasto_id", "is", null),
  ]);
  for (const r of [enc, ses]) if (r.error) return { error: r.error };
  return { data: new Set([...enc.data, ...ses.data].map((x) => x.pago_gasto_id)) };
}

// Las prácticas finales después de los encuentros regulares, cada grupo por número.
export function ordenarEncuentros(lista) {
  return [...lista].sort((a, b) => (a.tipo === b.tipo ? a.numero - b.numero : a.tipo === "regular" ? -1 : 1));
}
