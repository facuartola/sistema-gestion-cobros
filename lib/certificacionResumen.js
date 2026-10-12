// Lo que Inicio y "Para hacer hoy" necesitan de las certificaciones en curso.
// La parte de cálculo es pura (armarResumenCertificacion) y la usan tanto la
// ruta /api/resumen como /demo; leerResumenCertificaciones trae los datos de la
// base con la sesión del usuario.
import { calcularLiquidacion, moduloEnCurso, pendientesTardios, resumenLiquidacion } from "./certificacion";
import { sumarDiasISO } from "./fechas";

// Días durante los que "Para hacer hoy" avisa que un alumno completó sus 10
// sesiones (contados desde la última).
const DIAS_AVISO_CERTIFICAR = 7;

// datos: { cert, estados (estado_modulos), avance (progreso_certificacion),
//          liquidaciones: { [modulo_id]: filas de calcular_liquidacion },
//          pendientes (calcular_pendientes), tardios (filas), ultimaSesion: { [inscripcion_id]: fecha } }
export function armarResumenCertificacion(datos, hoy) {
  const { cert, estados, avance, liquidaciones, pendientes, tardios, ultimaSesion } = datos;
  const enCurso = moduloEnCurso(estados);
  const desde = sumarDiasISO(hoy, -DIAS_AVISO_CERTIFICAR);
  const pendiente = resumenLiquidacion(pendientes);
  const tardio = resumenLiquidacion(tardios);
  return {
    id: cert.id,
    nombre: cert.nombre,
    moduloEnCurso: enCurso ? enCurso.numero : null,
    liquidados: estados.filter((f) => f.cerrado_en).length,
    alumnos: avance.length,
    enCondiciones: avance.filter((a) => a.en_condiciones).length,
    pendienteEquipo: { total: pendiente.total, personas: pendiente.personas, faltaTarifa: pendiente.faltaTarifa, vacio: pendiente.vacio },
    modulosListos: estados
      .filter((f) => f.listo_para_liquidar)
      .map((f) => {
        const r = resumenLiquidacion(liquidaciones[f.modulo_id] || []);
        return { modulo_id: f.modulo_id, numero: f.numero, total: r.total, personas: r.personas, faltaTarifa: r.faltaTarifa };
      }),
    tardios: tardio.vacio ? null : { total: tardio.total, personas: tardio.personas, faltaTarifa: tardio.faltaTarifa },
    listosParaCertificar: avance
      .filter((a) => a.en_condiciones && (ultimaSesion[a.inscripcion_id] ?? "") >= desde)
      .map((a) => ({ inscripcion_id: a.inscripcion_id, alumno: a.alumno })),
  };
}

// Lo mismo, a partir de los datos en memoria (para /demo).
export function resumenDesdeDatos(datos, { estados, avance, pendientes }, hoy) {
  const liquidaciones = Object.fromEntries(
    estados.filter((f) => f.listo_para_liquidar).map((f) => [f.modulo_id, calcularLiquidacion(datos, f.modulo_id)])
  );
  return armarResumenCertificacion(
    { cert: datos.cert, estados, avance, liquidaciones, pendientes, tardios: pendientesTardios(datos), ultimaSesion: ultimaSesionPorInscripcion(datos.sesiones) },
    hoy
  );
}

function ultimaSesionPorInscripcion(sesiones) {
  const ultima = {};
  for (const s of sesiones) {
    if (!s.realizada || !s.fecha_realizada) continue;
    if (!ultima[s.inscripcion_id] || s.fecha_realizada > ultima[s.inscripcion_id]) ultima[s.inscripcion_id] = s.fecha_realizada;
  }
  return ultima;
}

const aNumero = (filas) => filas.map((x) => ({ ...x, total: x.total === null ? null : Number(x.total) }));

// Una certificación: todas las lecturas en paralelo (los encuentros y sesiones
// se filtran por la certificación con un join, sin esperar a los módulos).
export async function leerUna(supabase, cert, equipo, hoy) {
  const [estados, avance, pendientes, modulos, encuentros, sesiones] = await Promise.all([
    supabase.from("estado_modulos").select("*").eq("certificacion_id", cert.id).order("numero"),
    supabase.from("progreso_certificacion").select("*").eq("certificacion_id", cert.id),
    supabase.rpc("calcular_pendientes", { p_certificacion_id: cert.id }),
    supabase.from("modulos").select("id, certificacion_id, numero, cerrado_en").eq("certificacion_id", cert.id),
    supabase
      .from("encuentros")
      .select("id, modulo_id, tipo, profe_id, tarifa, dictado, pago_gasto_id, modulos!inner(certificacion_id)")
      .eq("modulos.certificacion_id", cert.id)
      .eq("dictado", true),
    supabase
      .from("sesiones")
      .select("id, inscripcion_id, modulo_id, coach_id, realizada, fecha_realizada, tarifa, pago_gasto_id, modulos!inner(certificacion_id)")
      .eq("modulos.certificacion_id", cert.id)
      .eq("realizada", true),
  ]);
  for (const r of [estados, avance, pendientes, modulos, encuentros, sesiones]) if (r.error) return { error: r.error };

  const listos = estados.data.filter((f) => f.listo_para_liquidar);
  const calculos = await Promise.all(listos.map((f) => supabase.rpc("calcular_liquidacion", { p_modulo_id: f.modulo_id })));
  const liquidaciones = {};
  for (const [i, r] of calculos.entries()) {
    if (r.error) return { error: r.error };
    liquidaciones[listos[i].modulo_id] = aNumero(r.data);
  }

  const datos = { cert, modulos: modulos.data, encuentros: encuentros.data, sesiones: sesiones.data, equipo };
  return {
    data: armarResumenCertificacion(
      {
        cert,
        estados: estados.data,
        avance: avance.data,
        liquidaciones,
        pendientes: aNumero(pendientes.data),
        tardios: pendientesTardios(datos),
        ultimaSesion: ultimaSesionPorInscripcion(sesiones.data),
      },
      hoy
    ),
  };
}

// Lee de la base el resumen de cada certificación en curso, todas en paralelo.
// { data } o { error }.
export async function leerResumenCertificaciones(supabase, hoy) {
  const [certs, equipo] = await Promise.all([
    supabase
      .from("certificaciones")
      .select("id, nombre, tarifa_sesion, tarifa_encuentro, tarifa_practica, estado")
      .eq("estado", "en_curso")
      .order("created_at"),
    supabase.from("equipo").select("id, nombre"),
  ]);
  for (const r of [certs, equipo]) if (r.error) return { error: r.error };

  const resultados = await Promise.all(certs.data.map((cert) => leerUna(supabase, cert, equipo.data, hoy)));
  const conError = resultados.find((r) => r.error);
  if (conError) return { error: conError.error };
  return { data: resultados.map((r) => r.data) };
}
