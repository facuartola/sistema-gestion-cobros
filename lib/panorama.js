// Lógica pura del panel de Inicio: agrega las filas de las vistas
// `cobros_mensuales` y `gastos_mensuales_por_tipo` (por fecha de pago, incluidos
// los clientes dados de baja: la plata entró igual) y calcula indicadores,
// variaciones, repartos y proyecciones. Sin red ni React, para poder probarla.
//
// Lo que NO sale de las vistas se calcula con la lógica que ya existe en la app
// (estado de las cuotas: lib/cobros.js y lib/deuda.js; vencimientos de gastos:
// lib/gastos.js), no se duplica en SQL.
import { estadoDeCobro, montoDeCuota } from "./cobros";
import { diasDelMes, sumarDiasISO, sumarMesesISO } from "./fechas";
import { gastosPorHacer } from "./gastos";
import { diasEntre, mesesHasta } from "./resumen";

// --- Período del panel -----------------------------------------------------------

export const PERIODOS = [
  { clave: "mes", etiqueta: "Este mes" },
  { clave: "6m", etiqueta: "Últimos 6 meses" },
  { clave: "anio", etiqueta: "Este año" },
];
export const PERIODO_POR_DEFECTO = "6m";

export function periodoValido(clave) {
  return PERIODOS.some((p) => p.clave === clave) ? clave : null;
}

// Los meses que suman los repartos (anillos, métodos): el mes, los últimos 6 o
// lo que va del año.
export function mesesDelPeriodo(periodo, mesActual) {
  if (periodo === "mes") return [mesActual];
  if (periodo === "anio") return mesesHasta(mesActual, Number(mesActual.slice(5, 7)));
  return mesesHasta(mesActual, 6);
}

// Los meses del gráfico de tendencia. Una tendencia de un solo mes no dice
// nada: "Este mes" muestra los últimos 6 (con el actual al final) y "Este año"
// al menos 3 meses (en enero, los últimos 3).
export function mesesDeTendencia(periodo, mesActual) {
  if (periodo === "anio") return mesesHasta(mesActual, Math.max(3, Number(mesActual.slice(5, 7))));
  return mesesHasta(mesActual, 6);
}

// --- Series ------------------------------------------------------------------------

const aNumero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// [{ mes, cobrado, gastado, resultado }] para cada mes pedido (ceros si no hay
// filas). cobros: { mes: "YYYY-MM-01", total, cantidad, ... }; gastos: lo mismo.
export function serieMensual(cobros, gastos, meses) {
  cobros = Array.isArray(cobros) ? cobros : [];
  gastos = Array.isArray(gastos) ? gastos : [];
  const cobrado = new Map(meses.map((m) => [m, 0]));
  const gastado = new Map(meses.map((m) => [m, 0]));
  for (const c of cobros) {
    const m = String(c.mes).slice(0, 7);
    if (cobrado.has(m)) cobrado.set(m, cobrado.get(m) + aNumero(c.total));
  }
  for (const g of gastos) {
    const m = String(g.mes).slice(0, 7);
    if (gastado.has(m)) gastado.set(m, gastado.get(m) + aNumero(g.total));
  }
  return meses.map((mes) => ({ mes, cobrado: cobrado.get(mes), gastado: gastado.get(mes), resultado: cobrado.get(mes) - gastado.get(mes) }));
}

// Variación de `actual` contra `anterior`: { pct, direccion, sinBase }.
//  - anterior en 0 (o sin datos): no hay base para comparar: sinBase, pct null.
//  - pct sobre el valor absoluto del anterior (el resultado puede ser negativo).
export function variacion(actual, anterior) {
  const a = aNumero(actual);
  const b = aNumero(anterior);
  if (b === 0) return { pct: null, direccion: a === 0 ? "igual" : a > 0 ? "sube" : "baja", sinBase: true };
  const pct = Math.round(((a - b) / Math.abs(b)) * 100);
  return { pct, direccion: pct === 0 ? "igual" : a > b ? "sube" : "baja", sinBase: false };
}

// "▲ 12 %" · "▼ 8 %" · "= 0 %" · "Sin datos del mismo tramo del mes anterior".
export function textoVariacion(v) {
  if (v.sinBase) return v.direccion === "igual" ? "Sin cambios" : "Sin datos del mismo tramo del mes anterior";
  if (v.pct === 0) return "= 0 %";
  // Un porcentaje de miles no dice nada útil (y desarma la tarjeta): se acota.
  const pct = Math.abs(v.pct);
  return `${v.direccion === "sube" ? "▲" : "▼"} ${pct > 999 ? "más de 999" : pct} %`;
}

