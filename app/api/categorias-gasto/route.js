import { NextResponse } from "next/server";
import { supabaseForRequest } from "../../../lib/supabaseServer";
import { exigirSesion } from "../../../lib/apiAuth";
import { conRegistroDeErrores } from "../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase, leerJson } from "../../../lib/respuestasApi";
import { hoyArgentinaISO } from "../../../lib/fechas";
import { gastosPorHacer } from "../../../lib/gastos";
import { validarCategoriaNueva } from "../../../lib/gastosValidacion";
import { COLUMNAS_CATEGORIA, MENSAJES_CATEGORIA, categoriaParaCliente, leerCategorias, leerPagosVigentes } from "../../../lib/gastosServidor";

const RUTA = "/api/categorias-gasto";

// GET -> { categorias, avisos }
//  - categorias: el árbol completo en filas planas, activas e inactivas (la
//    pantalla de administración muestra las dos).
//  - avisos: gastos fijos vencidos o que vencen en 7 días (indicador de la barra
//    lateral). Mismas reglas que "Para hacer hoy".
async function GET_(request) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  if (rtaSesion) return rtaSesion;

  const hoy = hoyArgentinaISO();
  const [categorias, pagos] = await Promise.all([leerCategorias(supabase), leerPagosVigentes(supabase, hoy)]);
  for (const r of [categorias, pagos]) if (r.error) return errorDeBase(supabase, r.error, RUTA);

  return NextResponse.json({
    categorias: categorias.data.map(categoriaParaCliente),
    avisos: gastosPorHacer({ categorias: categorias.data, pagos: pagos.data, hoy }),
  });
}

// POST -> crear una categoría { nombre, parent_id?, recurrencia?, monto_estimado?,
// dia_vencimiento?, mes_vencimiento? }. La profundidad máxima (3 niveles) se
// valida acá, no solo en la pantalla.
async function POST_(request) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  if (rtaSesion) return rtaSesion;
  const { body, respuesta } = await leerJson(request);
  if (respuesta) return respuesta;

  const { data: categorias, error: errorLectura } = await leerCategorias(supabase);
  if (errorLectura) return errorDeBase(supabase, errorLectura, RUTA);

  const { datos, error } = validarCategoriaNueva(body, categorias);
  if (error) return errorCliente(error);

  if (datos.parent_id) {
    const { count, error: errorPagos } = await supabase
      .from("pagos_gasto")
      .select("id", { count: "exact", head: true })
      .eq("categoria_id", datos.parent_id);
    if (errorPagos) return errorDeBase(supabase, errorPagos, RUTA);
    if (count > 0) {
      const padre = categorias.find((c) => c.id === datos.parent_id);
      return errorCliente(
        `“${padre.nombre}” ya tiene ${count} ${count === 1 ? "pago registrado" : "pagos registrados"}: no puede pasar a ser un grupo. Creala al mismo nivel o dentro de otra tipo de gasto.`
      );
    }
  }

  const hermanas = categorias.filter((c) => (c.parent_id ?? null) === datos.parent_id);
  const orden = hermanas.reduce((max, c) => Math.max(max, c.orden), 0) + 1;

  const { data, error: errorAlta } = await supabase
    .from("categorias_gasto")
    .insert({ ...datos, orden })
    .select(COLUMNAS_CATEGORIA)
    .single();
  if (errorAlta) return errorDeBase(supabase, errorAlta, RUTA, MENSAJES_CATEGORIA);
  return NextResponse.json(categoriaParaCliente(data), { status: 201 });
}

export const GET = conRegistroDeErrores(GET_, RUTA);
export const POST = conRegistroDeErrores(POST_, RUTA);
