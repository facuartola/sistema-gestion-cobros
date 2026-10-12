import { NextResponse } from "next/server";
import { conRegistroDeErrores } from "../../../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase, leerJson } from "../../../../../lib/respuestasApi";
import { hoyArgentinaISO } from "../../../../../lib/fechas";
import { validarLiquidacion } from "../../../../../lib/certificacionValidacion";
import { NO_ENCONTRADA_CERT, abrirSesion, pagosReferenciados } from "../../../../../lib/certificacionServidor";
import { esUuid } from "../../../../../lib/validacion";

const RUTA = "/api/certificaciones/[id]/liquidar-pendientes";
const COLUMNAS = "id, categoria_id, monto, fecha_pago, metodo_pago, descripcion, equipo_id";

// POST { fecha_pago?, metodo_pago } -> liquidar_pendientes: paga todo lo hecho y
// no pagado de la certificación sin cerrar ningún módulo. Devuelve
// { creados, pagos } con los pagos nuevos en Gastos (0 si no había nada).
async function POST_(request, { params }) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADA_CERT, 404);
  const { body, respuesta } = await leerJson(request);
  if (respuesta) return respuesta;

  const { datos, error } = validarLiquidacion(body, hoyArgentinaISO());
  if (error) return errorCliente(error);

  const { data: cert, error: errorCert } = await supabase.from("certificaciones").select("id, nombre").eq("id", id).maybeSingle();
  if (errorCert) return errorDeBase(supabase, errorCert, RUTA);
  if (!cert) return errorCliente(NO_ENCONTRADA_CERT, 404);

  const { data: modulos, error: errorModulos } = await supabase.from("modulos").select("id").eq("certificacion_id", id);
  if (errorModulos) return errorDeBase(supabase, errorModulos, RUTA);
  const ids = modulos.map((m) => m.id);
  const antes = await pagosReferenciados(supabase, ids);
  if (antes.error) return errorDeBase(supabase, antes.error, RUTA);

  const { data: creados, error: errorRpc } = await supabase.rpc("liquidar_pendientes", {
    p_certificacion_id: id,
    p_fecha_pago: datos.fecha_pago,
    p_metodo_pago: datos.metodo_pago,
  });
  if (errorRpc) return errorDeBase(supabase, errorRpc, RUTA);

  // Los pagos nuevos: los que ahora cubren ítems de la certificación y antes no.
  const despues = await pagosReferenciados(supabase, ids);
  if (despues.error) return errorDeBase(supabase, despues.error, RUTA);
  const nuevos = [...despues.data].filter((p) => !antes.data.has(p));
  const pagos = nuevos.length ? await supabase.from("pagos_gasto").select(COLUMNAS).in("id", nuevos).order("descripcion") : { data: [] };
  if (pagos.error) return errorDeBase(supabase, pagos.error, RUTA);
  return NextResponse.json({ creados, pagos: pagos.data.map((p) => ({ ...p, monto: Number(p.monto) })) });
}

export const POST = conRegistroDeErrores(POST_, RUTA);