// Verde si el cambio es bueno, ámbar si no, neutro si no hay cambio ni base.
// `mejorSiSube`: en los cobros y el resultado subir es bueno; en los gastos no.
export function tonoVariacion(v, mejorSiSube = true) {
  if (v.direccion === "igual" || v.sinBase) return "neutro";
  return (v.direccion === "sube") === mejorSiSube ? "ok" : "warn";
}

// --- Comparación contra el mismo tramo del mes anterior ---------------------------------------

// Por día: [{ fecha: "YYYY-MM-DD", total }] a partir de filas con fecha_pago y monto.
export function agruparPorDia(filas) {
  filas = Array.isArray(filas) ? filas : [];
  const dias = new Map();
  for (const f of filas) {
    const fecha = String(f.fecha_pago ?? "").slice(0, 10);
    if (fecha.length !== 10) continue;
    dias.set(fecha, (dias.get(fecha) ?? 0) + aNumero(f.monto));
  }
  return [...dias].map(([fecha, total]) => ({ fecha, total })).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// El tramo del mes en curso (del 1 al día de hoy) y el mismo tramo del mes
// anterior (del 1 al mismo día, o hasta su último día si ese mes es más corto).
export function tramosDeComparacion(hoy) {
  const mes = hoy.slice(0, 7);
  const anterior = sumarMesesISO(mes, -1);
  const dia = Number(hoy.slice(8, 10));
  const diaAnterior = Math.min(dia, diasDelMes(anterior));
  const dos = (n) => String(n).padStart(2, "0");
  return {
    dia,
    diaAnterior,
    actual: { desde: `${mes}-01`, hasta: hoy },
    anterior: { desde: `${anterior}-01`, hasta: `${anterior}-${dos(diaAnterior)}` },
  };
}

export function totalDelTramo(diarios, { desde, hasta }) {
  return (Array.isArray(diarios) ? diarios : []).reduce((acc, d) => (d.fecha >= desde && d.fecha <= hasta ? acc + aNumero(d.total) : acc), 0);
}

// "del 1 al 5" para decir qué tramo se compara.
export function textoDelTramo(hoy) {
  const { dia } = tramosDeComparacion(hoy);
  return dia === 1 ? "el día 1" : `del 1 al ${dia}`;
}

// Los indicadores del mes: valor, serie de tendencia y variación contra el MISMO
// TRAMO del mes anterior (del 1 al día de hoy contra del 1 al mismo día del mes
// pasado): a principio de mes, compararse con el mes anterior completo muestra
// bajas engañosas. Sin datos diarios (`tramo` null) o sin movimientos en el tramo
// anterior no hay base: la variación lo dice con un mensaje neutro.
//   tramo: { hoy, cobros: [{ fecha, total }], gastos: [{ fecha, total }] } (agruparPorDia)
export function indicadoresDelMes(cobros, gastos, mesActual, cantidadTendencia = 6, tramo = null) {
  const meses = mesesHasta(mesActual, cantidadTendencia);
  const serie = serieMensual(cobros, gastos, meses);
  const actual = serie[serie.length - 1];
  let cobrado = { actual: 0, anterior: 0 };
  let gastado = { actual: 0, anterior: 0 };
  if (tramo) {
    const t = tramosDeComparacion(tramo.hoy);
    cobrado = { actual: totalDelTramo(tramo.cobros, t.actual), anterior: totalDelTramo(tramo.cobros, t.anterior) };
    gastado = { actual: totalDelTramo(tramo.gastos, t.actual), anterior: totalDelTramo(tramo.gastos, t.anterior) };
  }
  const sinTramo = { pct: null, direccion: "igual", sinBase: true };
  const comparar = (par) => (tramo ? variacion(par.actual, par.anterior) : sinTramo);
  const resultado = { actual: cobrado.actual - gastado.actual, anterior: cobrado.anterior - gastado.anterior };
  return {
    serie,
    cobrado: { valor: actual.cobrado, tendencia: serie.map((s) => s.cobrado), variacion: comparar(cobrado) },
    gastado: { valor: actual.gastado, tendencia: serie.map((s) => s.gastado), variacion: comparar(gastado) },
    resultado: { valor: actual.resultado, tendencia: serie.map((s) => s.resultado), variacion: comparar(resultado) },
  };
}

// --- Cobros por método --------------------------------------------------------------

const METODOS = [
  { clave: "efectivo", etiqueta: "Efectivo" },
  { clave: "transferencia", etiqueta: "Transferencia" },
  { clave: "sin_metodo", etiqueta: "Sin método" },
];

// Efectivo, transferencia y (si hay cobros viejos) sin método, con total y
// cantidad de cobros. Solo los que tienen algo.
export function cobradoPorMetodo(cobros, meses) {
  cobros = Array.isArray(cobros) ? cobros : [];
  const set = new Set(meses);
  const acc = new Map(METODOS.map((m) => [m.clave, { total: 0, cantidad: 0 }]));
  for (const c of cobros) {
    if (!set.has(String(c.mes).slice(0, 7))) continue;
    const fila = acc.get(acc.has(c.metodo) ? c.metodo : "sin_metodo");
    fila.total += aNumero(c.total);
    fila.cantidad += aNumero(c.cantidad);
  }
  return METODOS.map((m) => ({ ...m, ...acc.get(m.clave) })).filter((m) => m.total > 0 || m.cantidad > 0);
}

// --- Gastos por tipo ------------------------------------------------------------------

export const SEPARADOR_VISTA = " > ";

// REGLA DE AGRUPAMIENTO de "Gastos por tipo" (vale para cualquier árbol): un pago
// cuenta en la CARPETA QUE CONTIENE a su tipo de gasto (la de más abajo):
//   - Gastos variables › Equipo de marketing › Consultora  →  "Equipo de marketing"
//   - Gastos fijos › Wifi                                   →  "Gastos fijos"
//   - Wifi (un tipo suelto en el primer nivel)               →  "Wifi" (su propio nombre)
// Así nunca hay un segmento por cada tipo final de una carpeta, ni más de dos
// niveles de detalle. Las carpetas vacías no aparecen (no tienen pagos); los tipos
// desactivados con historial siguen contando (la vista de la base no filtra por
// activo); renombrar o mover un tipo cambia el grupo en el que se ve TODO su
// historial (los pagos se unen al árbol de hoy). Con `categorias` se agrupa por
// el árbol (id de cada tipo); sin ellas, por el texto de la ruta de la vista.
export function grupoDeRuta(ruta) {
  const partes = String(ruta).split(SEPARADOR_VISTA);
  return partes.length >= 3 ? partes[partes.length - 2] : partes[0];
}

// { clave, nombre, hoja } del grupo de una fila de gastos_mensuales_por_tipo.
function grupoDeFila(g, porId) {
  const c = porId?.get(g.categoria_id);
  if (c) {
    const padre = c.parent_id ? porId.get(c.parent_id) : null;
    const grupo = padre || c;
    return { clave: grupo.id, nombre: grupo.nombre, hoja: c.nombre, contexto: (grupo.parent_id && porId.get(grupo.parent_id)?.nombre) || "" };
  }
  const nombre = grupoDeRuta(g.ruta ?? "");
  const partes = String(g.ruta ?? "").split(SEPARADOR_VISTA);
  return {
    clave: partes.length >= 3 ? partes.slice(0, -1).join(SEPARADOR_VISTA) : partes[0],
    nombre,
    hoja: partes[partes.length - 1],
    contexto: partes.length >= 4 ? partes[partes.length - 3] : "",
  };
}

// [{ clave, nombre, total, cantidad, detalle: [{ nombre, total, cantidad }] }],
// de mayor a menor; después de `max` grupos el resto se junta en "Otros".
export function gastosPorGrupo(gastos, meses, max = 5, categorias = null) {
  gastos = Array.isArray(gastos) ? gastos : [];
  const porId = Array.isArray(categorias) && categorias.length ? new Map(categorias.map((c) => [c.id, c])) : null;
  const set = new Set(meses);
  const grupos = new Map();
  for (const g of gastos) {
    if (!set.has(String(g.mes).slice(0, 7))) continue;
    const { clave, nombre, hoja, contexto } = grupoDeFila(g, porId);
    if (!grupos.has(clave)) grupos.set(clave, { clave, nombre, contexto, total: 0, cantidad: 0, tipos: new Map() });
    const grupo = grupos.get(clave);
    const total = aNumero(g.total);
    const cantidad = aNumero(g.cantidad);
    grupo.total += total;
    grupo.cantidad += cantidad;
    const tipo = grupo.tipos.get(hoja) || { nombre: hoja, total: 0, cantidad: 0 };
    tipo.total += total;
    tipo.cantidad += cantidad;
    grupo.tipos.set(hoja, tipo);
  }
  const ordenar = (lista) => lista.sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es"));
  const conTotal = [...grupos.values()].filter((g) => g.total > 0);
  // Dos carpetas con el mismo nombre en lugares distintos: se distinguen por la de arriba.
  const repetidos = new Set(conTotal.map((g) => g.nombre).filter((n, i, todos) => todos.indexOf(n) !== i));
  const todos = ordenar(conTotal).map((g) => ({
    clave: g.clave,
    nombre: repetidos.has(g.nombre) && g.contexto ? `${g.nombre} (${g.contexto})` : g.nombre,
    total: g.total,
    cantidad: g.cantidad,
    detalle: ordenar([...g.tipos.values()]),
  }));
  if (todos.length <= max) return todos;
  const visibles = todos.slice(0, max - 1);
  const resto = todos.slice(max - 1);
  const detalle = new Map();
  for (const g of resto) {
    for (const t of g.detalle) {
      const prev = detalle.get(t.nombre) || { nombre: t.nombre, total: 0, cantidad: 0 };
      prev.total += t.total;
      prev.cantidad += t.cantidad;
      detalle.set(t.nombre, prev);
    }
  }
  return [
    ...visibles,
    {
      clave: "__otros",
      nombre: "Otros",
      total: resto.reduce((a, g) => a + g.total, 0),
      cantidad: resto.reduce((a, g) => a + g.cantidad, 0),
      detalle: ordenar([...detalle.values()]),
    },
  ];
}

// --- Estado de las cuotas del mes ----------------------------------------------------------

// Pagó / Por vencer / Atrasado, con cantidad y monto de cada uno, y lo esperado
// del mes (la suma de todas las cuotas de las personas activas). Mismas reglas
// que la pantalla de Cobros (lib/cobros.js).
export function estadoDeCobrosDelMes(personas, mes, ahora = new Date()) {
  personas = Array.isArray(personas) ? personas : [];
  const vacio = () => ({ n: 0, monto: 0 });
  const r = { pago: vacio(), porVencer: vacio(), atrasado: vacio() };
  for (const p of personas) {
    const e = estadoDeCobro(p, mes, ahora);
    const clave = e.clave === "pagado" ? "pago" : e.clave === "atrasado" ? "atrasado" : "porVencer";
    r[clave].n += 1;
    r[clave].monto += montoDeCuota(p);
  }
  const esperado = r.pago.monto + r.porVencer.monto + r.atrasado.monto;
  return { ...r, personas: personas.length, esperado, porCobrar: r.porVencer.monto + r.atrasado.monto, porCobrarN: r.porVencer.n + r.atrasado.n };
}

// Tasa de cobranza: lo cobrado de las cuotas del mes sobre lo esperado, en %.
// null si no hay nada esperado.
export function tasaDeCobranza(estado) {
  if (!estado || estado.esperado <= 0) return null;
  return Math.round((estado.pago.monto / estado.esperado) * 100);
}

// Proyección del mes: si todos pagan, cuánto se cierra. Suma lo ya cobrado y lo
// que falta cobrar, y resta lo ya gastado y los gastos por pagar que tienen
// monto. `margenPct`: lo que queda sobre los ingresos esperados.
export function proyeccionDelMes({ cobrado, porCobrar, gastado, gastosPorPagar, gastosSinMonto = 0 }) {
  const ingresos = aNumero(cobrado) + aNumero(porCobrar);
  const egresos = aNumero(gastado) + aNumero(gastosPorPagar);
  const cierre = ingresos - egresos;
  return { ingresos, egresos, cierre, margenPct: ingresos > 0 ? Math.round((cierre / ingresos) * 100) : null, gastosSinMonto };
}

// --- Quién debe ------------------------------------------------------------------------------

// Clientes con deuda, de los más antiguos a los más nuevos: primero los que
// deben más meses, después los más atrasados en el mes. `puedeCobrar` es true
// cuando lo que se debe es la cuota de este mes (el botón "Cobré" registra esa
// cuota); si la deuda es de meses anteriores se manda a Cobros.
//   personas: activas, con `tipo`, de mes actual (meses_adeudados de la API).
export function quienDebe(personas, mes, hoy, ahora = new Date(), limite = 5) {
  personas = Array.isArray(personas) ? personas : [];
  const filas = [];
  for (const p of personas) {
    const e = estadoDeCobro(p, mes, ahora);
    const atrasadoAhora = e.clave === "atrasado";
    const meses = Number(p.meses_adeudados) || 0;
    if (!atrasadoAhora && meses === 0) continue;
    const anteriores = Math.max(0, meses - (atrasadoAhora ? 1 : 0));
    let diasAtraso = null;
    if (atrasadoAhora) {
      const dia = Math.min(Number(p.dia_vencimiento), diasDelMes(mes));
      diasAtraso = diasEntre(`${mes}-${String(dia).padStart(2, "0")}`, hoy);
    }
    filas.push({
      persona: p,
      meses: Math.max(meses, atrasadoAhora ? 1 : 0),
      anteriores,
      diasAtraso,
      monto: (atrasadoAhora ? montoDeCuota(p) : 0) + anteriores * Number(p.monto_mensual || 0),
      puedeCobrar: atrasadoAhora,
    });
  }
  // Más antiguo primero: la deuda de meses anteriores va antes que la cuota de
  // este mes; entre iguales, más meses y más días de atraso.
  filas.sort(
    (a, b) =>
      b.anteriores - a.anteriores ||
      b.meses - a.meses ||
      (b.diasAtraso ?? -1) - (a.diasAtraso ?? -1) ||
      a.persona.nombre.localeCompare(b.persona.nombre, "es")
  );
  return { total: filas.length, items: filas.slice(0, limite) };
}

// --- Próximos 30 días ---------------------------------------------------------------------------

const DIAS_ADELANTE = 30;

// Lo que se espera cobrar y los gastos que vencen, por semana, desde hoy hasta
// 30 días. Lo ya vencido no entra (eso está en "Quién debe" y "Para hacer").
//  - Cobros: las cuotas sin pagar de este mes y las del mes que viene (todavía
//    no cargadas: se espera el monto mensual) cuyo día de vencimiento cae en la
//    ventana. Sin día de vencimiento no hay fecha: no se cuentan.
//  - Gastos: los fijos sin pagar con vencimiento en la ventana (lib/gastos.js);
//    los que no tienen monto cargado se cuentan aparte.
export function proximosDias({ personas, categorias, pagos, hoy, dias = DIAS_ADELANTE }) {
  personas = Array.isArray(personas) ? personas : [];
  categorias = Array.isArray(categorias) ? categorias : [];
  pagos = Array.isArray(pagos) ? pagos : [];
  const limite = sumarDiasISO(hoy, dias);
  const semanas = Array.from({ length: Math.floor(dias / 7) + 1 }, (_, i) => {
    const inicio = sumarDiasISO(hoy, i * 7);
    const fin = i === Math.floor(dias / 7) ? limite : sumarDiasISO(hoy, i * 7 + 6);
    return { indice: i, inicio, fin, cobros: 0, gastos: 0, nCobros: 0, nGastos: 0 };
  });
  const semanaDe = (fecha) => Math.min(semanas.length - 1, Math.floor(diasEntre(hoy, fecha) / 7));

  const mesHoy = hoy.slice(0, 7);
  const mesSiguiente = sumarMesesISO(mesHoy, 1);
  for (const p of personas) {
    if (!p.dia_vencimiento) continue;
    for (const mes of [mesHoy, mesSiguiente]) {
      if (mes === mesHoy && p.cuota_actual?.estado === "pagado") continue;
      const dia = Math.min(Number(p.dia_vencimiento), diasDelMes(mes));
      const fecha = `${mes}-${String(dia).padStart(2, "0")}`;
      if (fecha < hoy || fecha > limite) continue;
      const s = semanas[semanaDe(fecha)];
      s.cobros += mes === mesHoy ? montoDeCuota(p) : Number(p.monto_mensual || 0);
      s.nCobros += 1;
    }
  }

  let gastosSinMonto = 0;
  for (const g of gastosPorHacer({ categorias, pagos, hoy, dias })) {
    if (g.vencimiento < hoy) continue;
    const s = semanas[semanaDe(g.vencimiento)];
    s.nGastos += 1;
    if (g.monto == null) gastosSinMonto += 1;
    else s.gastos += g.monto;
  }
  const totalCobros = semanas.reduce((a, s) => a + s.cobros, 0);
  const totalGastos = semanas.reduce((a, s) => a + s.gastos, 0);
  return { semanas, totalCobros, totalGastos, gastosSinMonto, hayAlgo: semanas.some((s) => s.nCobros + s.nGastos > 0) };
}

// --- Certificación ---------------------------------------------------------------------------------

const MODULOS = 10;

// Alumnos según sus sesiones hechas: un arreglo de 11 posiciones (0 a 10).
export function distribucionSesiones(avance) {
  avance = Array.isArray(avance) ? avance : [];
  const dist = Array(MODULOS + 1).fill(0);
  for (const a of avance) {
    const n = Math.min(MODULOS, Math.max(0, Number(a.sesiones_realizadas) || 0));
    dist[n] += 1;
  }
  return dist;
}

// --- Texto compacto para ejes y tooltips ----------------------------------------------------------

// 1.250 -> "1,3 mil" · 12.000 -> "12 mil" · 2.500.000 -> "2,5 M". Para los ejes.
export function montoCorto(n) {
  const v = Math.abs(aNumero(n));
  const signo = n < 0 ? "−" : "";
  const dec = (x) => String(Math.round(x * 10) / 10).replace(".", ",");
  if (v >= 1_000_000) return `${signo}${dec(v / 1_000_000)} M`;
  if (v >= 1000) return `${signo}${dec(v / 1000)} mil`;
  return `${signo}${Math.round(v)}`;
}

// Marcas "redondas" para el eje vertical: de `min` (≤ 0) a `max` en pasos 1, 2 o
// 5 por potencia de diez. Siempre incluye el 0 y nunca devuelve un eje vacío.
export function marcasDelEje(min, max, objetivo = 4) {
  const techo = Math.max(max, 0);
  const piso = Math.min(min, 0);
  const rango = techo - piso || 1;
  const bruto = rango / objetivo;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? bruto;
  const desde = Math.floor(piso / paso) * paso;
  const hasta = Math.ceil(techo / paso) * paso || paso;
  const marcas = [];
  for (let v = desde; v <= hasta + paso / 1000; v += paso) marcas.push(Math.round(v * 1000) / 1000);
  return marcas;
}

// --- Valores extremos en los gráficos de barras -----------------------------------------------------

const FACTOR_EXTREMO = 4;

const mediana = (ordenados) => {
  const m = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[m] : (ordenados[m - 1] + ordenados[m]) / 2;
};

// Un solo mes (o cliente) de monto enorme aplasta las demás barras. Un valor es
// "extremo" si supera FACTOR_EXTREMO veces la mediana del resto (sin contar los
// ceros ni el propio valor; hacen falta al menos 2 valores para comparar).
// Devuelve el `tope` para dibujar (un poco más que la mayor barra normal) y la
// función `cortado(v)` para saber qué barras se dibujan cortadas. Sin extremos,
// tope es null y nada se corta.
export function recorteDeValores(valores, factor = FACTOR_EXTREMO) {
  const abs = (Array.isArray(valores) ? valores : []).map((v) => Math.abs(aNumero(v)));
  const extremos = new Set();
  abs.forEach((v, i) => {
    const resto = abs.filter((x, j) => j !== i && x > 0).sort((a, b) => a - b);
    if (resto.length < 2) return;
    const med = mediana(resto);
    if (med > 0 && v > factor * med) extremos.add(i);
  });
  if (extremos.size === 0) return { tope: null, cortado: () => false, hayCortes: false };
  const mayorNormal = Math.max(0, ...abs.filter((_, i) => !extremos.has(i)));
  const tope = mayorNormal > 0 ? mayorNormal * 1.25 : null;
  const cortado = (v) => tope != null && Math.abs(aNumero(v)) > tope;
  return { tope, cortado, hayCortes: tope != null && abs.some((v) => v > tope) };
}

// El valor que se dibuja: el real, o el tope (con su signo) si se corta.
export function valorDibujado(v, recorte) {
  const n = aNumero(v);
  return recorte.cortado(n) ? Math.sign(n) * recorte.tope : n;
}
