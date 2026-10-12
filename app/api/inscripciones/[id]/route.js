import { NextResponse } from "next/server";
import { conRegistroDeErrores } from "../../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase, leerJson } from "../../../../lib/respuestasApi";
import { validarCambioCoach } from "../../../../lib/certificacionValidacion";
import {
  COLUMNAS_SESION,
  MENSAJES_CERT,
  NO_ENCONTRADA_INSCRIPCION,
  abrirSesion,
  conTarifa,
} from "../../../../lib/certificacionServidor";
import { esUuid } from "../../../../lib/validacion";

const RUTA = "/api/inscripciones/[id]";

// GET -> ficha del alumno en la certificación: { inscripcion, alumno, coach,
// sesiones } con sus 10 sesiones (módulo, coach que la dio, fecha y si está pagada).
async function GET_(request, { params }) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADA_INSCRIPCION, 404);

  const { data: inscripcion, error } = await supabase
    .from("inscripciones")
    .select("id, certificacion_id, alumno_id, coach_id, created_at, alumnos(nombre), equipo(nombre)")
    .eq("id", id)
    .maybeSingle();
  if (error) return errorDeBase(supabase, error, RUTA);
  if (!inscripcion) return errorCliente(NO_ENCONTRADA_INSCRIPCION, 404);

  const { data: sesiones, error: errorSesiones } = await supabase
    .from("sesiones")
    .select(`${COLUMNAS_SESION}, modulos(numero), equipo(nombre)`)
    .eq("inscripcion_id", id);
  if (errorSesiones) return errorDeBase(supabase, errorSesiones, RUTA);

  const { alumnos, equipo, ...resto } = inscripcion;
  return NextResponse.json({
    inscripcion: resto,
    alumno: alumnos?.nombre ?? "",
    coach: equipo?.nombre ?? null,
    sesiones: sesiones
      .map(({ modulos, equipo: coach, ...s }) => ({ ...conTarifa(s), modulo: modulos?.numero ?? null, coach: coach?.nombre ?? null }))
      .sort((a, b) => a.modulo - b.modulo),
  });
}

// PATCH { coach_id } -> cambiar el coach. La base pasa al nuevo solo las sesiones
// no hechas y no pagadas; las hechas quedan con quien las dio.
async function PATCH_(request, { params }) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADA_INSCRIPCION, 404);
  const { body, respuesta } = await leerJson(request);
  if (respuesta) return respuesta;

  const { datos, error } = validarCambioCoach(body);
  if (error) return errorCliente(error);
  if (datos.coach_id) {
    const { data: coach, error: errorCoach } = await supabase.from("equipo").select("id, activo").eq("id", datos.coach_id).maybeSingle();
    if (errorCoach) return errorDeBase(supabase, errorCoach, RUTA);
    if (!coach) return errorCliente("Ese coach ya no está en el equipo.", 404);
    if (!coach.activo) return errorCliente("Ese coach está desactivado: activalo en Equipo para asignarlo.");
  }

  const { data, error: errorEdicion } = await supabase
    .from("inscripciones")
    .update(datos)
    .eq("id", id)
    .select("id, certificacion_id, alumno_id, coach_id")
    .maybeSingle();
  if (errorEdicion) return errorDeBase(supabase, errorEdicion, RUTA, MENSAJES_CERT);
  if (!data) return errorCliente(NO_ENCONTRADA_INSCRIPCION, 404);
  return NextResponse.json(data);
}

export const GET = conRegistroDeErrores(GET_, RUTA);
export const PATCH = conRegistroDeErrores(PATCH_, RUTA);
