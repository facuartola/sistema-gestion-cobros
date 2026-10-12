import { NextResponse } from "next/server";
import { supabaseForRequest } from "../../../../lib/supabaseServer";
import { exigirSesion } from "../../../../lib/apiAuth";
import { conRegistroDeErrores } from "../../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase, leerJson } from "../../../../lib/respuestasApi";
import { idsDelGrupo } from "../../../../lib/gastos";
import { puedeBorrarCategoria, validarCategoriaEdicion } from "../../../../lib/gastosValidacion";
import {
  COLUMNAS_CATEGORIA,
  MENSAJES_CATEGORIA,
  NO_ENCONTRADA_CATEGORIA,
  categoriaParaCliente,
  leerCategorias,
} from "../../../../lib/gastosServidor";
import { esUuid } from "../../../../lib/validacion";

const RUTA = "/api/categorias-gasto/[id]";

// PATCH -> renombrar, ordenar, mover a otra carpeta, cambiar recurrencia/monto/
// vencimiento o desactivar/activar. Desactivar un tipo desactiva toda su rama (si no,
// sus subtipos seguirían apareciendo en los avisos). Los tipos con `clave` (pago
// al equipo) se pueden renombrar, no mover ni desactivar. Mover lleva el tipo al
// final de la carpeta nueva; la carpeta nueva no puede tener pagos propios. Las
// mismas reglas están en la base (trigger proteger_categorias), que además limita
// el árbol a 3 niveles.
async function PATCH_(request, { params }) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADA_CATEGORIA, 404);
  const { body, respuesta } = await leerJson(request);
  if (respuesta) return respuesta;

  const { data: categorias, error: errorLectura } = await leerCategorias(supabase);
  if (errorLectura) return errorDeBase(supabase, errorLectura, RUTA);
  const categoria = categorias.find((c) => c.id === id);
  if (!categoria) return errorCliente(NO_ENCONTRADA_CATEGORIA, 404);

  const { datos, error } = validarCategoriaEdicion(body, categoria, categorias);
  if (error) return errorCliente(error);

  if (datos.parent_id !== undefined) {
    if (datos.parent_id) {
      const { count, error: errorPagos } = await supabase
        .from("pagos_gasto")
        .select("id", { count: "exact", head: true })
        .eq("categoria_id", datos.parent_id);
      if (errorPagos) return errorDeBase(supabase, errorPagos, RUTA);
      if (count > 0) {
        const padre = categorias.find((c) => c.id === datos.parent_id);
        return errorCliente(
          `“${padre.nombre}” ya tiene ${count} ${count === 1 ? "pago registrado" : "pagos registrados"}: no puede pasar a ser una carpeta. Elegí otra carpeta.`
        );
      }
    }
    // Va al final de la carpeta nueva.
    datos.orden = categorias.filter((c) => (c.parent_id ?? null) === datos.parent_id && c.id !== id).reduce((max, c) => Math.max(max, c.orden), 0) + 1;
  }

  if (datos.activo === false) {
    const rama = idsDelGrupo(id, categorias);
    const conClave = categorias.find((c) => rama.includes(c.id) && c.clave && c.id !== id);
    if (conClave) {
      return errorCliente(
        `No se puede desactivar “${categoria.nombre}”: adentro está “${conClave.nombre}”, que es automático (lo genera Pagar al equipo).`
      );
    }
    const { error: errorRama } = await supabase.from("categorias_gasto").update({ activo: false }).in("id", rama);
    if (errorRama) return errorDeBase(supabase, errorRama, RUTA);
    const { activo: _activo, ...resto } = datos;
    if (Object.keys(resto).length > 0) {
      const { error: errorResto } = await supabase.from("categorias_gasto").update(resto).eq("id", id);
      if (errorResto) return errorDeBase(supabase, errorResto, RUTA, MENSAJES_CATEGORIA);
    }
  } else {
    const { error: errorCambio } = await supabase.from("categorias_gasto").update(datos).eq("id", id);
    if (errorCambio) return errorDeBase(supabase, errorCambio, RUTA, MENSAJES_CATEGORIA);
  }

  const { data, error: errorFinal } = await supabase
    .from("categorias_gasto")
    .select(COLUMNAS_CATEGORIA)
    .eq("id", id)
    .single();
  if (errorFinal) return errorDeBase(supabase, errorFinal, RUTA);
  return NextResponse.json(categoriaParaCliente(data));
}

// DELETE -> solo una categoría sin pagos, sin subcategorías y sin `clave`. Con
// pagos se explica que puede desactivarla.
async function DELETE_(request, { params }) {
  const supabase = supabaseForRequest(request);
  const rtaSesion = await exigirSesion(supabase);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADA_CATEGORIA, 404);

  const { data: categorias, error: errorLectura } = await leerCategorias(supabase);
  if (errorLectura) return errorDeBase(supabase, errorLectura, RUTA);
  const categoria = categorias.find((c) => c.id === id);
  // Borrar algo que ya no existe no es un error: el resultado es el mismo.
  if (!categoria) return NextResponse.json({ ok: true });

  const { count, error: errorPagos } = await supabase
    .from("pagos_gasto")
    .select("id", { count: "exact", head: true })
    .eq("categoria_id", id);
  if (errorPagos) return errorDeBase(supabase, errorPagos, RUTA);

  const permiso = puedeBorrarCategoria(categoria, categorias, count ?? 0);
  if (permiso.error) return errorCliente(permiso.error, 409);

  const { error } = await supabase.from("categorias_gasto").delete().eq("id", id);
  if (error) {
    return errorDeBase(supabase, error, RUTA, {
      23503: "Ese tipo de gasto ya tiene pagos o subtipos, así que no se puede borrar. Podés desactivarla.",
    });
  }
  return NextResponse.json({ ok: true });
}

export const PATCH = conRegistroDeErrores(PATCH_, RUTA);
export const DELETE = conRegistroDeErrores(DELETE_, RUTA);
