import { NextResponse } from "next/server";
import { supabaseForRequest } from "../../../lib/supabaseServer";
import { exigirSesion } from "../../../lib/apiAuth";
import { conRegistroDeErrores } from "../../../lib/registrarErrorServidor";
import { errorDeBase } from "../../../lib/respuestasApi";
import { hoyArgentinaISO, sumarMesesISO } from "../../../lib/fechas";
import { leerPagosVigentes } from "../../../lib/gastosServidor";
import { agruparPorDia } from "../../../lib/panorama";

const RUTA = "/api/panorama";

// Meses hacia atrás que se leen (el actual y 12 anteriores): alcanza para los
// últimos 6 meses, lo que va del año y la variación contra el mes anterior,
// incluso en enero.
const MESES_ATRAS = 12;

const aNumero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// GET -> { mes, desde, cobros, gastos, pagos }: la materia prima del panel de
// Inicio, de solo lectura y en UNA respuesta.
//  - cobros: la vista cobros_mensuales (cuotas pagadas por mes de la FECHA DE
//    PAGO, con origen y método). Cuenta también a los clientes dados de baja:
//    la plata entró.
//  - gastos: la vista gastos_mensuales_por_tipo (pagos por mes de la fecha de
//    pago, con la ruta completa del árbol).
//  - pagos: los pagos del año en curso en adelante, para saber qué gastos fijos
//    ya se pagaron (próximos vencimientos).
//  - diarios: lo cobrado y lo gastado por día, del 1 del mes anterior a hoy, para
//    comparar contra el mismo tramo del mes anterior.
// Las vistas respetan RLS (security_invoker): sin sesión, 401.
// Todo el cálculo (variaciones, repartos, proyección) está en lib/panorama.js.
async function GET_(request) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  if (rtaSesion) return rtaSesion;

  const hoy = hoyArgentinaISO();
  const mes = hoy.slice(0, 7);
  const desde = `${sumarMesesISO(mes, -MESES_ATRAS)}-01`;

  // Para comparar contra el mismo tramo del mes anterior hacen falta los
  // movimientos por día: del 1 del mes anterior a hoy (las vistas son mensuales).
  const desdeTramo = `${sumarMesesISO(mes, -1)}-01`;
  const [cobros, gastos, pagos, cuotasJugadores, cuotasAlumnos, pagosTramo] = await Promise.all([
    supabase.from("cobros_mensuales").select("mes, origen, metodo, total, cantidad").gte("mes", desde),
    supabase.from("gastos_mensuales_por_tipo").select("mes, categoria_id, ruta, nivel, total, cantidad").gte("mes", desde),
    leerPagosVigentes(supabase, hoy),
    supabase.from("cuotas_jugadores").select("fecha_pago, monto").eq("estado", "pagado").gte("fecha_pago", desdeTramo).lte("fecha_pago", hoy),
    supabase.from("cuotas_alumnos").select("fecha_pago, monto").eq("estado", "pagado").gte("fecha_pago", desdeTramo).lte("fecha_pago", hoy),
    supabase.from("pagos_gasto").select("fecha_pago, monto").gte("fecha_pago", desdeTramo).lte("fecha_pago", hoy),
  ]);
  for (const r of [cobros, gastos, pagos, cuotasJugadores, cuotasAlumnos, pagosTramo]) if (r.error) return errorDeBase(supabase, r.error, RUTA);

  return NextResponse.json({
    mes,
    desde,
    cobros: cobros.data.map((c) => ({ ...c, total: aNumero(c.total), cantidad: aNumero(c.cantidad) })),
    gastos: gastos.data.map((g) => ({ ...g, total: aNumero(g.total), cantidad: aNumero(g.cantidad), nivel: aNumero(g.nivel) })),
    pagos: pagos.data,
    diarios: {
      cobros: agruparPorDia([...cuotasJugadores.data, ...cuotasAlumnos.data]),
      gastos: agruparPorDia(pagosTramo.data),
    },
  });
}

export const GET = conRegistroDeErrores(GET_, RUTA);
