import { NextResponse } from "next/server";
import { conRegistroDeErrores } from "../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase, leerJson } from "../../../lib/respuestasApi";
import { validarPersonaEquipo } from "../../../lib/certificacionValidacion";
import { COLUMNAS_EQUIPO, abrirSesion } from "../../../lib/certificacionServidor";

const RUTA = "/api/equipo";

// GET -> todas las personas del equipo (activas e inactivas), por nombre.
// Con ?resumen=1 suma por persona lo cobrado (suma de sus pagos en Gastos) y si
// da encuentros (es_profe) o sesiones (es_coach): la base no guarda el rol, se
// deduce de lo que tiene asignado.
async function GET_(request) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { data, error } = await supabase.from("equipo").select(COLUMNAS_EQUIPO).order("nombre");
  if (error) return errorDeBase(supabase, error, RUTA);
  if (new URL(request.url).searchParams.get("resumen") !== "1") return NextResponse.json(data);

  const [pagos, encuentros, sesiones, inscripciones] = await Promise.all([
    supabase.from("pagos_gasto").select("equipo_id, monto").not("equipo_id", "is", null),
    supabase.from("encuentros").select("profe_id").not("profe_id", "is", null),
    supabase.from("sesiones").select("coach_id").not("coach_id", "is", null),
    supabase.from("inscripciones").select("coach_id").not("coach_id", "is", null),
  ]);
  for (const r of [pagos, encuentros, sesiones, inscripciones]) if (r.error) return errorDeBase(supabase, r.error, RUTA);
  const cobrado = new Map();
  for (const p of pagos.data) cobrado.set(p.equipo_id, (cobrado.get(p.equipo_id) ?? 0) + Number(p.monto));
  const profes = new Set(encuentros.data.map((e) => e.profe_id));
  const coaches = new Set([...sesiones.data.map((s) => s.coach_id), ...inscripciones.data.map((i) => i.coach_id)]);
  return NextResponse.json(data.map((p) => ({ ...p, cobrado: cobrado.get(p.id) ?? 0, es_profe: profes.has(p.id), es_coach: coaches.has(p.id) })));
}

// POST { nombre, contacto?, notas? } -> alta.
async function POST_(request) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { body, respuesta } = await leerJson(request);
  if (respuesta) return respuesta;

  const { datos, error } = validarPersonaEquipo(body, { creando: true });
  if (error) return errorCliente(error);

  const { data, error: errorAlta } = await supabase.from("equipo").insert(datos).select(COLUMNAS_EQUIPO).single();
  if (errorAlta) return errorDeBase(supabase, errorAlta, RUTA);
  return NextResponse.json(data, { status: 201 });
}

export const GET = conRegistroDeErrores(GET_, RUTA);
export const POST = conRegistroDeErrores(POST_, RUTA);
