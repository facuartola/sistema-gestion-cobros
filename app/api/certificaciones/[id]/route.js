import { NextResponse } from "next/server";
import { conRegistroDeErrores } from "../../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase, leerJson } from "../../../../lib/respuestasApi";
import { validarCertificacion } from "../../../../lib/certificacionValidacion";
import {
  COLUMNAS_CERT,
  COLUMNAS_EQUIPO,
  NO_ENCONTRADA_CERT,
  abrirSesion,
  certParaCliente,
  filaLiquidacion,
} from "../../../../lib/certificacionServidor";
import { leerUna } from "../../../../lib/certificacionResumen";
import { hoyArgentinaISO } from "../../../../lib/fechas";
import { esUuid } from "../../../../lib/validacion";

const RUTA = "/api/certificaciones/[id]";

// GET -> todo lo que muestra el resumen de una certificación:
//  { certificacion, modulos (estado_modulos), avance (progreso_certificacion),
//    pendientes (calcular_pendientes), equipo, alumnos (activos, para inscribir),
//    listos (módulos listos para pagar, con su total) y tardios (lo hecho y no
//    pagado de módulos ya cerrados) }
async function GET_(request, { params }) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADA_CERT, 404);

  const [cert, modulos, avance, pendientes, equipo, alumnos] = await Promise.all([
    supabase.from("certificaciones").select(COLUMNAS_CERT).eq("id", id).maybeSingle(),
    supabase.from("estado_modulos").select("*").eq("certificacion_id", id).order("numero"),
    supabase.from("progreso_certificacion").select("*").eq("certificacion_id", id).order("alumno"),
    supabase.rpc("calcular_pendientes", { p_certificacion_id: id }),
    supabase.from("equipo").select(COLUMNAS_EQUIPO).order("nombre"),
    supabase.from("alumnos").select("id, nombre").eq("activo", true).order("nombre"),
  ]);
  for (const r of [cert, modulos, avance, pendientes, equipo, alumnos]) if (r.error) return errorDeBase(supabase, r.error, RUTA);
  if (!cert.data) return errorCliente(NO_ENCONTRADA_CERT, 404);

  // Los avisos de la pantalla (módulo listo para pagar y pagos atrasados) salen
  // del mismo cálculo que usa el Inicio.
  const avisos = await leerUna(supabase, certParaCliente(cert.data), equipo.data, hoyArgentinaISO());
  if (avisos.error) return errorDeBase(supabase, avisos.error, RUTA);

  return NextResponse.json({
    certificacion: certParaCliente(cert.data),
    modulos: modulos.data,
    avance: avance.data,
    pendientes: pendientes.data.map(filaLiquidacion),
    equipo: equipo.data,
    alumnos: alumnos.data,
    listos: avisos.data.modulosListos,
    tardios: avisos.data.tardios,
  });
}

// PATCH -> editar nombre, fecha, tarifas o estado. Las tarifas nuevas valen para
// lo que todavía no se pagó; lo ya pagado no cambia.
async function PATCH_(request, { params }) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADA_CERT, 404);
  const { body, respuesta } = await leerJson(request);
  if (respuesta) return respuesta;

  const { datos, error } = validarCertificacion(body, { creando: false });
  if (error) return errorCliente(error);

  const { data, error: errorEdicion } = await supabase.from("certificaciones").update(datos).eq("id", id).select(COLUMNAS_CERT).maybeSingle();
  if (errorEdicion) return errorDeBase(supabase, errorEdicion, RUTA);
  if (!data) return errorCliente(NO_ENCONTRADA_CERT, 404);
  return NextResponse.json(certParaCliente(data));
}

export const GET = conRegistroDeErrores(GET_, RUTA);
export const PATCH = conRegistroDeErrores(PATCH_, RUTA);
