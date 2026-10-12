import { NextResponse } from "next/server";
import { supabaseForRequest } from "../../../lib/supabaseServer";
import { exigirSesion } from "../../../lib/apiAuth";
import { conRegistroDeErrores, registrarErrorServidor } from "../../../lib/registrarErrorServidor";
import { errorCliente } from "../../../lib/respuestasApi";
import { ErrorCopia, armarCopia, reunirTablas } from "../../../lib/copia";

const RUTA = "/api/copia";

// GET /api/copia?sep=; -> .zip con la copia completa de los datos. Solo lee, con
// la sesión de quien la pide. Si alguna tabla no llega entera, responde un error
// claro y no entrega nada. `sep` es el separador de columnas que le sirve a Excel
// en la computadora de quien descarga (lo decide el navegador).
async function GET_(request) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  if (rtaSesion) return rtaSesion;

  const separador = new URL(request.url).searchParams.get("sep") === ";" ? ";" : ",";

  let tablas;
  try {
    tablas = await reunirTablas(supabase);
  } catch (err) {
    if (!(err instanceof ErrorCopia)) throw err;
    if (err.causa) await registrarErrorServidor(supabase, { mensaje: `[copia] ${err.message} ${err.causa.message ?? ""}`, stack: null, ruta: RUTA });
    return errorCliente(err.message, err.status);
  }

  const { zip, nombre, cercaDelLimite } = armarCopia(tablas, { separador });
  return new NextResponse(zip, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Content-Length": String(zip.length),
      "Cache-Control": "private, no-store",
      "X-Copia-Cerca-Del-Limite": cercaDelLimite ? "1" : "0",
    },
  });
}

export const GET = conRegistroDeErrores(GET_, RUTA);
