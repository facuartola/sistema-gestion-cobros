import { NextResponse } from "next/server";
import { registrarErrorServidor } from "./registrarErrorServidor";
import { respuestaDeErrorIntencional } from "./certificacionValidacion";

export function errorCliente(mensaje, status = 400) {
  return NextResponse.json({ error: mensaje }, { status });
}

// request.json() tira si el body no es JSON válido; sin esto, eso terminaba
// como "error inesperado del servidor" (500) y ensuciaba /errores con algo
// que en realidad es un pedido mal armado.
export async function leerJson(request) {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return { body };
  } catch {
    // cae al return de abajo
  }
  return { respuesta: errorCliente("Los datos enviados no tienen el formato esperado.") };
}

// Traduce un error de Supabase/Postgres a un mensaje en castellano apto para
// mostrarse tal cual en pantalla. Antes se devolvía error.message crudo
// (p. ej. 'null value in column "jugador_id" ... violates not-null
// constraint'), que además de técnico expone detalles del esquema.
// Los errores que no son culpa del pedido se registran en errores_app con el
// mensaje técnico original, para que /errores muestre lo que pasó de verdad.
//
// `mensajes` permite que cada ruta diga mejor lo que significa un código en su
// contexto: { "23505": "Ya hay una categoría con ese nombre.", ... } (o
// { texto, status } para cambiar también el estado HTTP).
export async function errorDeBase(supabase, error, ruta, mensajes = {}) {
  const code = error?.code;
  // Errores que la base lanza a propósito (P0001), ya escritos en castellano.
  const intencional = respuestaDeErrorIntencional(error);
  if (intencional) return errorCliente(intencional.mensaje, intencional.status);
  if (code && mensajes[code]) {
    const m = mensajes[code];
    return typeof m === "string" ? errorCliente(m, 409) : errorCliente(m.texto, m.status ?? 409);
  }
  // PGRST303 = PostgREST rechazó el token ("JWT issued at future" y
  // similares). Se vio pasar justo después de renovar la sesión y
  // resolverse solo segundos después; PostgREST lo rechaza antes de
  // ejecutar nada, así que reintentar es seguro. apiFetch reintenta los 503
  // marcados como reintentables. Se registra igual, para poder medir cuánto
  // pasa en uso real.
  if (code === "PGRST303") {
    await registrarErrorServidor(supabase, { mensaje: `[${code}] ${error?.message}`, stack: null, ruta });
    return NextResponse.json(
      { error: "El servidor todavía no reconoce tu sesión recién renovada. Probá de nuevo en unos segundos.", reintentable: true },
      { status: 503 }
    );
  }
  if (code === "PGRST116") return errorCliente("No se encontró el registro. Puede que ya se haya borrado.", 404);
  if (code === "23503") return errorCliente("La persona asociada ya no existe.", 404);
  if (code === "23505") return errorCliente("Ya existe un registro igual.", 409);
  if (code === "23514") return errorCliente("Alguno de los datos está fuera del rango permitido.");
  if (code === "22P02" || code === "22007" || code === "22008" || code === "22003") {
    return errorCliente("Alguno de los datos enviados no es válido.");
  }

  await registrarErrorServidor(supabase, {
    mensaje: `[${code || "sin código"}] ${error?.message || "Error de base de datos"}`,
    stack: [error?.details, error?.hint].filter(Boolean).join("\n") || null,
    ruta,
  });
  return errorCliente("No se pudo completar la operación. Probá de nuevo en un momento.", 500);
}
