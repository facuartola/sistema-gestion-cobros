import { NextResponse } from "next/server";
import { supabaseForRequest } from "../../../lib/supabaseServer";
import { exigirSesion } from "../../../lib/apiAuth";
import { validarRecordatorioNuevo } from "../../../lib/recordatorios";
import { conRegistroDeErrores } from "../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase, leerJson } from "../../../lib/respuestasApi";

const RUTA = "/api/recordatorios";

// GET /api/recordatorios?hecho=0|1 -> lista de recordatorios (default: todos)
async function GET_(request) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  if (rtaSesion) return rtaSesion;

  const { searchParams } = new URL(request.url);
  const hecho = searchParams.get("hecho");

  let query = supabase.from("recordatorios").select("*").order("fecha").order("created_at");
  if (hecho === "0") query = query.eq("hecho", false);
  if (hecho === "1") query = query.eq("hecho", true);

  const { data, error } = await query;
  if (error) return errorDeBase(supabase, error, RUTA);
  return NextResponse.json(data);
}

// POST /api/recordatorios -> crear un recordatorio nuevo
async function POST_(request) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  if (rtaSesion) return rtaSesion;
  const { body, respuesta } = await leerJson(request);
  if (respuesta) return respuesta;

  const { datos, error: errorValidacion } = validarRecordatorioNuevo(body);
  if (errorValidacion) return errorCliente(errorValidacion);

  const { data, error } = await supabase.from("recordatorios").insert(datos).select().single();
  if (error) return errorDeBase(supabase, error, RUTA);
  return NextResponse.json(data, { status: 201 });
}

export const GET = conRegistroDeErrores(GET_, RUTA);
export const POST = conRegistroDeErrores(POST_, RUTA);
