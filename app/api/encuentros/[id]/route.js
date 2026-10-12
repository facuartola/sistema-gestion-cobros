import { NextResponse } from "next/server";
import { conRegistroDeErrores } from "../../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase, leerJson } from "../../../../lib/respuestasApi";
import { validarCambiosEncuentro } from "../../../../lib/certificacionValidacion";
import { COLUMNAS_ENCUENTRO, MENSAJES_CERT, NO_ENCONTRADO_ENCUENTRO, abrirSesion, conTarifa } from "../../../../lib/certificacionServidor";
import { esUuid } from "../../../../lib/validacion";

const RUTA = "/api/encuentros/[id]";

// PATCH { fecha?, profe_id?, dictado?, tarifa? }. Si el encuentro ya fue pagado,
// la base rechaza el cambio con su mensaje ("…primero eliminá el pago en Gastos").
async function PATCH_(request, { params }) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADO_ENCUENTRO, 404);
  const { body, respuesta } = await leerJson(request);
  if (respuesta) return respuesta;

  const { data: actual, error } = await supabase.from("encuentros").select(COLUMNAS_ENCUENTRO).eq("id", id).maybeSingle();
  if (error) return errorDeBase(supabase, error, RUTA);
  if (!actual) return errorCliente(NO_ENCONTRADO_ENCUENTRO, 404);

  const { datos, error: invalido } = validarCambiosEncuentro(body, actual);
  if (invalido) return errorCliente(invalido);

  if (datos.profe_id) {
    const { data: persona, error: errorPersona } = await supabase.from("equipo").select("id, activo").eq("id", datos.profe_id).maybeSingle();
    if (errorPersona) return errorDeBase(supabase, errorPersona, RUTA);
    if (!persona) return errorCliente("Esa persona ya no está en el equipo.", 404);
    if (!persona.activo && datos.profe_id !== actual.profe_id) return errorCliente("Esa persona está desactivada: activala en Equipo para asignarla.");
  }

  const { data, error: errorEdicion } = await supabase.from("encuentros").update(datos).eq("id", id).select(COLUMNAS_ENCUENTRO).single();
  if (errorEdicion) return errorDeBase(supabase, errorEdicion, RUTA, MENSAJES_CERT);
  return NextResponse.json(conTarifa(data));
}

// DELETE -> quitar una práctica final (los encuentros regulares no se borran).
async function DELETE_(request, { params }) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADO_ENCUENTRO, 404);

  const { data: actual, error } = await supabase.from("encuentros").select("id, tipo").eq("id", id).maybeSingle();
  if (error) return errorDeBase(supabase, error, RUTA);
  if (!actual) return NextResponse.json({ ok: true });
  if (actual.tipo !== "practica_final") return errorCliente("Los 4 encuentros del módulo no se pueden quitar.");

  const { error: errorBaja } = await supabase.from("encuentros").delete().eq("id", id);
  if (errorBaja) return errorDeBase(supabase, errorBaja, RUTA);
  return NextResponse.json({ ok: true });
}

export const PATCH = conRegistroDeErrores(PATCH_, RUTA);
export const DELETE = conRegistroDeErrores(DELETE_, RUTA);
