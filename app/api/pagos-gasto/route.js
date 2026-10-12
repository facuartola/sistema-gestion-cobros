import { NextResponse } from "next/server";
import { supabaseForRequest } from "../../../lib/supabaseServer";
import { exigirSesion } from "../../../lib/apiAuth";
import { conRegistroDeErrores } from "../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase, leerJson } from "../../../lib/respuestasApi";
import { hoyArgentinaISO } from "../../../lib/fechas";
import { estadoActual, idsDelGrupo, indexar, totalesDePagos } from "../../../lib/gastos";
import { validarPago } from "../../../lib/gastosValidacion";
import { COLUMNAS_PAGO, MENSAJES_PAGO, leerCategorias, pagoParaCliente } from "../../../lib/gastosServidor";
import { esUuid } from "../../../lib/validacion";

const RUTA = "/api/pagos-gasto";
const LIMITE_HISTORIAL = 1000;

// GET ?categoria_id=<uuid> -> { pagos, totales, estado }
//  - pagos: el historial de esa categoría y, si es un grupo, de todas sus
//    subcategorías (sin categoria_id, el de todos los gastos), del más nuevo al
//    más viejo, cada uno con la ruta completa de su categoría.
//  - totales: lo pagado en el mes y en el año de hoy (por fecha de pago).
//  - estado: período actual de una categoría recurrente (pagado, pendiente o
//    vencido); null en el resto.
async function GET_(request) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  if (rtaSesion) return rtaSesion;

  const categoriaId = new URL(request.url).searchParams.get("categoria_id");
  if (categoriaId && !esUuid(categoriaId)) return errorCliente("El tipo de gasto pedido no es válido.");

  const { data: categorias, error: errorCategorias } = await leerCategorias(supabase);
  if (errorCategorias) return errorDeBase(supabase, errorCategorias, RUTA);
  const porId = indexar(categorias);
  const categoria = categoriaId ? porId.get(categoriaId) : null;
  if (categoriaId && !categoria) return errorCliente("No se encontró el tipo de gasto. Puede que ya se haya borrado.", 404);

  const ids = categoria ? idsDelGrupo(categoria.id, categorias) : null;
  const hoy = hoyArgentinaISO();
  const anio = hoy.slice(0, 4);

  let historial = supabase
    .from("pagos_gasto")
    .select(COLUMNAS_PAGO)
    .order("fecha_pago", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIMITE_HISTORIAL);
  let delAnio = supabase.from("pagos_gasto").select("monto, fecha_pago").gte("fecha_pago", `${anio}-01-01`).lte("fecha_pago", `${anio}-12-31`);
  if (ids) {
    historial = historial.in("categoria_id", ids);
    delAnio = delAnio.in("categoria_id", ids);
  }
  const [h, a] = await Promise.all([historial, delAnio]);
  for (const r of [h, a]) if (r.error) return errorDeBase(supabase, r.error, RUTA);

  return NextResponse.json({
    pagos: h.data.map((p) => pagoParaCliente(p, porId)),
    totales: totalesDePagos(a.data, hoy),
    estado: categoria ? estadoActual(categoria, h.data, hoy) : null,
    truncado: h.data.length >= LIMITE_HISTORIAL,
  });
}

// POST -> registrar un pago { categoria_id, fecha_pago?, monto, metodo_pago,
// proveedor?, descripcion?, periodo? }. El comprobante se sube después, con
// POST /api/pagos-gasto/[id]/comprobante.
async function POST_(request) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  if (rtaSesion) return rtaSesion;
  const { body, respuesta } = await leerJson(request);
  if (respuesta) return respuesta;

  const { data: categorias, error: errorCategorias } = await leerCategorias(supabase);
  if (errorCategorias) return errorDeBase(supabase, errorCategorias, RUTA);
  const porId = indexar(categorias);
  const categoria = esUuid(body.categoria_id) ? porId.get(body.categoria_id) : null;

  const { datos, error } = validarPago(body, categoria, hoyArgentinaISO());
  if (error) return errorCliente(error);
  if (categorias.some((c) => c.parent_id === categoria.id && c.activo)) {
    return errorCliente(`“${categoria.nombre}” es un grupo: elegí uno de sus subtipos para registrar el pago.`);
  }

  const { data, error: errorAlta } = await supabase.from("pagos_gasto").insert(datos).select(COLUMNAS_PAGO).single();
  if (errorAlta) return errorDeBase(supabase, errorAlta, RUTA, MENSAJES_PAGO);
  return NextResponse.json(pagoParaCliente(data, porId), { status: 201 });
}

export const GET = conRegistroDeErrores(GET_, RUTA);
export const POST = conRegistroDeErrores(POST_, RUTA);
