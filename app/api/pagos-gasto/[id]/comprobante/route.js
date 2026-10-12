import { NextResponse } from "next/server";
import { supabaseForRequest } from "../../../../../lib/supabaseServer";
import { exigirSesion } from "../../../../../lib/apiAuth";
import { conRegistroDeErrores, registrarErrorServidor } from "../../../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase } from "../../../../../lib/respuestasApi";
import {
  COMPROBANTE,
  esRutaDeComprobante,
  rutaComprobante,
  tipoPorContenido,
  validarComprobante,
} from "../../../../../lib/gastosValidacion";
import { BUCKET_COMPROBANTES, NO_ENCONTRADO_PAGO } from "../../../../../lib/gastosServidor";
import { esUuid } from "../../../../../lib/validacion";

const RUTA = "/api/pagos-gasto/[id]/comprobante";
// Segundos que vive el enlace al comprobante: alcanza para abrirlo y no más.
const VIGENCIA_URL_S = 60;

async function abrir(request, params) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  if (rtaSesion) return { rtaSesion };
  const { id } = await params;
  if (!esUuid(id)) return { rtaSesion: errorCliente(NO_ENCONTRADO_PAGO, 404) };
  const { data: pago, error } = await supabase.from("pagos_gasto").select("id, comprobante_path").eq("id", id).maybeSingle();
  if (error) return { rtaSesion: await errorDeBase(supabase, error, RUTA) };
  if (!pago) return { rtaSesion: errorCliente(NO_ENCONTRADO_PAGO, 404) };
  return { supabase, pago };
}

async function avisarArchivoHuerfano(supabase, ruta, mensaje) {
  await registrarErrorServidor(supabase, { mensaje: `${mensaje} (${ruta})`, stack: null, ruta: RUTA });
}

// GET -> { url, vigencia }: URL firmada de corta duración para ver el
// comprobante. El bucket nunca es público.
async function GET_(request, { params }) {
  const { supabase, pago, rtaSesion } = await abrir(request, params);
  if (rtaSesion) return rtaSesion;
  if (!pago.comprobante_path) return errorCliente("Este pago no tiene comprobante.", 404);

  const { data, error } = await supabase.storage.from(BUCKET_COMPROBANTES).createSignedUrl(pago.comprobante_path, VIGENCIA_URL_S);
  if (error || !data?.signedUrl) {
    await registrarErrorServidor(supabase, {
      mensaje: `No se pudo firmar el comprobante ${pago.comprobante_path}: ${error?.message ?? "sin URL"}`,
      stack: null,
      ruta: RUTA,
    });
    return errorCliente("No se pudo abrir el comprobante. Puede que el archivo ya no esté.", 404);
  }
  return NextResponse.json({ url: data.signedUrl, vigencia: VIGENCIA_URL_S });
}

// POST (multipart, campo "archivo") -> sube el comprobante y lo deja asociado al
// pago, reemplazando el anterior si había. Valida tipo y tamaño y, además, que los
// primeros bytes sean de verdad una foto o un PDF.
async function POST_(request, { params }) {
  const { supabase, pago, rtaSesion } = await abrir(request, params);
  if (rtaSesion) return rtaSesion;

  // Corta antes de leer un cuerpo enorme.
  const largo = Number(request.headers.get("content-length") || 0);
  if (largo > COMPROBANTE.maxBytes + 512 * 1024) {
    return errorCliente("El archivo supera los 5 MB. Probá con una foto más liviana o comprimí el PDF.", 413);
  }

  let archivo;
  try {
    archivo = (await request.formData()).get("archivo");
  } catch {
    return errorCliente("No se pudo leer el archivo enviado.");
  }
  if (!archivo || typeof archivo === "string") return errorCliente("Elegí un archivo para subir.");

  const { extension, error } = validarComprobante(archivo);
  if (error) return errorCliente(error);
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  if (tipoPorContenido(bytes) !== archivo.type) {
    return errorCliente("El contenido del archivo no coincide con su tipo. Subí una foto (JPG, PNG, WebP) o un PDF.");
  }

  const ruta = rutaComprobante(pago.id, extension);
  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_COMPROBANTES)
    .upload(ruta, bytes, { contentType: archivo.type, upsert: false });
  if (errorSubida) {
    await registrarErrorServidor(supabase, { mensaje: `Falló la subida del comprobante: ${errorSubida.message}`, stack: null, ruta: RUTA });
    return errorCliente("No se pudo subir el comprobante. Probá de nuevo en un momento.", 500);
  }

  const { error: errorPago } = await supabase.from("pagos_gasto").update({ comprobante_path: ruta }).eq("id", pago.id);
  if (errorPago) {
    // El pago no quedó apuntando al archivo: se retira para no dejar basura.
    const { error: errorRetiro } = await supabase.storage.from(BUCKET_COMPROBANTES).remove([ruta]);
    if (errorRetiro) await avisarArchivoHuerfano(supabase, ruta, "Comprobante huérfano tras un error al guardar");
    return errorDeBase(supabase, errorPago, RUTA);
  }

  if (pago.comprobante_path && esRutaDeComprobante(pago.comprobante_path, pago.id) && pago.comprobante_path !== ruta) {
    const { error: errorViejo } = await supabase.storage.from(BUCKET_COMPROBANTES).remove([pago.comprobante_path]);
    if (errorViejo) await avisarArchivoHuerfano(supabase, pago.comprobante_path, "No se pudo borrar el comprobante reemplazado");
  }
  return NextResponse.json({ ok: true, tiene_comprobante: true }, { status: 201 });
}

// DELETE -> quita el comprobante del pago y borra el archivo.
async function DELETE_(request, { params }) {
  const { supabase, pago, rtaSesion } = await abrir(request, params);
  if (rtaSesion) return rtaSesion;
  if (!pago.comprobante_path) return NextResponse.json({ ok: true, tiene_comprobante: false });

  const { error } = await supabase.from("pagos_gasto").update({ comprobante_path: null }).eq("id", pago.id);
  if (error) return errorDeBase(supabase, error, RUTA);
  const { error: errorArchivo } = await supabase.storage.from(BUCKET_COMPROBANTES).remove([pago.comprobante_path]);
  if (errorArchivo) await avisarArchivoHuerfano(supabase, pago.comprobante_path, "No se pudo borrar el comprobante quitado");
  return NextResponse.json({ ok: true, tiene_comprobante: false });
}

export const GET = conRegistroDeErrores(GET_, RUTA);
export const POST = conRegistroDeErrores(POST_, RUTA);
export const DELETE = conRegistroDeErrores(DELETE_, RUTA);
