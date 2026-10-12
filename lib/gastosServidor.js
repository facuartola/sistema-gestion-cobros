// Lecturas y formas compartidas por las rutas API de gastos.
import { textoRuta } from "./gastos";

export const COLUMNAS_CATEGORIA =
  "id, nombre, parent_id, orden, recurrencia, monto_estimado, dia_vencimiento, mes_vencimiento, activo, clave, created_at";

export const COLUMNAS_PAGO =
  "id, categoria_id, fecha_pago, periodo, monto, metodo_pago, descripcion, proveedor, comprobante_path, modulo_id, equipo_id, created_at";

export const BUCKET_COMPROBANTES = "comprobantes";

// Mensajes de base para categorías y pagos (ver errorDeBase en respuestasApi).
export const MENSAJES_CATEGORIA = {
  23505: "Ya hay un tipo de gasto con ese nombre en ese lugar.",
};
export const MENSAJES_PAGO = {
  23503: { texto: "El tipo de gasto del pago ya no existe.", status: 404 },
};

// Todas las categorías (activas e inactivas) en orden. { data, error }.
export function leerCategorias(supabase) {
  return supabase.from("categorias_gasto").select(COLUMNAS_CATEGORIA).order("orden").order("nombre");
}

// Pagos que pueden cubrir el año en curso o uno futuro: lo mínimo para saber si
// un período ya está pagado. { data, error }.
export function leerPagosVigentes(supabase, hoy) {
  const inicio = `${hoy.slice(0, 4)}-01-01`;
  return supabase
    .from("pagos_gasto")
    .select("categoria_id, fecha_pago, periodo")
    .or(`fecha_pago.gte.${inicio},periodo.gte.${inicio}`);
}

export function categoriaParaCliente(c) {
  return {
    ...c,
    monto_estimado: c.monto_estimado == null ? null : Number(c.monto_estimado),
  };
}

// Un pago como lo ve el navegador: con la ruta de su categoría y sin la ruta
// interna del comprobante (se pide aparte, con una URL firmada).
export function pagoParaCliente(p, porId) {
  return {
    id: p.id,
    categoria_id: p.categoria_id,
    categoria_nombre: porId.get(p.categoria_id)?.nombre ?? "",
    ruta: textoRuta(p.categoria_id, porId),
    fecha_pago: p.fecha_pago,
    periodo: p.periodo,
    monto: Number(p.monto),
    metodo_pago: p.metodo_pago,
    descripcion: p.descripcion,
    proveedor: p.proveedor,
    tiene_comprobante: Boolean(p.comprobante_path),
    // Pagos al equipo que generó una liquidación (de un módulo o de pendientes).
    de_liquidacion: Boolean(p.modulo_id || p.equipo_id),
    created_at: p.created_at,
  };
}

export const NO_ENCONTRADO_PAGO = "No se encontró el pago. Puede que ya se haya borrado.";
export const NO_ENCONTRADA_CATEGORIA = "No se encontró el tipo de gasto. Puede que ya se haya borrado.";

