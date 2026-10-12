import { NextResponse } from "next/server";
import { supabaseForRequest } from "../../../lib/supabaseServer";
import { exigirSesion } from "../../../lib/apiAuth";
import { conRegistroDeErrores, registrarErrorServidor } from "../../../lib/registrarErrorServidor";
import { leerResumenCertificaciones } from "../../../lib/certificacionResumen";
import { errorCliente, errorDeBase } from "../../../lib/respuestasApi";
import { diasDelMes, hoyArgentinaISO, sumarDiasISO } from "../../../lib/fechas";
import { esMesISO } from "../../../lib/validacion";
import { gastosPorHacer } from "../../../lib/gastos";
import { armarSerie, cobradoPorFechaDePago, gastosPorPagar, mesesHasta, proximosVencimientos, ultimosMovimientos } from "../../../lib/resumen";

const RUTA = "/api/resumen";

// GET /api/resumen?mes=YYYY-MM
// Lo que Inicio necesita y no sale de las listas de personas:
//  - serie: cobrado y gastado de los 6 meses que terminan en `mes`.
//    Cobrado y gastado cuentan por fecha de pago: es la plata que entró (o salió)
//    ese mes, aunque la cuota sea de otro. Las tablas de Jugadores y Alumnos
//    siguen por mes de la cuota.
//  - cobradoAnio: lo cobrado en el año de `mes`, por fecha de pago.
//  - gastosPorPagar: categorías de gasto con vencimiento este mes y sin pago.
//    Siempre del mes real de hoy, no del mes elegido en pantalla.
//  - gastos: gastos fijos vencidos o que vencen en 7 días (alimenta "Para hacer hoy").
//  - proximos: cobros y gastos fijos que vencen de mañana a 7 días.
//  - movimientos: los últimos 6 cobros y pagos registrados.
//  - certificaciones: por cada certificación en curso, módulo en curso, alumnos en
//    condiciones, lo pendiente de pagar al equipo, módulos listos para liquidar
//    (estado_modulos + calcular_liquidacion), pagos tardíos y alumnos que
//    acaban de completar las 10 sesiones. null si no se pudo leer.
// Solo lee: no modifica nada.
async function GET(request) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  if (rtaSesion) return rtaSesion;

  const hoy = hoyArgentinaISO();
  const mesParam = new URL(request.url).searchParams.get("mes");
  if (mesParam && !esMesISO(mesParam)) return errorCliente("El mes pedido no es válido.");
  const mes = mesParam || hoy.slice(0, 7);

  const meses = mesesHasta(mes, 6);
  const desde = `${meses[0]}-01`;
  const hasta = `${meses[5]}-${String(diasDelMes(meses[5])).padStart(2, "0")}`;
  // Para decidir qué falta pagar hace falta mirar también el año en curso.
  const desdePagos = desde < `${hoy.slice(0, 4)}-01-01` ? desde : `${hoy.slice(0, 4)}-01-01`;
  const anio = mes.slice(0, 4);
  // Por fecha de pago; si una cuota pagada no la tuviera, cuenta por su mes.
  const filtroCobrado = `and(fecha_pago.gte.${desde},fecha_pago.lte.${hasta}),and(fecha_pago.is.null,mes.gte.${desde},mes.lte.${hasta})`;
  // Meses que tocan los próximos 7 días (el actual y, a fin de mes, el siguiente).
  const mesesProximos = [...new Set([hoy.slice(0, 7), sumarDiasISO(hoy, 7).slice(0, 7)])];

  const [jugadores, alumnos, pagos, categorias, cobradoJ, cobradoA, personasJ, personasA, pagadasJ, pagadasA, ultCobrosJ, ultCobrosA, ultPagos] =
    await Promise.all([
      supabase.from("cuotas_jugadores").select("mes, monto, fecha_pago").eq("estado", "pagado").or(filtroCobrado),
      supabase.from("cuotas_alumnos").select("mes, monto, fecha_pago").eq("estado", "pagado").or(filtroCobrado),
      supabase
        .from("pagos_gasto")
        .select("categoria_id, monto, fecha_pago, periodo")
        .or(`fecha_pago.gte.${desdePagos},periodo.gte.${desdePagos}`),
      supabase
        .from("categorias_gasto")
        .select("id, nombre, parent_id, orden, recurrencia, monto_estimado, dia_vencimiento, mes_vencimiento, activo, created_at"),
      supabase.from("cuotas_jugadores").select("monto").eq("estado", "pagado").gte("fecha_pago", `${anio}-01-01`).lte("fecha_pago", `${anio}-12-31`),
      supabase.from("cuotas_alumnos").select("monto").eq("estado", "pagado").gte("fecha_pago", `${anio}-01-01`).lte("fecha_pago", `${anio}-12-31`),
      supabase.from("jugadores").select("id, nombre, dia_vencimiento, monto_mensual").eq("activo", true),
      supabase.from("alumnos").select("id, nombre, dia_vencimiento, monto_mensual").eq("activo", true),
      supabase.from("cuotas_jugadores").select("jugador_id, mes").eq("estado", "pagado").in("mes", mesesProximos.map((m) => `${m}-01`)),
      supabase.from("cuotas_alumnos").select("alumno_id, mes").eq("estado", "pagado").in("mes", mesesProximos.map((m) => `${m}-01`)),
      supabase
        .from("cuotas_jugadores")
        .select("id, monto, fecha_pago, metodo_pago, created_at, jugadores(nombre)")
        .eq("estado", "pagado")
        .not("fecha_pago", "is", null)
        .order("fecha_pago", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("cuotas_alumnos")
        .select("id, monto, fecha_pago, metodo_pago, created_at, alumnos(nombre)")
        .eq("estado", "pagado")
        .not("fecha_pago", "is", null)
        .order("fecha_pago", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("pagos_gasto")
        .select("id, monto, fecha_pago, metodo_pago, created_at, descripcion, categorias_gasto(nombre)")
        .order("fecha_pago", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6),
    ]);
  for (const r of [jugadores, alumnos, pagos, categorias, cobradoJ, cobradoA, personasJ, personasA, pagadasJ, pagadasA, ultCobrosJ, ultCobrosA, ultPagos]) {
    if (r.error) return errorDeBase(supabase, r.error, RUTA);
  }

  const cobradoPorMes = cobradoPorFechaDePago([...jugadores.data, ...alumnos.data], meses);
  const porMes = new Map(meses.map((m, i) => [m, { mes: m, cobrado: cobradoPorMes[i], gastado: 0 }]));
  for (const p of pagos.data) {
    const fila = porMes.get(p.fecha_pago.slice(0, 7));
    if (fila) fila.gastado += Number(p.monto);
  }

  const cobradoAnio = [...cobradoJ.data, ...cobradoA.data].reduce((acc, c) => acc + Number(c.monto), 0);

  const pagadas = new Set([
    ...pagadasJ.data.map((c) => `jugador-${c.jugador_id}-${c.mes.slice(0, 7)}`),
    ...pagadasA.data.map((c) => `alumno-${c.alumno_id}-${c.mes.slice(0, 7)}`),
  ]);
  const personas = [
    ...personasJ.data.map((p) => ({ ...p, tipo: "jugador" })),
    ...personasA.data.map((p) => ({ ...p, tipo: "alumno" })),
  ];

  const movimientos = ultimosMovimientos(
    [
      ...ultCobrosJ.data.map((c) => ({ ...c, nombre: c.jugadores?.nombre ?? "Jugador" })),
      ...ultCobrosA.data.map((c) => ({ ...c, id: `a-${c.id}`, nombre: c.alumnos?.nombre ?? "Alumno" })),
    ],
    ultPagos.data.map((p) => ({ ...p, nombre: p.categorias_gasto?.nombre ?? p.descripcion ?? "Gasto" }))
  );

  // La certificación falla por separado: si no se puede leer, Inicio igual
  // muestra cobros y gastos (y el error queda en errores_app).
  const certs = await leerResumenCertificaciones(supabase, hoy);
  if (certs.error) {
    await registrarErrorServidor(supabase, {
      mensaje: `[${certs.error.code || "sin código"}] ${certs.error.message || "No se pudo leer la certificación"}`,
      stack: null,
      ruta: RUTA,
    });
  }

  return NextResponse.json({
    mes,
    serie: armarSerie(meses, [...porMes.values()]),
    cobradoAnio: { anio, total: cobradoAnio },
    gastosPorPagar: gastosPorPagar({ categorias: categorias.data, pagos: pagos.data, hoy }),
    gastos: gastosPorHacer({ categorias: categorias.data, pagos: pagos.data, hoy }),
    proximos: proximosVencimientos({ personas, pagadas, categorias: categorias.data, pagos: pagos.data, hoy }),
    movimientos,
    certificaciones: certs.error ? null : certs.data,
  });
}

const manejador = conRegistroDeErrores(GET, RUTA);
export { manejador as GET };
