// Gastos de ejemplo para /demo: categorías y pagos en memoria, con la misma
// interfaz que la capa real (lib/dataProvider.js) y las mismas reglas de
// validación (lib/gastosValidacion.js). Nunca llama a la API ni a Supabase.
import { estadoActual, gastosPorHacer, idsDelGrupo, indexar, totalesDePagos } from "./gastos";
import { hoyArgentinaISO, sumarDiasISO, sumarMesesISO } from "./fechas";
import {
  puedeBorrarCategoria,
  validarEdicionPagoLiquidacion,
  validarCategoriaEdicion,
  validarCategoriaNueva,
  validarComprobante,
  validarPago,
} from "./gastosValidacion";
import { categoriaParaCliente, pagoParaCliente } from "./gastosServidor";

// Ids con forma de uuid: las mismas validaciones del servidor los exigen.
const u = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const nuevoId = () => crypto.randomUUID();

// El mismo árbol que arma la base al empezar.
function categoriasIniciales() {
  const c = (id, nombre, parent_id, orden, extra = {}) => ({
    id,
    nombre,
    parent_id,
    orden,
    recurrencia: "ninguna",
    monto_estimado: null,
    dia_vencimiento: null,
    mes_vencimiento: null,
    activo: true,
    clave: null,
    created_at: `${sumarDiasISO(hoyArgentinaISO(), -60)}T12:00:00.000Z`,
    ...extra,
  });
  return [
    c(u(1), "Gastos fijos", null, 1),
    c(u(2), "Wifi", u(1), 1, { recurrencia: "mensual", dia_vencimiento: 10, monto_estimado: 45 }),
    c(u(3), "Zoom", u(1), 2, { recurrencia: "anual", mes_vencimiento: 7, monto_estimado: 150 }),
    c(u(4), "Celulares", u(1), 3, { recurrencia: "mensual", dia_vencimiento: 10, monto_estimado: 60 }),
    c(u(5), "Gastos variables", null, 2),
    c(u(6), "Equipo de marketing", u(5), 1),
    c(u(7), "Consultora de marketing", u(6), 1),
    c(u(8), "Producciones fotográficas y videos", u(6), 2),
    c(u(9), "Diseño, desarrollo y mantenimiento app", u(5), 2),
    c(u(10), "Mantenimiento", u(9), 1, { recurrencia: "mensual", monto_estimado: 100 }),
    c(u(11), "Desarrollo", u(9), 2),
    c(u(12), "Equipo de coaches", u(5), 3),
    c(u(13), "Pago de sesiones", u(12), 1, { clave: "pago_sesiones" }),
    c(u(14), "Pago de encuentros", u(12), 2, { clave: "pago_encuentros" }),
  ];
}

// Pagos de ejemplo con fechas relativas a hoy: Wifi al día hasta el mes pasado,
// Celulares todavía sin pagar, Mantenimiento pagado y Zoom pagado este año.
function pagosIniciales(hoy) {
  const mes = hoy.slice(0, 7);
  const anterior = sumarMesesISO(mes, -1);
  const p = (id, categoria_id, fecha_pago, periodo, monto, metodo_pago, extra = {}) => ({
    id,
    categoria_id,
    fecha_pago,
    periodo,
    monto,
    metodo_pago,
    descripcion: null,
    proveedor: null,
    comprobante_path: null,
    modulo_id: null,
    created_at: `${fecha_pago}T12:00:00.000Z`,
    ...extra,
  });
  return [
    p("demo-pago-1", u(2), `${anterior}-09`, `${anterior}-01`, 45, "transferencia", { proveedor: "Proveedor de internet", comprobante_path: "demo" }),
    p("demo-pago-2", u(10), sumarDiasISO(hoy, -5), `${mes}-01`, 100, "transferencia", { proveedor: "Estudio de desarrollo" }),
    p("demo-pago-3", u(10), `${anterior}-03`, `${anterior}-01`, 100, "transferencia", { proveedor: "Estudio de desarrollo" }),
    p("demo-pago-4", u(3), `${hoy.slice(0, 4)}-01-15`, `${hoy.slice(0, 4)}-01-01`, 150, "transferencia", { descripcion: "Plan anual" }),
    p("demo-pago-5", u(7), sumarDiasISO(hoy, -3), null, 300, "transferencia", { descripcion: "Asesoría de campaña" }),
    p("demo-pago-6", u(7), `${anterior}-20`, null, 450, "efectivo"),
    p("demo-pago-7", u(8), `${anterior}-12`, null, 800, "transferencia", { proveedor: "Estudio fotográfico", descripcion: "Sesión de fotos" }),
  ];
}

