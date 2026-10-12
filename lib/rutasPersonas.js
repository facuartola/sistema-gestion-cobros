import { NextResponse } from "next/server";
import { supabaseForRequest } from "./supabaseServer";
import { hoyArgentinaISO, mesArgentinaDe } from "./fechas";
import { parseCamposCliente, validarNombre } from "./camposCliente";
import { exigirSesion } from "./apiAuth";
import { resumenHistoricoPorPersona } from "./historialCuotas";
import { mesesAdeudados } from "./deuda";
import { conRegistroDeErrores } from "./registrarErrorServidor";
import { errorCliente, errorDeBase, leerJson } from "./respuestasApi";
import { LIMITES, errorFechaDePago, errorMesDeCuota, esFechaISO, esMesISO, esUuid, normalizarMesCuota, parseMetodoPago } from "./validacion";

// Jugadores y alumnos comparten exactamente las mismas rutas (listar, crear,
// editar, borrar, registrar cuota). Antes eran seis archivos casi idénticos,
// y cualquier arreglo había que hacerlo dos veces — con el riesgo de que las
// rutas hermanas terminaran validando distinto. Ahora las dos salen de acá;
// lo único que cambia por tipo está en CONFIG.
const CONFIG = {
  jugador: { tabla: "jugadores", tablaCuotas: "cuotas_jugadores", columna: "jugador_id", esAlumno: false },
  alumno: { tabla: "alumnos", tablaCuotas: "cuotas_alumnos", columna: "alumno_id", esAlumno: true },
};

const NO_ENCONTRADO = "No se encontró la persona. Puede que ya se haya borrado.";

async function abrir(request) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  return { supabase, rtaSesion };
}

// fecha_inicio solo existe en alumnos. Ausente = no se toca; "" o null = se borra.
function parseFechaInicio(body) {
  if (body.fecha_inicio === undefined) return {};
  if (body.fecha_inicio === null || body.fecha_inicio === "") return { campos: { fecha_inicio: null } };
  if (!esFechaISO(body.fecha_inicio)) return { error: "La fecha de inicio no es válida." };
  return { campos: { fecha_inicio: body.fecha_inicio } };
}

export function rutasColeccion(tipo) {
  const cfg = CONFIG[tipo];
  const ruta = `/api/${cfg.tabla}`;

  // GET ?mes=YYYY-MM&incluir_inactivos=1 -> personas con su cuota de ese mes
  async function GET(request) {
    const { supabase, rtaSesion } = await abrir(request);
    if (rtaSesion) return rtaSesion;

    const { searchParams } = new URL(request.url);
    const mesParam = searchParams.get("mes");
    if (mesParam && !esMesISO(mesParam)) return errorCliente("El mes pedido no es válido.");
    const incluirInactivos = searchParams.get("incluir_inactivos") === "1";

    let query = supabase.from(cfg.tabla).select("*").order("nombre");
    if (!incluirInactivos) query = query.eq("activo", true);
    const { data: personas, error } = await query;
    if (error) return errorDeBase(supabase, error, ruta);

    const mesActual = hoyArgentinaISO().slice(0, 7);
    const mesConsultado = `${mesParam || mesActual}-01`;

    const { data: cuotas, error: errorCuotas } = await supabase
      .from(cfg.tablaCuotas)
      .select("*")
      .eq("mes", mesConsultado);
    // Si esta consulta falla no podemos seguir: mostraríamos a todos como
    // "pendiente" aunque hayan pagado, un dato silenciosamente incorrecto.
    if (errorCuotas) return errorDeBase(supabase, errorCuotas, ruta);

    const cuotaPorPersona = Object.fromEntries((cuotas || []).map((c) => [c[cfg.columna], c]));

    const ahora = new Date();
    const {
      mesesPagadosPorPersona = {},
      totalAbonadoPorPersona = {},
      totalAnioPorPersona = {},
      error: errorHistorial,
    } = await resumenHistoricoPorPersona(supabase, cfg.tablaCuotas, cfg.columna, Number(mesActual.slice(0, 4)));
    if (errorHistorial) return errorDeBase(supabase, errorHistorial, ruta);

    const resultado = personas.map((p) => ({
      ...p,
      cuota_actual: cuotaPorPersona[p.id] || null,
      total_abonado: totalAbonadoPorPersona[p.id] || 0,
      total_anio: totalAnioPorPersona[p.id] || 0,
      // La deuda cuenta desde fecha_inicio si el alumno la tiene cargada
      // (cuándo arrancó de verdad) o, si no, desde created_at (cuándo se lo
      // cargó). Los jugadores no tienen fecha_inicio.
      meses_adeudados: mesesAdeudados({
        mesInicio: p.fecha_inicio ? p.fecha_inicio.slice(0, 7) : mesArgentinaDe(p.created_at),
        mesActual,
        mesesPagados: mesesPagadosPorPersona[p.id] || new Set(),
        diaVencimiento: p.dia_vencimiento,
        ahora,
      }),
    }));

    return NextResponse.json(resultado);
  }

  // POST -> alta de una persona
  async function POST(request) {
    const { supabase, rtaSesion } = await abrir(request);
    if (rtaSesion) return rtaSesion;
    const { body, respuesta } = await leerJson(request);
    if (respuesta) return respuesta;

    const { nombre, error: errorNombre } = validarNombre(body.nombre);
    if (errorNombre) return errorCliente(errorNombre);

    const { updates: campos, error: errorCampos } = parseCamposCliente(body, { esAlumno: cfg.esAlumno });
    if (errorCampos) return errorCliente(errorCampos);

    let extra = {};
    if (cfg.esAlumno) {
      const { campos: fi, error: errorFecha } = parseFechaInicio(body);
      if (errorFecha) return errorCliente(errorFecha);
      extra = fi || {};
    }

    const { data, error } = await supabase
      .from(cfg.tabla)
      .insert({ nombre, ...campos, ...extra })
      .select()
      .single();
    if (error) return errorDeBase(supabase, error, ruta);

    return NextResponse.json(data, { status: 201 });
  }

  return {
    GET: conRegistroDeErrores(GET, ruta),
    POST: conRegistroDeErrores(POST, ruta),
  };
}

