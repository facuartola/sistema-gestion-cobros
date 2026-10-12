import { NextResponse } from "next/server";
import { supabaseForRequest } from "../../../../lib/supabaseServer";
import { exigirSesion } from "../../../../lib/apiAuth";
import { conRegistroDeErrores, registrarErrorServidor } from "../../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase, leerJson } from "../../../../lib/respuestasApi";
import { hoyArgentinaISO } from "../../../../lib/fechas";
import { indexar } from "../../../../lib/gastos";
import { validarEdicionPagoLiquidacion, validarPago } from "../../../../lib/gastosValidacion";
import {
  BUCKET_COMPROBANTES,
  COLUMNAS_PAGO,
  MENSAJES_PAGO,
  NO_ENCONTRADO_PAGO,
  leerCategorias,
  pagoParaCliente,
} from "../../../../lib/gastosServidor";
import { esUuid } from "../../../../lib/validacion";

const RUTA = "/api/pagos-gasto/[id]";

async function leerPago(supabase, id) {
  return supabase.from("pagos_gasto").select(COLUMNAS_PAGO).eq("id", id).maybeSingle();
}

// PATCH -> editar un pago. Se validan todos los campos juntos: lo que no viene en
// el pedido conserva su valor. En los pagos que generó una liquidación al equipo
// (equipo_id o modulo_id) solo se cambian fecha, método, proveedor y descripción:
// el monto, la categoría y la persona los define la liquidación.
async function PATCH_(request, { params }) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADO_PAGO, 404);
  const { body, respuesta } = await leerJson(request);
  if (respuesta) return respuesta;

  const { data: actual, error: errorLectura } = await leerPago(supabase, id);
  if (errorLectura) return errorDeBase(supabase, errorLectura, RUTA);
  if (!actual) return errorCliente(NO_ENCONTRADO_PAGO, 404);

  const { data: categorias, error: errorCategorias } = await leerCategorias(supabase);
  if (errorCategorias) return errorDeBase(supabase, errorCategorias, RUTA);
  const porId = indexar(categorias);

  if (actual.modulo_id || actual.equipo_id) {
    const { datos: cambios, error: invalido } = validarEdicionPagoLiquidacion(body, actual, hoyArgentinaISO());
    if (invalido) return errorCliente(invalido, invalido.startsWith("En un pago al equipo") ? 409 : 400);
    const { data, error: errorEdicion } = await supabase.from("pagos_gasto").update(cambios).eq("id", id).select(COLUMNAS_PAGO).maybeSingle();
    if (errorEdicion) return errorDeBase(supabase, errorEdicion, RUTA, MENSAJES_PAGO);
    if (!data) return errorCliente(NO_ENCONTRADO_PAGO, 404);
    return NextResponse.json(pagoParaCliente(data, porId));
  }

  const categoriaId = body.categoria_id ?? actual.categoria_id;
  const cambioDeCategoria = categoriaId !== actual.categoria_id;
  const combinado = {
    monto: actual.monto,
    fecha_pago: actual.fecha_pago,
    metodo_pago: actual.metodo_pago,
    proveedor: actual.proveedor,
    descripcion: actual.descripcion,
    // El período de otra categoría no sirve: se recalcula con la fecha.
    periodo: cambioDeCategoria ? undefined : actual.periodo,
    ...body,
  };
  const { datos, error } = validarPago(combinado, esUuid(categoriaId) ? porId.get(categoriaId) : null, hoyArgentinaISO());
  if (error) return errorCliente(error);
  if (cambioDeCategoria && categorias.some((c) => c.parent_id === datos.categoria_id && c.activo)) {
    return errorCliente("Ese tipo de gasto es un grupo: elegí una de sus subtipos.");
  }

  const { data, error: errorEdicion } = await supabase
    .from("pagos_gasto")
    .update(datos)
    .eq("id", id)
    .select(COLUMNAS_PAGO)
    .maybeSingle();
  if (errorEdicion) return errorDeBase(supabase, errorEdicion, RUTA, MENSAJES_PAGO);
  if (!data) return errorCliente(NO_ENCONTRADO_PAGO, 404);
  return NextResponse.json(pagoParaCliente(data, porId));
}

// DELETE -> borra el pago y, después, su comprobante del bucket. Si el archivo no
// se pudiera borrar, el pago ya no existe igual: se anota en errores_app y se avisa.
// Si era un pago de liquidación, la base deja solos los encuentros y sesiones que
// pagaba otra vez pendientes de pago (pago_gasto_id pasa a null).
async function DELETE_(request, { params }) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADO_PAGO, 404);

  const { data: actual, error: errorLectura } = await leerPago(supabase, id);
  if (errorLectura) return errorDeBase(supabase, errorLectura, RUTA);
  // Borrar algo que ya no existe no es un error: el resultado es el mismo.
  if (!actual) return NextResponse.json({ ok: true });

  const { error } = await supabase.from("pagos_gasto").delete().eq("id", id);
  if (error) return errorDeBase(supabase, error, RUTA);

  if (actual.comprobante_path) {
    const { error: errorArchivo } = await supabase.storage.from(BUCKET_COMPROBANTES).remove([actual.comprobante_path]);
    if (errorArchivo) {
      await registrarErrorServidor(supabase, {
        mensaje: `No se pudo borrar el comprobante ${actual.comprobante_path} del pago ${id}: ${errorArchivo.message}`,
        stack: null,
        ruta: RUTA,
      });
      return NextResponse.json({ ok: true, aviso: "El pago se borró, pero su comprobante no se pudo eliminar del archivo." });
    }
  }
  return NextResponse.json({ ok: true });
}

export const PATCH = conRegistroDeErrores(PATCH_, RUTA);
export const DELETE = conRegistroDeErrores(DELETE_, RUTA);
