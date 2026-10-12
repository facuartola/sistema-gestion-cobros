import { NextResponse } from "next/server";
import { conRegistroDeErrores } from "../../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase } from "../../../../lib/respuestasApi";
import {
  COLUMNAS_CERT,
  COLUMNAS_ENCUENTRO,
  COLUMNAS_EQUIPO,
  COLUMNAS_MODULO,
  COLUMNAS_SESION,
  NO_ENCONTRADO_MODULO,
  abrirSesion,
  certParaCliente,
  conTarifa,
  filaLiquidacion,
  ordenarEncuentros,
} from "../../../../lib/certificacionServidor";
import { esUuid } from "../../../../lib/validacion";

const RUTA = "/api/modulos/[id]";

// GET -> la planilla de un módulo:
//  { certificacion, modulo (con su fila de estado_modulos), encuentros,
//    sesiones (con el nombre del alumno), equipo, liquidacion (calcular_liquidacion),
//    practicas (cuántas prácticas finales tiene la certificación) }
async function GET_(request, { params }) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADO_MODULO, 404);

  const { data: modulo, error } = await supabase.from("modulos").select(COLUMNAS_MODULO).eq("id", id).maybeSingle();
  if (error) return errorDeBase(supabase, error, RUTA);
  if (!modulo) return errorCliente(NO_ENCONTRADO_MODULO, 404);

  const [cert, estado, encuentros, sesiones, equipo, liquidacion, modulosCert] = await Promise.all([
    supabase.from("certificaciones").select(COLUMNAS_CERT).eq("id", modulo.certificacion_id).single(),
    supabase.from("estado_modulos").select("*").eq("modulo_id", id).single(),
    supabase.from("encuentros").select(COLUMNAS_ENCUENTRO).eq("modulo_id", id),
    supabase.from("sesiones").select(`${COLUMNAS_SESION}, inscripciones(alumno_id, alumnos(nombre))`).eq("modulo_id", id),
    supabase.from("equipo").select(COLUMNAS_EQUIPO).order("nombre"),
    supabase.rpc("calcular_liquidacion", { p_modulo_id: id }),
    supabase.from("modulos").select("id, numero").eq("certificacion_id", modulo.certificacion_id),
  ]);
  for (const r of [cert, estado, encuentros, sesiones, equipo, liquidacion, modulosCert]) {
    if (r.error) return errorDeBase(supabase, r.error, RUTA);
  }

  const practicas = await supabase
    .from("encuentros")
    .select("id", { count: "exact", head: true })
    .eq("tipo", "practica_final")
    .in("modulo_id", modulosCert.data.map((m) => m.id));
  if (practicas.error) return errorDeBase(supabase, practicas.error, RUTA);

  return NextResponse.json({
    certificacion: certParaCliente(cert.data),
    modulo: { ...modulo, ...estado.data, id: modulo.id },
    encuentros: ordenarEncuentros(encuentros.data).map(conTarifa),
    sesiones: sesiones.data
      .map(({ inscripciones, ...s }) => ({ ...conTarifa(s), alumno_id: inscripciones?.alumno_id ?? null, alumno: inscripciones?.alumnos?.nombre ?? "" }))
      .sort((a, b) => a.alumno.localeCompare(b.alumno, "es")),
    equipo: equipo.data,
    liquidacion: liquidacion.data.map(filaLiquidacion),
    practicas: practicas.count ?? 0,
    modulos: modulosCert.data.sort((a, b) => a.numero - b.numero),
  });
}

export const GET = conRegistroDeErrores(GET_, RUTA);
