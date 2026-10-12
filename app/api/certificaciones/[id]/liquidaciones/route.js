import { NextResponse } from "next/server";
import { conRegistroDeErrores } from "../../../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase } from "../../../../../lib/respuestasApi";
import { NO_ENCONTRADA_CERT, abrirSesion, pagosReferenciados } from "../../../../../lib/certificacionServidor";
import { esUuid } from "../../../../../lib/validacion";

const RUTA = "/api/certificaciones/[id]/liquidaciones";

// GET -> los pagos al equipo de esta certificación (de módulos y de
// pendientes), del más nuevo al más viejo, con el nombre de la persona y el
// número de módulo. Es la planilla de liquidaciones que se exporta en CSV.
async function GET_(request, { params }) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADA_CERT, 404);

  const [cert, modulos] = await Promise.all([
    supabase.from("certificaciones").select("id, nombre").eq("id", id).maybeSingle(),
    supabase.from("modulos").select("id, numero").eq("certificacion_id", id),
  ]);
  for (const r of [cert, modulos]) if (r.error) return errorDeBase(supabase, r.error, RUTA);
  if (!cert.data) return errorCliente(NO_ENCONTRADA_CERT, 404);

  const numeroDe = new Map(modulos.data.map((m) => [m.id, m.numero]));
  // Pagos de la certificación: los que tienen uno de sus módulos y los que cubren
  // alguno de sus encuentros o sesiones (los de "Liquidar pendientes" no tienen módulo).
  const referenciados = await pagosReferenciados(supabase, [...numeroDe.keys()]);
  if (referenciados.error) return errorDeBase(supabase, referenciados.error, RUTA);
  const columnas = "id, fecha_pago, monto, metodo_pago, descripcion, equipo_id, modulo_id, created_at, equipo(nombre), categorias_gasto(nombre)";
  const [deModulos, dePendientes] = await Promise.all([
    modulos.data.length
      ? supabase.from("pagos_gasto").select(columnas).in("modulo_id", [...numeroDe.keys()])
      : Promise.resolve({ data: [], error: null }),
    referenciados.data.size
      ? supabase.from("pagos_gasto").select(columnas).in("id", [...referenciados.data]).is("modulo_id", null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [deModulos, dePendientes]) if (r.error) return errorDeBase(supabase, r.error, RUTA);

  const pagos = [...deModulos.data, ...dePendientes.data]
    .map((p) => ({
      id: p.id,
      fecha_pago: p.fecha_pago,
      monto: Number(p.monto),
      metodo_pago: p.metodo_pago,
      descripcion: p.descripcion,
      equipo_id: p.equipo_id,
      persona: p.equipo?.nombre ?? "",
      categoria: p.categorias_gasto?.nombre ?? "",
      modulo: p.modulo_id ? (numeroDe.get(p.modulo_id) ?? null) : null,
      created_at: p.created_at,
    }))
    .sort((a, b) => b.fecha_pago.localeCompare(a.fecha_pago) || b.created_at.localeCompare(a.created_at));
  return NextResponse.json(pagos);
}

export const GET = conRegistroDeErrores(GET_, RUTA);
