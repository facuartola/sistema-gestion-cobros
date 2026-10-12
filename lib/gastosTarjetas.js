// Gastos como tarjetas: lógica pura de la pantalla "¿Qué pagaste?". Arma, desde
// las categorías de la base (nada escrito a mano), grupos con tarjetas adentro,
// el estado de cada una y el orden (primero lo que vence). Las reglas de
// vencimiento son las de lib/gastos.js (un vencimiento anterior a la creación
// del tipo no cuenta como vencido).
import { fechaDMA, sumarMesesISO } from "./fechas";
import { ES_RECURRENTE, armarArbol, estadoActual, vencimientoDelPeriodo } from "./gastos";
import { formatoDolares } from "./moneda";
import { normalizar } from "./navegacion";
import { fechaCorta, nombreMes } from "./resumen";

// Los tipos que genera "Pagar al equipo" de la certificación; se detectan por
// su columna `clave`, no por el nombre.
const CLAVES_EQUIPO = ["pago_sesiones", "pago_encuentros"];

const SIN_VENCIMIENTO = "9999-12-31";

// Rangos de orden: 0 vencido, 1 vence (mensual o anual cercano), 2 el resto.
const porUrgencia = (a, b) => a.rango - b.rango || (a.vencimiento || SIN_VENCIMIENTO).localeCompare(b.vencimiento || SIN_VENCIMIENTO);

// La tarjeta de un tipo de gasto (una hoja del árbol). `pagos`: los pagos
// { categoria_id, fecha_pago, periodo, monto }, del más nuevo al más viejo.
//   accion: "pagar" (un paso, monto conocido) | "registrar" (abre la ventana) | null.
export function tarjetaDe(categoria, pagos, hoy) {
  const ultimoPago = pagos.find((p) => p.categoria_id === categoria.id) || null;
  const monto = categoria.monto_estimado == null ? null : Number(categoria.monto_estimado);
  const base = {
    tipo: "tarjeta",
    id: categoria.id,
    nombre: categoria.nombre,
    recurrencia: categoria.recurrencia,
    monto,
    ultimoPago,
    periodo: null,
    vencimiento: null,
    rango: 2,
    tono: "",
    accion: null,
    etiqueta: "",
    texto: "",
  };
  const conMonto = monto != null ? ` · ${formatoDolares(monto)}` : "";

  if (!ES_RECURRENTE(categoria)) {
    return {
      ...base,
      texto: ultimoPago ? `Último pago: ${fechaDMA(ultimoPago.fecha_pago)} · ${formatoDolares(ultimoPago.monto)}` : "Sin pagos todavía",
      accion: "registrar",
      etiqueta: "Registrar pago",
    };
  }

  const e = estadoActual(categoria, pagos, hoy);
  const mensual = categoria.recurrencia === "mensual";
  const accion = monto != null ? "pagar" : "registrar";
  const etiqueta = monto != null ? "Pagué" : "Registrar pago";
  const conPeriodo = { ...base, periodo: e.periodo, vencimiento: e.vencimiento };

  if (e.estado === "pagado") return { ...conPeriodo, texto: mensual ? "Al día este mes" : "Al día", tono: "ok" };

  if (e.estado === "anterior") {
    // Vencía antes de empezar a usar el sistema: no cuenta como vencido; se
    // muestra lo que viene.
    if (mensual) {
      const proximo = vencimientoDelPeriodo(categoria, `${sumarMesesISO(e.periodo.slice(0, 7), 1)}-01`);
      return { ...conPeriodo, vencimiento: null, texto: `Próximo vencimiento: ${fechaCorta(proximo)}`, accion: "registrar", etiqueta: "Registrar pago" };
    }
    const anio = Number(e.vencimiento.slice(0, 4)) + 1;
    return { ...conPeriodo, vencimiento: null, texto: `Se renueva en ${nombreMes(e.vencimiento.slice(0, 7))} de ${anio}`, accion: "registrar", etiqueta: "Registrar pago" };
  }

  const vencido = e.estado === "vencido";
  if (mensual) {
    return {
      ...conPeriodo,
      texto: `${vencido ? "Venció" : "Vence"} el ${Number(e.vencimiento.slice(8, 10))}${conMonto}`,
      rango: vencido ? 0 : 1,
      tono: vencido ? "warn" : "",
      accion,
      etiqueta,
    };
  }
  return {
    ...conPeriodo,
    texto: vencido ? `Venció el ${fechaCorta(e.vencimiento)}${conMonto}` : `Se renueva en ${nombreMes(e.vencimiento.slice(0, 7))}${conMonto}`,
    rango: vencido ? 0 : 2,
    tono: vencido ? "warn" : "",
    accion,
    etiqueta,
  };
}

// Los grupos de la pantalla, del árbol de la base (solo activas, hasta 3
// niveles): { tipo: "grupo", id, nombre, nivel, items, rango, vencimiento }.
// Dentro de un grupo, y entre grupos, va primero lo vencido, luego lo que vence
// y después el resto. Las dos categorías de pago al equipo se reemplazan por una
// sola tarjeta { tipo: "equipo" }.
export function armarGrupos({ categorias, pagos, hoy }) {
  function convertir(nodo) {
    if (nodo.hijos.length === 0) return tarjetaDe(nodo, pagos, hoy);
    const delEquipo = nodo.hijos.filter((h) => h.hijos.length === 0 && CLAVES_EQUIPO.includes(h.clave));
    const items = nodo.hijos.filter((h) => !delEquipo.includes(h)).map(convertir);
    if (delEquipo.length > 0) {
      items.push({
        tipo: "equipo",
        id: `equipo-${nodo.id}`,
        nombre: "Pagos al equipo",
        // El historial de todo el grupo si solo tiene esto; si no, el del primero.
        historialId: items.length === 0 ? nodo.id : delEquipo[0].id,
        rango: 2,
        vencimiento: null,
      });
    }
    items.sort(porUrgencia);
    const mas = items.reduce((m, i) => (porUrgencia(i, m) < 0 ? i : m), items[0]);
    return { tipo: "grupo", id: nodo.id, nombre: nodo.nombre, nivel: nodo.nivel, items, rango: mas?.rango ?? 2, vencimiento: mas?.vencimiento ?? null };
  }
  const raices = armarArbol(categorias, { soloActivas: true }).map((r) => {
    const c = convertir(r);
    // Un tipo suelto en la raíz se muestra como un grupo sin título.
    return c.tipo === "grupo" ? c : { tipo: "grupo", id: `suelto-${c.id}`, nombre: "", sinTitulo: true, nivel: 1, items: [c], rango: c.rango, vencimiento: c.vencimiento };
  });
  return raices.sort(porUrgencia);
}

// Cantidad de tarjetas (las de equipo cuentan como una) dentro de un grupo.
export function contarTarjetas(grupo) {
  return grupo.items.reduce((n, i) => n + (i.tipo === "grupo" ? contarTarjetas(i) : 1), 0);
}

// Solo lo que coincide con el texto: una tarjeta por su nombre, un grupo por el
// suyo (y entonces se queda con todo lo de adentro). Sin texto, todo.
export function filtrarGrupos(grupos, texto) {
  const q = normalizar(texto);
  if (!q) return grupos;
  function filtrar(g) {
    if (normalizar(g.nombre).includes(q)) return g;
    const items = g.items
      .map((i) => (i.tipo === "grupo" ? filtrar(i) : normalizar(i.nombre).includes(q) ? i : null))
      .filter(Boolean);
    return items.length ? { ...g, items } : null;
  }
  return grupos.map(filtrar).filter(Boolean);
}