export function rutasItem(tipo) {
  const cfg = CONFIG[tipo];
  const ruta = `/api/${cfg.tabla}/[id]`;

  // PATCH -> editar nombre, activo y campos de cliente
  async function PATCH(request, { params }) {
    const { supabase, rtaSesion } = await abrir(request);
    if (rtaSesion) return rtaSesion;
    // await funciona igual con params objeto (Next 14) o Promise (Next 15+).
    const { id } = await params;
    if (!esUuid(id)) return errorCliente(NO_ENCONTRADO, 404);
    const { body, respuesta } = await leerJson(request);
    if (respuesta) return respuesta;

    const updates = {};
    if (body.nombre !== undefined) {
      const { nombre, error: errorNombre } = validarNombre(body.nombre);
      if (errorNombre) return errorCliente(errorNombre);
      updates.nombre = nombre;
    }
    if (typeof body.activo === "boolean") updates.activo = body.activo;

    const { updates: campos, error: errorCampos } = parseCamposCliente(body, { esAlumno: cfg.esAlumno });
    if (errorCampos) return errorCliente(errorCampos);
    Object.assign(updates, campos);

    if (cfg.esAlumno) {
      const { campos: fi, error: errorFecha } = parseFechaInicio(body);
      if (errorFecha) return errorCliente(errorFecha);
      Object.assign(updates, fi || {});
    }

    if (Object.keys(updates).length === 0) return errorCliente("No hay nada para actualizar.");

    const { data, error } = await supabase.from(cfg.tabla).update(updates).eq("id", id).select().single();
    if (error) {
      if (error.code === "PGRST116") return errorCliente(NO_ENCONTRADO, 404);
      return errorDeBase(supabase, error, ruta);
    }
    return NextResponse.json(data);
  }

  // DELETE -> borra la persona y sus cuotas (ON DELETE CASCADE en la base).
  // Borrar algo que ya no existe no es un error: el resultado es el mismo.
  async function DELETE(request, { params }) {
    const { supabase, rtaSesion } = await abrir(request);
    if (rtaSesion) return rtaSesion;
    const { id } = await params;
    if (!esUuid(id)) return errorCliente(NO_ENCONTRADO, 404);

    const { error } = await supabase.from(cfg.tabla).delete().eq("id", id);
    if (error) return errorDeBase(supabase, error, ruta);
    return NextResponse.json({ ok: true });
  }

  return {
    PATCH: conRegistroDeErrores(PATCH, ruta),
    DELETE: conRegistroDeErrores(DELETE, ruta),
  };
}

