import { NextResponse } from "next/server";
import { supabaseForRequest } from "../../../../lib/supabaseServer";
import { exigirSesion } from "../../../../lib/apiAuth";
import { validarRecordatorioEdicion } from "../../../../lib/recordatorios";
import { conRegistroDeErrores } from "../../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase, leerJson } from "../../../../lib/respuestasApi";
import { esUuid } from "../../../../lib/validacion";

const RUTA = "/api/recordatorios/[id]";
const NO_ENCONTRADO = "No se encontró el recordatorio. Puede que ya se haya borrado.";

// PATCH /api/recordatorios/:id -> editar campos, o marcar hecho/deshacer
async function PATCH_(request, { params }) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADO, 404);
  const { body, respuesta } = await leerJson(request);
  if (respuesta) return respuesta;

  const { updates, error: errorValidacion } = validarRecordatorioEdicion(body);
  if (errorValidacion) return errorCliente(errorValidacion);

  if (typeof body.hecho === "boolean") {
    updates.hecho = body.hecho;
    // Timestamp completo (antes era solo la fecha): así "Hechos" queda
    // ordenado por cuándo se marcó de verdad, no solo por día.
    updates.hecho_en = body.hecho ? new Date().toISOString() : null;
  }

  if (Object.keys(updates).length === 0) return errorCliente("No hay nada para actualizar.");

  const { data, error } = await supabase.from("recordatorios").update(updates).eq("id", id).select().single();
  if (error) {
    if (error.code === "PGRST116") return errorCliente(NO_ENCONTRADO, 404);
    return errorDeBase(supabase, error, RUTA);
  }
  return NextResponse.json(data);
}

// DELETE /api/recordatorios/:id
async function DELETE_(request, { params }) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADO, 404);

  const { error } = await supabase.from("recordatorios").delete().eq("id", id);
  if (error) return errorDeBase(supabase, error, RUTA);
  return NextResponse.json({ ok: true });
}

export const PATCH = conRegistroDeErrores(PATCH_, RUTA);
export const DELETE = conRegistroDeErrores(DELETE_, RUTA);
