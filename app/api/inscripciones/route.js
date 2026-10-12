import { NextResponse } from "next/server";
import { conRegistroDeErrores } from "../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase, leerJson } from "../../../lib/respuestasApi";
import { validarInscripcion } from "../../../lib/certificacionValidacion";
import { MENSAJES_CERT, abrirSesion } from "../../../lib/certificacionServidor";

const RUTA = "/api/inscripciones";

// POST { certificacion_id, alumno_id, coach_id? } -> inscribir un alumno. La base
// crea sola sus 10 sesiones, con ese coach.
async function POST_(request) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { body, respuesta } = await leerJson(request);
  if (respuesta) return respuesta;

  const { datos, error } = validarInscripcion(body);
  if (error) return errorCliente(error);

  const [alumno, coach] = await Promise.all([
    supabase.from("alumnos").select("id, activo").eq("id", datos.alumno_id).maybeSingle(),
    datos.coach_id ? supabase.from("equipo").select("id, activo").eq("id", datos.coach_id).maybeSingle() : Promise.resolve({ data: true, error: null }),
  ]);
  for (const r of [alumno, coach]) if (r.error) return errorDeBase(supabase, r.error, RUTA);
  if (!alumno.data) return errorCliente("Ese alumno ya no existe.", 404);
  if (!alumno.data.activo) return errorCliente("Ese alumno está dado de baja.");
  if (!coach.data) return errorCliente("Ese coach ya no está en el equipo.", 404);
  if (coach.data !== true && !coach.data.activo) return errorCliente("Ese coach está desactivado: activalo en Equipo para asignarlo.");

  const { data, error: errorAlta } = await supabase.from("inscripciones").insert(datos).select("id, certificacion_id, alumno_id, coach_id").single();
  if (errorAlta) return errorDeBase(supabase, errorAlta, RUTA, MENSAJES_CERT);
  return NextResponse.json(data, { status: 201 });
}

export const POST = conRegistroDeErrores(POST_, RUTA);