export function rutaCuotas(tipo) {
  const cfg = CONFIG[tipo];
  const ruta = `/api/${cfg.tabla}/[id]/cuotas`;

  // POST -> registrar o actualizar la cuota de un mes
  // body: { mes: "YYYY-MM" | "YYYY-MM-DD", monto, estado: "pagado"|"pendiente", fecha_pago?: "YYYY-MM-DD",
  //         metodo_pago?: "efectivo"|"transferencia"|null }
  async function POST(request, { params }) {
    const { supabase, rtaSesion } = await abrir(request);
    if (rtaSesion) return rtaSesion;
    const { id } = await params;
    if (!esUuid(id)) return errorCliente(NO_ENCONTRADO, 404);
    const { body, respuesta } = await leerJson(request);
    if (respuesta) return respuesta;

    const mes = normalizarMesCuota(body.mes);
    if (!mes) return errorCliente("Falta el mes de la cuota, o no es válido.");
    const errorMes = errorMesDeCuota(mes, hoyArgentinaISO().slice(0, 7));
    if (errorMes) return errorCliente(errorMes);

    if (!["pagado", "pendiente"].includes(body.estado)) {
      return errorCliente("El estado de la cuota tiene que ser pagado o pendiente.");
    }

    const monto = Number(body.monto);
    if (body.monto === null || body.monto === "" || !Number.isFinite(monto) || monto < 0) {
      return errorCliente("El monto tiene que ser un número válido.");
    }
    if (monto > LIMITES.montoMaximo) {
      return errorCliente("El monto es demasiado alto. Revisá que no sobre ningún cero.");
    }

    // Pagado: se respeta una fecha explícita (cargar un pago del día que
    // ocurrió de verdad) o, si no viene, hoy en hora Argentina. Pendiente:
    // nunca tiene fecha de pago, aunque el cliente mande una.
    let fechaPago = null;
    if (body.estado === "pagado") {
      if (body.fecha_pago != null && body.fecha_pago !== "" && !esFechaISO(body.fecha_pago)) {
        return errorCliente("La fecha de pago no es válida.");
      }
      fechaPago = body.fecha_pago || hoyArgentinaISO();
      const errorFecha = errorFechaDePago(fechaPago, hoyArgentinaISO());
      if (errorFecha) return errorCliente(errorFecha);
    }

    // Método de pago: ausente = no se toca el que ya tenía la cuota; null o ""
    // = sin método. Una cuota pendiente nunca tiene método.
    const { metodo, error: errorMetodo } = parseMetodoPago(body.metodo_pago);
    if (errorMetodo) return errorCliente(errorMetodo);
    const extra = body.estado === "pendiente" ? { metodo_pago: null } : metodo;

    const { data, error } = await supabase
      .from(cfg.tablaCuotas)
      .upsert(
        { [cfg.columna]: id, mes, monto, estado: body.estado, fecha_pago: fechaPago, ...extra },
        { onConflict: `${cfg.columna},mes` }
      )
      .select()
      .single();
    if (error) {
      if (error.code === "23503") return errorCliente(NO_ENCONTRADO, 404);
      return errorDeBase(supabase, error, ruta);
    }
    return NextResponse.json(data);
  }

  // GET -> las últimas cuotas de la persona (de la más nueva a la más vieja),
  // para el panel de Cobros. ?limite=N (hasta 24, por defecto 6).
  async function GET(request, { params }) {
    const { supabase, rtaSesion } = await abrir(request);
    if (rtaSesion) return rtaSesion;
    const { id } = await params;
    if (!esUuid(id)) return errorCliente(NO_ENCONTRADO, 404);
    const limite = Math.min(24, Math.max(1, Number(new URL(request.url).searchParams.get("limite")) || 6));

    const { data, error } = await supabase
      .from(cfg.tablaCuotas)
      .select("mes, monto, estado, fecha_pago, metodo_pago")
      .eq(cfg.columna, id)
      .order("mes", { ascending: false })
      .limit(limite);
    if (error) return errorDeBase(supabase, error, ruta);
    return NextResponse.json(data || []);
  }

  return { GET: conRegistroDeErrores(GET, ruta), POST: conRegistroDeErrores(POST, ruta) };
}
