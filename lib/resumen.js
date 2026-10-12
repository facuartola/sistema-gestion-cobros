// Cálculos de la pantalla de Inicio, todos puros (sin red ni React) para poder
// probarlos. Los datos llegan de /api/resumen (gastos, cobros por mes) y de
// las listas de personas y recordatorios que la app ya cargaba.
import { cuotaAtrasada, diasDelMes, sumarDiasISO, sumarMesesISO } from "./fechas";
import { SEPARADOR_RUTA, esAnteriorAlSistema, gastosPorHacer, vencimientoDelPeriodo } from "./gastos";
import { formatoDolares } from "./moneda";

// Los últimos `cantidad` meses terminando en `mes`, del más viejo al más nuevo.
export function mesesHasta(mes, cantidad = 6) {
  return Array.from({ length: cantidad }, (_, i) => sumarMesesISO(mes, i - (cantidad - 1)));
}

const NOMBRES_MES = new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" });
const NOMBRES_MES_CORTO = new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" });

function fechaDeMes(mes) {
  const [anio, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(anio, m - 1, 1));
}

// "septiembre" a partir de "2026-09".
export function nombreMes(mes) {
  return NOMBRES_MES.format(fechaDeMes(mes));
}

// "Octubre 2026" a partir de "2026-10" (para el selector de mes).
export function mesLabelCorto(mes) {
  const n = nombreMes(mes);
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} ${mes.slice(0, 4)}`;
}

// "Sep" a partir de "2026-09" (sin el punto que agrega Intl).
export function mesCorto(mes) {
  const t = NOMBRES_MES_CORTO.format(fechaDeMes(mes)).replace(".", "").slice(0, 3);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Días entre dos "YYYY-MM-DD" (b menos a), aritmética de calendario pura.
export function diasEntre(a, b) {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

export function iniciales(nombre) {
  const palabras = String(nombre ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (palabras.length === 0) return "?";
  const letras = palabras.length === 1 ? palabras[0].slice(0, 1) : palabras[0].slice(0, 1) + palabras[1].slice(0, 1);
  return letras.toUpperCase();
}

// Fondos oscuros de los avatares (los de la referencia y algunos más). Todos
// llevan texto --tinta; lib/contraste.test.js verifica que lleguen a AA.
export const COLORES_AVATAR = ["#4A3770", "#2A4E6B", "#6B4434", "#2A3B5C", "#2F5A4A", "#5A3A52"];

export function colorAvatar(nombre) {
  let h = 0;
  for (const c of String(nombre ?? "")) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return COLORES_AVATAR[h % COLORES_AVATAR.length];
}

// --- Gastos por pagar -------------------------------------------------------

// Categorías de gasto con vencimiento este mes y sin pago registrado:
//  - mensuales sin pago en el mes actual;
//  - anuales cuyo mes de vencimiento es el actual y sin pago en el año.
// Un pago cuenta para el período que dice `periodo`; si no tiene (pago suelto),
// cuenta para el mes (o año) de su fecha de pago.
export function gastosPorPagar({ categorias, pagos, hoy }) {
  categorias = Array.isArray(categorias) ? categorias : [];
  pagos = Array.isArray(pagos) ? pagos : [];
  const mesActual = hoy.slice(0, 7);
  const anio = hoy.slice(0, 4);
  const numeroMes = Number(hoy.slice(5, 7));

  const items = [];
  for (const c of categorias) {
    if (!c.activo) continue;
    const propios = pagos.filter((p) => p.categoria_id === c.id);
    let pendiente = false;
    if (c.recurrencia === "mensual") {
      pendiente = !propios.some((p) => (p.periodo || p.fecha_pago).slice(0, 7) === mesActual);
    } else if (c.recurrencia === "anual" && Number(c.mes_vencimiento) === numeroMes) {
      pendiente = !propios.some((p) => (p.periodo || p.fecha_pago).slice(0, 4) === anio);
    }
    // Un vencimiento de antes de usar el sistema no se puede dar por pendiente.
    if (pendiente && esAnteriorAlSistema(c, vencimientoDelPeriodo(c, c.recurrencia === "anual" ? `${anio}-01-01` : `${mesActual}-01`))) {
      pendiente = false;
    }
    if (!pendiente) continue;
    items.push({
      id: c.id,
      nombre: c.nombre,
      monto: c.monto_estimado == null ? null : Number(c.monto_estimado),
      dia: c.dia_vencimiento == null ? null : Number(c.dia_vencimiento),
      recurrencia: c.recurrencia,
    });
  }
  items.sort((a, b) => (a.dia ?? 99) - (b.dia ?? 99) || a.nombre.localeCompare(b.nombre, "es"));

  const conMonto = items.filter((i) => i.monto != null);
  return {
    items,
    total: conMonto.reduce((acc, i) => acc + i.monto, 0),
    conMonto: conMonto.length,
    sinMonto: items.length - conMonto.length,
  };
}

function listaDeNombres(nombres) {
  if (nombres.length <= 1) return nombres[0] ?? "";
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;
  if (nombres.length === 3) return `${nombres[0]}, ${nombres[1]} y ${nombres[2]}`;
  return `${nombres[0]}, ${nombres[1]} y ${nombres.length - 2} más`;
}

// Textos de la tarjeta "Gastos por pagar": { valor, detalle }.
export function textoGastosPorPagar(g) {
  if (g.items.length === 0) return { valor: formatoDolares(0), detalle: "Nada por pagar este mes" };
  const nombres = listaDeNombres(g.items.map((i) => i.nombre));
  const dias = new Set(g.items.map((i) => i.dia));
  const unDia = dias.size === 1 && !dias.has(null) ? [...dias][0] : null;
  let detalle = unDia
    ? `${nombres} ${g.items.length === 1 ? "vence" : "vencen"} el ${unDia}`
    : `${nombres}, este mes`;
  if (g.conMonto === 0) return { valor: "Sin montos cargados", detalle };
  if (g.sinMonto > 0) detalle += `, ${g.sinMonto} sin monto`;
  return { valor: formatoDolares(g.total), detalle };
}

// --- Certificación --------------------------------------------------------

// Avance de cobro de los alumnos que tienen monto total. null si ninguno.
export function progresoCertificacion(alumnos) {
  const conTotal = alumnos.filter((a) => a.activo !== false && Number(a.monto_total) > 0);
  if (conTotal.length === 0) return null;
  const total = conTotal.reduce((acc, a) => acc + Number(a.monto_total), 0);
  const abonado = conTotal.reduce((acc, a) => acc + Math.min(Number(a.total_abonado || 0), Number(a.monto_total)), 0);
  return { alumnos: conTotal.length, total, abonado, pct: Math.round((abonado / total) * 100) };
}

// --- Resultado del mes -----------------------------------------------------

// Participación del cobrado en el movimiento total del mes (cobrado + gastado),
// en %, para la barra del resultado. Sin movimiento, 0.
export function porcentajeCobrado(cobrado, gastado) {
  const total = cobrado + gastado;
  return total > 0 ? Math.round((cobrado / total) * 100) : 0;
}

// Cobrado de cada mes de `meses` ("YYYY-MM"), por fecha de pago: una cuota de
// septiembre cobrada el 3 de octubre es plata de octubre. Si una cuota pagada
// no tiene fecha de pago, cuenta por su mes. Devuelve un número por mes.
export function cobradoPorFechaDePago(cuotas, meses) {
  const total = new Map(meses.map((m) => [m, 0]));
  for (const c of cuotas) {
    const m = String(c.fecha_pago || c.mes).slice(0, 7);
    if (total.has(m)) total.set(m, total.get(m) + Number(c.monto));
  }
  return meses.map((m) => total.get(m));
}

// Serie para el gráfico: [{ mes, cobrado, gastado }] de los últimos meses,
// completando con 0 los meses sin movimientos.
export function armarSerie(meses, filas) {
  const porMes = new Map((filas || []).map((f) => [f.mes, f]));
  return meses.map((mes) => ({
    mes,
    cobrado: Number(porMes.get(mes)?.cobrado || 0),
    gastado: Number(porMes.get(mes)?.gastado || 0),
  }));
}

// --- Para hacer hoy ----------------------------------------------------------

const TIPOS_RECORDATORIO = { general: "General", cobro: "Cobro", seguimiento: "Seguimiento" };

function estadoVisible(p, mes, ahora) {
  const estado = p.cuota_actual?.estado || "pendiente";
  return estado === "pendiente" && cuotaAtrasada(mes, p.dia_vencimiento, ahora) ? "atrasado" : estado;
}

// "10 de octubre" a partir de "2026-10-10".
export function fechaCorta(fechaISO) {
  return `${Number(fechaISO.slice(8, 10))} de ${nombreMes(fechaISO.slice(0, 7))}`;
}

// Un gasto fijo de gastosPorHacer como fila de "Para hacer hoy".
function pendienteDeGasto(g, hoy) {
  const grupo = g.ruta.includes(SEPARADOR_RUTA) ? g.ruta.slice(0, g.ruta.lastIndexOf(SEPARADOR_RUTA)) : "Gastos";
  const dias = diasEntre(hoy, g.vencimiento);
  return {
    clave: g.clave,
    tipo: "gasto",
    gasto: g,
    nombre: g.nombre,
    titulo: `Pagar ${g.nombre}`,
    detalle: `${grupo.split(SEPARADOR_RUTA).pop()}, ${g.estado === "vencido" ? "venció" : "vence"} el ${fechaCorta(g.vencimiento)}`,
    monto: g.monto,
    etiqueta: g.estado === "vencido" ? "Vencido" : g.estado === "hoy" ? "Vence hoy" : dias === 1 ? "Mañana" : `En ${dias} días`,
    tono: g.estado === "vencido" ? "warn" : g.estado === "hoy" ? "ok" : "neutro",
  };
}

function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

// Filas de "Para hacer hoy" que salen de la certificación: módulos listos para
// liquidar, pagos al equipo hechos tarde y alumnos que completaron las 10
// sesiones. Cada una lleva a su pantalla (`href`) con un botón (`accion`).
function pendientesDeCertificacion(certificaciones = []) {
  certificaciones = Array.isArray(certificaciones) ? certificaciones : [];
  const varias = certificaciones.length > 1;
  const donde = (c) => (varias ? ` · ${c.nombre}` : "");
  const importe = (r) => (r.faltaTarifa ? "Falta definir la tarifa antes de pagar" : `${formatoDolares(r.total)} para ${plural(r.personas, "persona", "personas")}`);
  const liquidar = [];
  const avisos = [];
  for (const c of certificaciones) {
    for (const m of c.modulosListos || []) {
      liquidar.push({
        clave: `liquidar-${m.modulo_id}`,
        tipo: "liquidacion",
        nombre: null,
        titulo: `Módulo ${m.numero}: pagar al equipo`,
        detalle: `${importe(m)}${donde(c)}`,
        monto: m.faltaTarifa ? null : m.total,
        etiqueta: m.faltaTarifa ? "Falta tarifa" : "Listo",
        tono: m.faltaTarifa ? "warn" : "ok",
        // La pestaña Módulos tiene el aviso con el botón "Pagar al equipo".
        href: "/certificacion/modulos",
        accion: "Revisar y pagar",
      });
    }
    if (c.tardios) {
      liquidar.push({
        clave: `pendientes-${c.id}`,
        tipo: "pendientes",
        nombre: null,
        titulo: "Pagos atrasados al equipo",
        detalle: `${c.tardios.faltaTarifa ? "Falta definir la tarifa" : plural(c.tardios.personas, "persona", "personas")}, de módulos que ya se pagaron${donde(c)}`,
        monto: c.tardios.faltaTarifa ? null : c.tardios.total,
        etiqueta: "Pendiente",
        tono: "warn",
        href: "/certificacion/modulos",
        accion: "Revisar y pagar",
      });
    }
    for (const a of c.listosParaCertificar || []) {
      avisos.push({
        clave: `certificar-${a.inscripcion_id}`,
        tipo: "certificar",
        nombre: a.alumno,
        titulo: `${a.alumno}: listo para certificar`,
        detalle: `Completó las 10 sesiones${varias ? ` de ${c.nombre}` : ""}`,
        monto: null,
        etiqueta: "Listo para certificar",
        tono: "ok",
        href: `/certificacion/alumnos/${a.inscripcion_id}`,
        accion: "Ver avance",
      });
    }
  }
  return { liquidar, avisos };
}

// Lista unificada de pendientes: cobros atrasados (los de más deuda primero),
// liquidaciones al equipo, gastos fijos vencidos o que vencen en los próximos 7
// días, recordatorios vencidos y de hoy, y al final los avisos de alumnos listos
// para certificar.
//   personas: jugadores y alumnos del mes ACTUAL, cada uno con `tipo`.
//   grupos: salida de agruparRecordatorios.
//   gastos: salida de gastosPorHacer.
//   certificaciones: resumen de cada certificación en curso (lib/certificacionResumen.js).
export function armarPendientes({ personas, mes, hoy, grupos, buscarPersona, gastos = [], certificaciones = [], ahora = new Date() }) {
  personas = Array.isArray(personas) ? personas : [];
  gastos = Array.isArray(gastos) ? gastos : [];
  grupos = grupos || {};
  const cobros = personas
    .filter((p) => estadoVisible(p, mes, ahora) === "atrasado")
    .sort((a, b) => (b.meses_adeudados || 0) - (a.meses_adeudados || 0) || a.nombre.localeCompare(b.nombre, "es"))
    .map((p) => {
      const dia = Math.min(p.dia_vencimiento, diasDelMes(mes));
      let detalle = `Cuota vencida el ${dia} de ${nombreMes(mes)}`;
      if (p.meses_adeudados > 1) detalle += `, debe ${p.meses_adeudados} meses`;
      return {
        clave: `cobro-${p.tipo}-${p.id}`,
        tipo: "cobro",
        persona: p,
        nombre: p.nombre,
        titulo: `Cobrar a ${p.nombre}`,
        detalle,
        monto: Number(p.cuota_actual?.monto ?? p.monto_mensual),
        etiqueta: "Atrasado",
        tono: "warn",
      };
    });

  const recordatorios = [...(grupos.vencidos || []), ...(grupos.hoy || [])].map((r) => {
    const dias = diasEntre(r.fecha, hoy);
    const persona = buscarPersona ? buscarPersona(r) : null;
    const primeraLinea = r.nota ? r.nota.split("\n")[0].trim() : "";
    return {
      clave: `recordatorio-${r.id}`,
      tipo: "recordatorio",
      recordatorio: r,
      nombre: persona?.nombre || null,
      titulo: r.titulo,
      detalle: primeraLinea || `Recordatorio de ${TIPOS_RECORDATORIO[r.tipo].toLowerCase()}`,
      monto: null,
      etiqueta: dias <= 0 ? "Hoy" : dias === 1 ? "Ayer" : `Hace ${dias} días`,
      tono: dias <= 0 ? "ok" : "warn",
    };
  });

  const cert = pendientesDeCertificacion(certificaciones || []);
  return [...cobros, ...cert.liquidar, ...gastos.map((g) => pendienteDeGasto(g, hoy)), ...recordatorios, ...cert.avisos];
}

// --- Próximos 7 días --------------------------------------------------------

// Vencimientos de los próximos `dias` días (mañana en adelante: lo de hoy ya
// está en "Para hacer hoy"): cuotas de clientes según su dia_vencimiento y
// gastos fijos según el de su categoría. Los recordatorios se suman aparte.
//   personas: activas, con { id, tipo, nombre, dia_vencimiento, monto_mensual }.
//   pagadas: Set de `${tipo}-${id}-${YYYY-MM}` con la cuota ya cobrada.
export function proximosVencimientos({ personas, pagadas, categorias, pagos, hoy, dias = 7 }) {
  personas = Array.isArray(personas) ? personas : [];
  const items = [];
  for (let d = 1; d <= dias; d++) {
    const fecha = sumarDiasISO(hoy, d);
    const mes = fecha.slice(0, 7);
    const dia = Number(fecha.slice(8, 10));
    const venceEseDia = (diaVencimiento) => diaVencimiento != null && Math.min(diaVencimiento, diasDelMes(mes)) === dia;

    for (const p of personas) {
      if (venceEseDia(p.dia_vencimiento) && !pagadas.has(`${p.tipo}-${p.id}-${mes}`)) {
        items.push({
          clave: `cobro-${p.tipo}-${p.id}-${fecha}`,
          tipo: "cobro",
          fecha,
          titulo: `Vence la cuota de ${p.nombre}`,
          nombre: p.nombre,
          personaTipo: p.tipo,
          personaId: p.id,
          monto: Number(p.monto_mensual),
        });
      }
    }
  }

  // Gastos fijos: de mañana en adelante (lo de hoy y lo vencido va en "Para
  // hacer hoy"). Las reglas de período y vencimiento están en lib/gastos.js.
  for (const g of gastosPorHacer({ categorias, pagos, hoy, dias })) {
    if (g.vencimiento <= hoy) continue;
    items.push({
      clave: `gasto-${g.id}-${g.vencimiento}`,
      tipo: "gasto",
      fecha: g.vencimiento,
      titulo: `Vence ${g.nombre}`,
      nombre: g.nombre,
      categoriaId: g.id,
      periodo: g.periodo,
      monto: g.monto,
    });
  }
  const ORDEN = { cobro: 0, gasto: 1, recordatorio: 2 };
  return items.sort((a, b) => a.fecha.localeCompare(b.fecha) || ORDEN[a.tipo] - ORDEN[b.tipo] || a.nombre.localeCompare(b.nombre, "es"));
}

// Suma los recordatorios (de mañana a `dias` días) a los vencimientos y deja
// todo ordenado por fecha.
export function agendaProxima(vencimientos, recordatorios, hoy, dias = 7) {
  const limite = sumarDiasISO(hoy, dias);
  const delRecordatorio = (Array.isArray(recordatorios) ? recordatorios : [])
    .filter((r) => !r.hecho && r.fecha > hoy && r.fecha <= limite)
    .map((r) => ({ clave: `recordatorio-${r.id}`, tipo: "recordatorio", fecha: r.fecha, titulo: r.titulo, nombre: r.titulo, monto: null, recordatorio: r }));
  const ORDEN = { cobro: 0, gasto: 1, recordatorio: 2 };
  return [...(Array.isArray(vencimientos) ? vencimientos : []), ...delRecordatorio].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || ORDEN[a.tipo] - ORDEN[b.tipo] || a.nombre.localeCompare(b.nombre, "es")
  );
}

// --- Últimos movimientos -----------------------------------------------------

// Mezcla cobros y pagos de gasto y devuelve los `limite` más recientes.
//   cobros: { id, fecha_pago, created_at, monto, metodo_pago, nombre }
//   pagos: { id, fecha_pago, created_at, monto, metodo_pago, nombre }
export function ultimosMovimientos(cobros, pagos, limite = 6) {
  const todos = [
    ...(Array.isArray(cobros) ? cobros : []).map((c) => ({ ...c, tipo: "cobro" })),
    ...(Array.isArray(pagos) ? pagos : []).map((p) => ({ ...p, tipo: "pago" })),
  ];
  return todos
    .sort((a, b) => b.fecha_pago.localeCompare(a.fecha_pago) || String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .slice(0, limite)
    .map((m) => ({
      clave: `${m.tipo}-${m.id}`,
      tipo: m.tipo,
      fecha: m.fecha_pago,
      nombre: m.nombre,
      monto: Number(m.monto),
      metodo: m.metodo_pago || null,
    }));
}

// Parte de la frase de Inicio sobre los gastos por pagar. Los tipos sin monto
// cargado no suman al total: la frase lo dice y `sinMonto` permite ofrecer el
// enlace para cargarlos.
export function fraseGastosPorPagar(gp) {
  if (!gp || typeof gp !== "object") return { texto: "", sinMonto: 0 };
  const items = Array.isArray(gp.items) ? gp.items.length : 0;
  if (items === 0) return { texto: " y no tenés gastos por pagar este mes", sinMonto: 0 };
  const sin = Number(gp.sinMonto) || 0;
  const con = Number(gp.conMonto) || 0;
  const sinTxt = `${sin} ${sin === 1 ? "gasto sin monto cargado" : "gastos sin monto cargado"}`;
  if (con === 0) {
    return { texto: ` y tenés ${items === 1 ? "1 gasto" : `${items} gastos`} por pagar este mes, sin monto cargado`, sinMonto: sin };
  }
  return { texto: ` y tenés ${formatoDolares(gp.total)} de gastos por pagar este mes${sin > 0 ? `, y ${sinTxt}` : ""}`, sinMonto: sin };
}
