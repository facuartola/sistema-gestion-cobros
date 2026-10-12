import { NextResponse } from "next/server";
import { conRegistroDeErrores } from "../../../../lib/registrarErrorServidor";
import { errorCliente, errorDeBase, leerJson } from "../../../../lib/respuestasApi";
import { validarPersonaEquipo } from "../../../../lib/certificacionValidacion";
import { COLUMNAS_EQUIPO, NO_ENCONTRADA_PERSONA, abrirSesion, conTarifa, filaLiquidacion } from "../../../../lib/certificacionServidor";
import { esUuid } from "../../../../lib/validacion";

const RUTA = "/api/equipo/[id]";
const TIENE_HISTORIAL =
  "Esta persona tiene historial (encuentros, sesiones, alumnos o pagos), así que no se puede borrar. Desactivala: deja de aparecer para asignar y su historial se conserva.";

// GET -> ficha: { persona, cobrado, pendiente (lo hecho y no pagado, de
// calcular_pendientes en cada certificación), liquidaciones (últimos pagos),
// encuentros, sesiones }.
async function GET_(request, { params }) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADA_PERSONA, 404);

  const [persona, pagos, encuentros, sesiones, certs] = await Promise.all([
    supabase.from("equipo").select(COLUMNAS_EQUIPO).eq("id", id).maybeSingle(),
    supabase
      .from("pagos_gasto")
      .select("id, fecha_pago, monto, metodo_pago, descripcion, modulo_id, created_at")
      .eq("equipo_id", id)
      .order("fecha_pago", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("encuentros")
      .select("id, modulo_id, tipo, numero, fecha, dictado, tarifa, pago_gasto_id, modulos(numero, certificaciones(nombre))")
      .eq("profe_id", id),
    supabase
      .from("sesiones")
      .select("id, modulo_id, realizada, fecha_realizada, tarifa, pago_gasto_id, modulos(numero, certificaciones(nombre)), inscripciones(alumnos(nombre))")
      .eq("coach_id", id),
    supabase.from("certificaciones").select("id"),
  ]);
  for (const r of [persona, pagos, encuentros, sesiones, certs]) if (r.error) return errorDeBase(supabase, r.error, RUTA);
  if (!persona.data) return errorCliente(NO_ENCONTRADA_PERSONA, 404);

  const pendientes = await Promise.all(certs.data.map((c) => supabase.rpc("calcular_pendientes", { p_certificacion_id: c.id })));
  const pendientesPropios = [];
  for (const r of pendientes) {
    if (r.error) return errorDeBase(supabase, r.error, RUTA);
    pendientesPropios.push(...r.data.filter((f) => f.equipo_id === id).map(filaLiquidacion));
  }
  const faltaTarifa = pendientesPropios.some((f) => f.total === null);

  const porModulo = (a, b) => (a.modulo ?? 0) - (b.modulo ?? 0);
  return NextResponse.json({
    persona: persona.data,
    cobrado: pagos.data.reduce((acc, p) => acc + Number(p.monto), 0),
    pendiente: {
      filas: pendientesPropios,
      total: faltaTarifa ? null : pendientesPropios.reduce((acc, f) => acc + f.total, 0),
    },
    liquidaciones: pagos.data.slice(0, 10).map((p) => ({ ...p, monto: Number(p.monto) })),
    encuentros: encuentros.data
      .map(({ modulos, ...e }) => ({ ...conTarifa(e), modulo: modulos?.numero ?? null, certificacion: modulos?.certificaciones?.nombre ?? "" }))
      .sort(porModulo),
    sesiones: sesiones.data
      .map(({ modulos, inscripciones, ...s }) => ({
        ...conTarifa(s),
        modulo: modulos?.numero ?? null,
        certificacion: modulos?.certificaciones?.nombre ?? "",
        alumno: inscripciones?.alumnos?.nombre ?? "",
      }))
      .sort((a, b) => porModulo(a, b) || a.alumno.localeCompare(b.alumno, "es")),
  });
}

// PATCH { nombre?, contacto?, notas?, activo? }
async function PATCH_(request, { params }) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADA_PERSONA, 404);
  const { body, respuesta } = await leerJson(request);
  if (respuesta) return respuesta;

  const { datos, error } = validarPersonaEquipo(body, { creando: false });
  if (error) return errorCliente(error);

  const { data, error: errorEdicion } = await supabase.from("equipo").update(datos).eq("id", id).select(COLUMNAS_EQUIPO).maybeSingle();
  if (errorEdicion) return errorDeBase(supabase, errorEdicion, RUTA);
  if (!data) return errorCliente(NO_ENCONTRADA_PERSONA, 404);
  return NextResponse.json(data);
}

// DELETE -> solo una persona sin historial. Con historial se explica que se
// desactiva (la base además lo impide: las referencias son "restrict").
async function DELETE_(request, { params }) {
  const { supabase, rtaSesion } = await abrirSesion(request);
  if (rtaSesion) return rtaSesion;
  const { id } = await params;
  if (!esUuid(id)) return errorCliente(NO_ENCONTRADA_PERSONA, 404);

  const { count, error } = await supabase.from("pagos_gasto").select("id", { count: "exact", head: true }).eq("equipo_id", id);
  if (error) return errorDeBase(supabase, error, RUTA);
  if (count > 0) return errorCliente(TIENE_HISTORIAL, 409);

  const { error: errorBaja } = await supabase.from("equipo").delete().eq("id", id);
  if (errorBaja) return errorDeBase(supabase, errorBaja, RUTA, { 23503: TIENE_HISTORIAL });
  return NextResponse.json({ ok: true });
}

export const GET = conRegistroDeErrores(GET_, RUTA);
export const PATCH = conRegistroDeErrores(PATCH_, RUTA);
export const DELETE = conRegistroDeErrores(DELETE_, RUTA);
