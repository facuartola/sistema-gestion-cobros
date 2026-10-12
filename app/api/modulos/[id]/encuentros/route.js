import { NextResponse } from "next/server";
import { conRegistroDeErrores } from "../../../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase } from "../../../../../lib/respuestasApi";
import { COLUMNAS_ENCUENTRO, NO_ENCONTRADO_MODULO, abrirSesion, conTarifa } from "../../../../../lib/certificacionServidor";
import { esUuid } from "../../../../../lib/validacion";

const RUTA = "/api/modulos/[id]/encuentros";

// POST -> agregar una práctica final al módulo. Las reglas (solo módulos 9 y 10,
// máximo 5 por certificación) las valida la base y su mensaje se devuelve tal cual.
async function POST_(request, { params }) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADO_MODULO, 404);

  const { data: existentes, error } = await supabase.from("encuentros").select("numero").eq("modulo_id", id).eq("tipo", "practica_final");
  if (error) return errorDeBase(supabase, error, RUTA);
  // El número es único dentro del módulo: el primero libre.
  const usados = new Set(existentes.map((e) => e.numero));
  let numero = 1;
  while (usados.has(numero)) numero += 1;

  const { data, error: errorAlta } = await supabase
    .from("encuentros")
    .insert({ modulo_id: id, tipo: "practica_final", numero })
    .select(COLUMNAS_ENCUENTRO)
    .single();
  if (errorAlta) {
    return errorDeBase(supabase, errorAlta, RUTA, {
      23503: { texto: NO_ENCONTRADO_MODULO, status: 404 },
      23505: "Se agregó otra práctica al mismo tiempo. Probá de nuevo.",
      23514: { texto: "No se pueden agregar más prácticas en este módulo.", status: 400 },
    });
  }
  return NextResponse.json(conTarifa(data), { status: 201 });
}

export const POST = conRegistroDeErrores(POST_, RUTA);
