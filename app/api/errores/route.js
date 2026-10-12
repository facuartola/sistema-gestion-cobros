import { NextResponse } from "next/server";
import { supabaseForRequest } from "../../../lib/supabaseServer";
import { exigirSesion } from "../../../lib/apiAuth";
import { leerJson } from "../../../lib/respuestasApi";

// POST /api/errores -> registra un error del frontend (error boundary).
// A propósito NO usa conRegistroDeErrores (que también registra errores):
// si registrar un error fallara y volviéramos a intentar registrar ESE
// fallo, podríamos entrar en un loop. Acá directo: si falla, se ignora.
export async function POST(request) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  if (rtaSesion) return rtaSesion;

  // Un cuerpo que no es JSON es un pedido mal armado (400), no un error del servidor.
  const { body, respuesta } = await leerJson(request);
  if (respuesta) return respuesta;

  try {
    if (!body.mensaje) {
      return NextResponse.json({ error: "Falta el mensaje" }, { status: 400 });
    }

    const { error } = await supabase.from("errores_app").insert({
      mensaje: String(body.mensaje).slice(0, 2000),
      stack: body.stack ? String(body.stack).slice(0, 5000) : null,
      ruta: body.ruta ? String(body.ruta).slice(0, 500) : null,
      origen: "frontend",
      user_agent: request.headers.get("user-agent") || null,
    });

    if (error) {
      return NextResponse.json({ error: "No se pudo registrar el error." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo registrar el error." }, { status: 500 });
  }
}

// GET /api/errores -> últimos errores registrados, para la página /errores.
export async function GET(request) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  if (rtaSesion) return rtaSesion;

  const { data, error } = await supabase
    .from("errores_app")
    .select("*")
    .order("creado_en", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "No se pudieron cargar los errores registrados." }, { status: 500 });
  }
  return NextResponse.json(data);
}
