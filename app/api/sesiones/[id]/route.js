import { NextResponse } from "next/server";
import { conRegistroDeErrores } from "../../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase, leerJson } from "../../../../lib/respuestasApi";
import { hoyArgentinaISO } from "../../../../lib/fechas";
import { validarCambiosSesion } from "../../../../lib/certificacionValidacion";
import { COLUMNAS_SESION, MENSAJES_CERT, NO_ENCONTRADA_SESION, abrirSesion, conTarifa } from "../../../../lib/certificacionServidor";
import { esUuid } from "../../../../lib/validacion";

const RUTA = "/api/sesiones/[id]";

// PATCH { realizada?, fecha_realizada?, tarifa? }. Marcada sin fecha, queda con la
// de hoy (hora Argentina). Si ya fue pagada, la base rechaza el cambio con su mensaje.
async function PATCH_(request, { params }) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADA_SESION, 404);
  const { body, respuesta } = await leerJson(request);
  if (respuesta) return respuesta;

  const { data: actual, error } = await supabase.from("sesiones").select(COLUMNAS_SESION).eq("id", id).maybeSingle();
  if (error) return errorDeBase(supabase, error, RUTA);
  if (!actual) return errorCliente(NO_ENCONTRADA_SESION, 404);

  const { datos, error: invalido } = validarCambiosSesion(body, actual, hoyArgentinaISO());
  if (invalido) return errorCliente(invalido);

  const { data, error: errorEdicion } = await supabase.from("sesiones").update(datos).eq("id", id).select(COLUMNAS_SESION).single();
  if (errorEdicion) return errorDeBase(supabase, errorEdicion, RUTA, MENSAJES_CERT);
  return NextResponse.json(conTarifa(data));
}

export const PATCH = conRegistroDeErrores(PATCH_, RUTA);
