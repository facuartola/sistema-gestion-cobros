import { NextResponse } from "next/server";
import { conRegistroDeErrores } from "../../../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase, leerJson } from "../../../../../lib/respuestasApi";
import { hoyArgentinaISO } from "../../../../../lib/fechas";
import { validarLiquidacion } from "../../../../../lib/certificacionValidacion";
import { NO_ENCONTRADO_MODULO, abrirSesion } from "../../../../../lib/certificacionServidor";
import { esUuid } from "../../../../../lib/validacion";

const RUTA = "/api/modulos/[id]/liquidar";

// POST { fecha_pago?, metodo_pago } -> liquidar_modulo: en una sola transacción
// crea los pagos en Gastos, marca lo pagado y cierra el módulo. La base impide
// liquidar dos veces ("Este módulo ya fue liquidado", 409).
// Devuelve { creados, pagos } con los pagos de ese módulo.
async function POST_(request, { params }) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADO_MODULO, 404);
  const { body, respuesta } = await leerJson(request);
  if (respuesta) return respuesta;

  const { datos, error } = validarLiquidacion(body, hoyArgentinaISO());
  if (error) return errorCliente(error);

  const { data: creados, error: errorRpc } = await supabase.rpc("liquidar_modulo", {
    p_modulo_id: id,
    p_fecha_pago: datos.fecha_pago,
    p_metodo_pago: datos.metodo_pago,
  });
  if (errorRpc) return errorDeBase(supabase, errorRpc, RUTA);

  const { data: pagos, error: errorPagos } = await supabase
    .from("pagos_gasto")
    .select("id, categoria_id, monto, fecha_pago, metodo_pago, descripcion, equipo_id")
    .eq("modulo_id", id)
    .order("descripcion");
  if (errorPagos) return errorDeBase(supabase, errorPagos, RUTA);
  return NextResponse.json({ creados, pagos: pagos.map((p) => ({ ...p, monto: Number(p.monto) })) });
}

export const POST = conRegistroDeErrores(POST_, RUTA);