const SVG_EJEMPLO =
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300"><rect width="100%" height="100%" fill="#152237"/><text x="50%" y="50%" fill="#ece5d7" font-family="sans-serif" font-size="22" text-anchor="middle">Comprobante de ejemplo</text></svg>';

// `alEliminarPago(id)`: aviso para la certificación de la demo, que deja
// pendientes otra vez los ítems que pagaba ese pago.
export function crearGastosDemo({ alEliminarPago } = {}) {
  const hoy = hoyArgentinaISO();
  let categorias = categoriasIniciales();
  let pagos = pagosIniciales(hoy);
  const archivos = new Map(); // pagoId -> object URL del archivo elegido

  function pagosDe(ids) {
    return pagos
      .filter((p) => !ids || ids.includes(p.categoria_id))
      .sort((a, b) => b.fecha_pago.localeCompare(a.fecha_pago) || b.created_at.localeCompare(a.created_at));
  }

  return {
    // Para el resumen de Inicio.
    instantanea: () => ({ categorias, pagos }),

    async listarCategoriasGasto() {
      return {
        categorias: categorias.map((c) => categoriaParaCliente(c)),
        avisos: gastosPorHacer({ categorias, pagos, hoy }),
      };
    },

    async crearCategoriaGasto(body) {
      const { datos, error } = validarCategoriaNueva(body, categorias);
      if (error) throw new Error(error);
      if (datos.parent_id && pagos.some((p) => p.categoria_id === datos.parent_id)) {
        throw new Error("Ese tipo de gasto ya tiene pagos registrados: no puede pasar a ser un grupo.");
      }
      if (categorias.some((c) => (c.parent_id ?? null) === datos.parent_id && c.nombre.toLowerCase() === datos.nombre.toLowerCase())) {
        throw new Error("Ya hay un tipo de gasto con ese nombre en ese lugar.");
      }
      const orden = categorias.filter((c) => (c.parent_id ?? null) === datos.parent_id).reduce((m, c) => Math.max(m, c.orden), 0) + 1;
      const nueva = { id: nuevoId(), orden, activo: true, clave: null, ...datos };
      categorias = [...categorias, nueva];
      return categoriaParaCliente(nueva);
    },

    async actualizarCategoriaGasto(id, body) {
      const categoria = categorias.find((c) => c.id === id);
      if (!categoria) throw new Error("No se encontró el tipo de gasto. Puede que ya se haya borrado.");
      const { datos, error } = validarCategoriaEdicion(body, categoria, categorias);
      if (error) throw new Error(error);
      if (datos.parent_id !== undefined) {
        if (datos.parent_id && pagos.some((p) => p.categoria_id === datos.parent_id)) {
          throw new Error("Esa carpeta ya tiene pagos registrados: no puede pasar a ser una carpeta. Elegí otra carpeta.");
        }
        datos.orden = categorias.filter((c) => (c.parent_id ?? null) === datos.parent_id && c.id !== id).reduce((m, c) => Math.max(m, c.orden), 0) + 1;
      }
      if (datos.activo === false) {
        const rama = idsDelGrupo(id, categorias);
        const conClave = categorias.find((c) => rama.includes(c.id) && c.clave && c.id !== id);
        if (conClave) throw new Error(`No se puede desactivar “${categoria.nombre}”: adentro está “${conClave.nombre}”, que es automático (lo genera Pagar al equipo).`);
        categorias = categorias.map((c) => (rama.includes(c.id) ? { ...c, activo: false } : c));
        categorias = categorias.map((c) => (c.id === id ? { ...c, ...datos } : c));
      } else {
        categorias = categorias.map((c) => (c.id === id ? { ...c, ...datos } : c));
      }
      return categoriaParaCliente(categorias.find((c) => c.id === id));
    },

    async eliminarCategoriaGasto(id) {
      const categoria = categorias.find((c) => c.id === id);
      if (!categoria) return { ok: true };
      const permiso = puedeBorrarCategoria(categoria, categorias, pagos.filter((p) => p.categoria_id === id).length);
      if (permiso.error) throw new Error(permiso.error);
      categorias = categorias.filter((c) => c.id !== id);
      return { ok: true };
    },

    async listarPagosGasto(params = {}) {
      const porId = indexar(categorias);
      const categoria = params.categoria_id ? porId.get(params.categoria_id) : null;
      if (params.categoria_id && !categoria) throw new Error("No se encontró el tipo de gasto. Puede que ya se haya borrado.");
      const ids = categoria ? idsDelGrupo(categoria.id, categorias) : null;
      const lista = pagosDe(ids);
      return {
        pagos: lista.map((p) => pagoParaCliente(p, porId)),
        totales: totalesDePagos(lista, hoy),
        estado: categoria ? estadoActual(categoria, lista, hoy) : null,
        truncado: false,
      };
    },

    async crearPagoGasto(body) {
      const categoria = categorias.find((c) => c.id === body.categoria_id) || null;
      const { datos, error } = validarPago(body, categoria, hoy);
      if (error) throw new Error(error);
      if (categorias.some((c) => c.parent_id === categoria.id && c.activo)) {
        throw new Error(`“${categoria.nombre}” es un grupo: elegí uno de sus subtipos para registrar el pago.`);
      }
      const nuevo = { id: nuevoId(), comprobante_path: null, modulo_id: null, created_at: new Date().toISOString(), ...datos };
      pagos = [...pagos, nuevo];
      return pagoParaCliente(nuevo, indexar(categorias));
    },

    async actualizarPagoGasto(id, body) {
      const actual = pagos.find((p) => p.id === id);
      if (!actual) throw new Error("No se encontró el pago. Puede que ya se haya borrado.");
      if (actual.modulo_id || actual.equipo_id) {
        const { datos: cambios, error: invalido } = validarEdicionPagoLiquidacion(body, actual, hoyArgentinaISO());
        if (invalido) throw new Error(invalido);
        const editado = { ...actual, ...cambios };
        pagos = pagos.map((p) => (p.id === id ? editado : p));
        return pagoParaCliente(editado, indexar(categorias));
      }
      const categoriaId = body.categoria_id ?? actual.categoria_id;
      const combinado = { ...actual, periodo: categoriaId === actual.categoria_id ? actual.periodo : undefined, ...body };
      const { datos, error } = validarPago(combinado, categorias.find((c) => c.id === categoriaId) || null, hoy);
      if (error) throw new Error(error);
      const editado = { ...actual, ...datos };
      pagos = pagos.map((p) => (p.id === id ? editado : p));
      return pagoParaCliente(editado, indexar(categorias));
    },

    async eliminarPagoGasto(id) {
      pagos = pagos.filter((p) => p.id !== id);
      archivos.delete(id);
      alEliminarPago?.(id);
      return { ok: true };
    },

    // Para la certificación de la demo: pagos que crea una liquidación y las
    // categorías con clave donde van.
    agregarPagos(nuevos) {
      pagos = [...pagos, ...nuevos];
    },
    categoriasDeLiquidacion() {
      return {
        sesiones: categorias.find((c) => c.clave === "pago_sesiones")?.id,
        encuentros: categorias.find((c) => c.clave === "pago_encuentros")?.id,
      };
    },

    async subirComprobante(pagoId, archivo) {
      const { error } = validarComprobante(archivo);
      if (error) throw new Error(error);
      if (!pagos.some((p) => p.id === pagoId)) throw new Error("No se encontró el pago. Puede que ya se haya borrado.");
      archivos.set(pagoId, URL.createObjectURL(archivo));
      pagos = pagos.map((p) => (p.id === pagoId ? { ...p, comprobante_path: "demo" } : p));
      return { ok: true, tiene_comprobante: true };
    },

    async quitarComprobante(pagoId) {
      archivos.delete(pagoId);
      pagos = pagos.map((p) => (p.id === pagoId ? { ...p, comprobante_path: null } : p));
      return { ok: true, tiene_comprobante: false };
    },

    async urlComprobante(pagoId) {
      const pago = pagos.find((p) => p.id === pagoId);
      if (!pago?.comprobante_path) throw new Error("Este pago no tiene comprobante.");
      const url = archivos.get(pagoId) || URL.createObjectURL(new Blob([SVG_EJEMPLO], { type: "image/svg+xml" }));
      return { url, vigencia: 60 };
    },
  };
}
