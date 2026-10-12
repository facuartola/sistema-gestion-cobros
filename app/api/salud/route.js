import { NextResponse } from "next/server";
import { estadoDeSalud } from "../../../lib/salud";

// GET /api/salud -> { ok: true } o { ok: false }. ÚNICA ruta pública de la API
// (sin sesión): no lee ni devuelve ningún dato, solo llama a public.ping() de
// Supabase con la clave pública. Ver docs/MANTENER-ACTIVO.md.
export async function GET() {
  const ok = await estadoDeSalud({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    clave: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return NextResponse.json({ ok }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store, max-age=0" } });
}
