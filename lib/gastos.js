// Lógica de gastos, toda pura (sin red ni React) para poder probarla: el árbol
// de categorías, los períodos y vencimientos de las recurrentes, y qué hay
// para pagar. Las fechas son "YYYY-MM-DD" ya calculadas en hora Argentina
// (lib/fechas.js); acá solo se opera con calendario puro.
import { diaArgentinaDe, diasDelMes, sumarDiasISO } from "./fechas";

export const MAX_NIVELES = 3;
export const SEPARADOR_RUTA = " › ";

const dos = (n) => String(n).padStart(2, "0");
const porOrden = (a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(a.nombre).localeCompare(String(b.nombre), "es");

// --- Árbol -------------------------------------------------------------------

export function indexar(categorias) {
  return new Map(categorias.map((c) => [c.id, c]));
}

// Map parent_id (o null) -> hijos ordenados por `orden` y nombre.
export function hijosPorPadre(categorias) {
  const mapa = new Map();
  for (const c of categorias) {
    const clave = c.parent_id ?? null;
    if (!mapa.has(clave)) mapa.set(clave, []);
    mapa.get(clave).push(c);
  }
  for (const lista of mapa.values()) lista.sort(porOrden);
  return mapa;
}

// Árbol anidado: cada nodo lleva `nivel` (1 = raíz) e `hijos`. Con
// `soloActivas`, una categoría inactiva se lleva consigo a toda su rama.
export function armarArbol(categorias, { soloActivas = false } = {}) {
  const hijos = hijosPorPadre(categorias);
  function armar(padre, nivel) {
    return (hijos.get(padre) || [])
      .filter((c) => !soloActivas || c.activo)
      .map((c) => ({ ...c, nivel, hijos: armar(c.id, nivel + 1) }));
  }
  return armar(null, 1);
}

// Nombres desde la raíz hasta la categoría ("Gastos variables", "Equipo de
// marketing", "Consultora de marketing"). Corta si hay un ciclo o un padre que
// falta, para que un dato raro nunca cuelgue la pantalla.
export function nombresDeRuta(id, porId) {
  const nombres = [];
  const vistos = new Set();
  let actual = porId.get(id);
  while (actual && !vistos.has(actual.id)) {
    vistos.add(actual.id);
    nombres.unshift(actual.nombre);
    actual = actual.parent_id ? porId.get(actual.parent_id) : null;
  }
  return nombres;
}

export function textoRuta(id, porId) {
  return nombresDeRuta(id, porId).join(SEPARADOR_RUTA);
}

// La categoría y todas las que cuelgan de ella, en cualquier nivel.
export function idsDelGrupo(id, categorias) {
  const hijos = hijosPorPadre(categorias);
  const ids = [];
  const pendientes = [id];
  while (pendientes.length) {
    const actual = pendientes.pop();
    if (ids.includes(actual)) continue;
    ids.push(actual);
    for (const h of hijos.get(actual) || []) pendientes.push(h.id);
  }
  return ids;
}

// Nivel de una categoría: 1 para una raíz.
export function nivelDe(id, porId) {
  return nombresDeRuta(id, porId).length;
}

// Niveles que ocupa la rama que empieza en `id` (una hoja = 1).
export function alturaDelSubarbol(id, categorias) {
  const hijos = hijosPorPadre(categorias);
  function altura(actual, vistos) {
    if (vistos.has(actual)) return 0;
    const siguientes = new Set(vistos).add(actual);
    return 1 + Math.max(0, ...(hijos.get(actual) || []).map((h) => altura(h.id, siguientes)));
  }
  return altura(id, new Set());
}

// Los tipos con `clave` los usa el sistema (Pagar al equipo): se pueden
// renombrar, pero no mover, desactivar ni borrar.
export const esDelSistema = (c) => Boolean(c?.clave);
export const ETIQUETA_SISTEMA = "Automático: lo genera Pagar al equipo";

// ¿Está `id` dentro de la rama que empieza en `raizId` (o es la raíz)?
export function estaEnLaRama(id, raizId, categorias) {
  return idsDelGrupo(raizId, categorias).includes(id);
}

// Carpetas donde se puede dejar a `categoria` (o un tipo nuevo, con
// `categoria` null): activas, que no se repiten, sin ser del sistema, que no
// sean ella misma ni algo que tiene adentro, y donde el árbol no pasa de
// MAX_NIVELES. Cada una con su nombre completo ("Gastos variables › Marketing").
export function carpetasPosibles(categoria, categorias) {
  const porId = indexar(categorias);
  const altura = categoria ? alturaDelSubarbol(categoria.id, categorias) : 1;
  return categorias
    .filter((c) => {
      if (!c.activo || c.recurrencia !== "ninguna" || esDelSistema(c)) return false;
      if (categoria && estaEnLaRama(c.id, categoria.id, categorias)) return false;
      return nivelDe(c.id, porId) + altura <= MAX_NIVELES;
    })
    .map((c) => ({ id: c.id, texto: textoRuta(c.id, porId) }))
    .sort((a, b) => a.texto.localeCompare(b.texto, "es"));
}

// Categorías activas sin subcategorías activas: donde se registran los pagos.
export function hojasActivas(categorias) {
  const conHijosActivos = new Set(categorias.filter((c) => c.activo && c.parent_id).map((c) => c.parent_id));
  return categorias.filter((c) => c.activo && !conHijosActivos.has(c.id));
}

// --- Períodos y vencimientos ---------------------------------------------------

export const ES_RECURRENTE = (c) => c.recurrencia === "mensual" || c.recurrencia === "anual";

// Primer día del período que contiene `fechaISO`: del mes (mensual) o del año
// (anual). null para una categoría sin recurrencia.
export function periodoDe(categoria, fechaISO) {
  if (categoria.recurrencia === "mensual") return `${fechaISO.slice(0, 7)}-01`;
  if (categoria.recurrencia === "anual") return `${fechaISO.slice(0, 4)}-01-01`;
  return null;
}

function mismoPeriodo(categoria, a, b) {
  const largo = categoria.recurrencia === "mensual" ? 7 : 4;
  return a.slice(0, largo) === b.slice(0, largo);
}

// Día en que vence el período. Un día de vencimiento mayor al largo del mes
// vence el último día (el 31 en un mes de 30 días vence el 30); sin día cargado,
// vence a fin de mes. En las anuales el mes es `mes_vencimiento`.
export function vencimientoDelPeriodo(categoria, periodo) {
  const anio = periodo.slice(0, 4);
  const mes = categoria.recurrencia === "anual" ? dos(Number(categoria.mes_vencimiento)) : periodo.slice(5, 7);
  const ultimo = diasDelMes(`${anio}-${mes}`);
  const dia = categoria.dia_vencimiento ? Math.min(Number(categoria.dia_vencimiento), ultimo) : ultimo;
  return `${anio}-${mes}-${dos(dia)}`;
}

// Un pago cubre el período que dice `periodo`; si no lo trae (pago suelto),
// el de su fecha de pago.
function pagoDelPeriodo(categoria, pagos, periodo) {
  return pagos.find((p) => p.categoria_id === categoria.id && mismoPeriodo(categoria, p.periodo || p.fecha_pago, periodo)) || null;
}

// Un vencimiento anterior al día en que se creó la categoría es de un período
// previo al uso del sistema: no hay forma de saber si se pagó, así que no cuenta
// como vencido ni avisa. Sin `created_at` (datos de prueba) la regla no se aplica.
export function esAnteriorAlSistema(categoria, vencimiento) {
  return Boolean(categoria.created_at) && vencimiento < diaArgentinaDe(categoria.created_at);
}

// { periodo, vencimiento, estado, pago } con estado "pagado", "pendiente",
// "vencido" o "anterior" (vencía antes de usar el sistema y no tiene pago).
// "Vencido" desde el día siguiente al vencimiento (el propio día todavía está
// en fecha, igual que en las cuotas).
function estadoDelPeriodo(categoria, pagos, periodo, hoy) {
  const vencimiento = vencimientoDelPeriodo(categoria, periodo);
  const pago = pagoDelPeriodo(categoria, pagos, periodo);
  let estado = "pendiente";
  if (pago) estado = "pagado";
  else if (esAnteriorAlSistema(categoria, vencimiento)) estado = "anterior";
  else if (hoy > vencimiento) estado = "vencido";
  return { periodo, vencimiento, estado, pago };
}

// Estado del período en curso; null si la categoría no es recurrente.
export function estadoActual(categoria, pagos, hoy) {
  if (!ES_RECURRENTE(categoria)) return null;
  return estadoDelPeriodo(categoria, pagos, periodoDe(categoria, hoy), hoy);
}

// Gastos fijos que hay que atender: sin pagar y vencidos o que vencen dentro de
// `dias` días (hoy incluido). Mira el período en curso y los que empiezan
// dentro de la ventana (a fin de mes, el del mes siguiente). Ordenados por
// vencimiento. Es lo que alimenta "Para hacer hoy" y "Próximos 7 días".
//   categorias: todas (activas e inactivas; las inactivas se saltean).
//   pagos: { categoria_id, fecha_pago, periodo }.
export function gastosPorHacer({ categorias, pagos, hoy, dias = 7 }) {
  categorias = Array.isArray(categorias) ? categorias : [];
  pagos = Array.isArray(pagos) ? pagos : [];
  const porId = indexar(categorias);
  const limite = sumarDiasISO(hoy, dias);
  const fechas = Array.from({ length: dias + 1 }, (_, i) => sumarDiasISO(hoy, i));
  const items = [];
  for (const c of categorias) {
    if (!c.activo || !ES_RECURRENTE(c)) continue;
    const periodos = [...new Set(fechas.map((f) => periodoDe(c, f)))];
    for (const periodo of periodos) {
      const e = estadoDelPeriodo(c, pagos, periodo, hoy);
      if (e.estado === "pagado" || e.estado === "anterior" || e.vencimiento > limite) continue;
      items.push({
        clave: `gasto-${c.id}-${periodo}`,
        id: c.id,
        nombre: c.nombre,
        ruta: textoRuta(c.id, porId),
        recurrencia: c.recurrencia,
        periodo,
        vencimiento: e.vencimiento,
        estado: e.estado === "vencido" ? "vencido" : e.vencimiento === hoy ? "hoy" : "pendiente",
        monto: c.monto_estimado == null ? null : Number(c.monto_estimado),
      });
    }
  }
  return items.sort((a, b) => a.vencimiento.localeCompare(b.vencimiento) || a.ruta.localeCompare(b.ruta, "es"));
}

// --- Totales -------------------------------------------------------------------

// Lo pagado en el mes y en el año de `hoy`, por fecha de pago (igual que el
// resultado del mes de Inicio).
export function totalesDePagos(pagos, hoy) {
  let mes = 0;
  let anio = 0;
  for (const p of pagos) {
    if (p.fecha_pago.slice(0, 4) !== hoy.slice(0, 4)) continue;
    anio += Number(p.monto);
    if (p.fecha_pago.slice(0, 7) === hoy.slice(0, 7)) mes += Number(p.monto);
  }
  return { mes, anio };
}

// Períodos que se pueden elegir al registrar un pago: el actual y los
// `atras` anteriores, el más nuevo primero. Cada uno es el primer día.
export function periodosElegibles(categoria, hoy, atras = 5) {
  if (!ES_RECURRENTE(categoria)) return [];
  const actual = periodoDe(categoria, hoy);
  const cantidad = categoria.recurrencia === "anual" ? Math.min(atras, 2) : atras;
  return Array.from({ length: cantidad + 1 }, (_, i) => {
    if (categoria.recurrencia === "mensual") {
      const [a, m] = actual.split("-").map(Number);
      return new Date(Date.UTC(a, m - 1 - i, 1)).toISOString().slice(0, 10);
    }
    return `${Number(actual.slice(0, 4)) - i}-01-01`;
  });
}
