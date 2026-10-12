import { NextResponse } from "next/server";
import { conRegistroDeErrores } from "../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase, leerJson } from "../../../lib/respuestasApi";
import { validarCertificacion } from "../../../lib/certificacionValidacion";
import { COLUMNAS_CERT, abrirSesion, certParaCliente } from "../../../lib/certificacionServidor";

const RUTA = "/api/certificaciones";

// GET -> todas las certificaciones, de la más vieja a la más nueva.
async function GET_(request) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { data, error } = await supabase.from("certificaciones").select(COLUMNAS_CERT).order("created_at");
  if (error) return errorDeBase(supabase, error, RUTA);
  return NextResponse.json(data.map(certParaCliente));
}

// POST -> crear { nombre, fecha_inicio?, tarifa_sesion?, tarifa_encuentro?,
// tarifa_practica? }. La base crea sola los 10 módulos y sus 4 encuentros.
async function POST_(request) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { body, respuesta } = await leerJson(request);
  if (respuesta) return respuesta;

  const { datos, error } = validarCertificacion(body, { creando: true });
  if (error) return errorCliente(error);

  const { data, error: errorAlta } = await supabase.from("certificaciones").insert(datos).select(COLUMNAS_CERT).single();
  if (errorAlta) return errorDeBase(supabase, errorAlta, RUTA);
  return NextResponse.json(certParaCliente(data), { status: 201 });
}

export const GET = conRegistroDeErrores(GET_, RUTA);
export const POST = conRegistroDeErrores(POST_, RUTA);
