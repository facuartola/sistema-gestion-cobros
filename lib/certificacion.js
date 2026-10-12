// Lógica de la certificación, toda pura (sin red ni React). Reproduce en
// JavaScript lo que hacen en la base las vistas estado_modulos y
// progreso_certificacion y las funciones calcular_liquidacion,
// calcular_pendientes, liquidar_modulo y liquidar_pendientes (ver
// supabase/migrations/2026100415*, 20261004160015 y 20261004211811). La usan
// /demo (que no llama a la base) y los cálculos de Inicio; los tests la fijan
// con los mismos números que se verificaron en la base real.
//
// Formas de dato: las filas tal cual vienen de la base.
//   cert       { id, nombre, tarifa_sesion, tarifa_encuentro, tarifa_practica, estado }
//   modulo     { id, certificacion_id, numero, fecha_inicio, fecha_fin, cerrado_en }
//   encuentro  { id, modulo_id, tipo, numero, fecha, profe_id, tarifa, dictado, pago_gasto_id }
//   sesion     { id, inscripcion_id, modulo_id, coach_id, realizada, fecha_realizada, tarifa, pago_gasto_id }
//   persona    { id, nombre, activo } (tabla equipo)

export const MODULOS = 10;
const ENCUENTROS_POR_MODULO = 4;
export const MAX_PRACTICAS = 5;
export const MODULOS_CON_PRACTICA = [9, 10];

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

// Lo que cobra un encuentro: su tarifa especial, o la de la certificación (las
// prácticas finales usan tarifa_practica y, si no hay, tarifa_encuentro).
export function montoEncuentro(e, cert) {
  if (num(e.tarifa) !== null) return num(e.tarifa);
  if (e.tipo === "practica_final") return num(cert.tarifa_practica) ?? num(cert.tarifa_encuentro);
  return num(cert.tarifa_encuentro);
}

export function montoSesion(s, cert) {
  return num(s.tarifa) ?? num(cert.tarifa_sesion);
}

// Ítems hechos y sin pagar (encuentros dictados y sesiones realizadas). Con
// `hastaNumero`, solo los de ese módulo y los anteriores.
function itemsImpagos({ cert, modulos, encuentros, sesiones }, hastaNumero = null) {
  const numeroDe = new Map(modulos.filter((m) => m.certificacion_id === cert.id).map((m) => [m.id, m.numero]));
  const entra = (moduloId) => numeroDe.has(moduloId) && (hastaNumero === null || numeroDe.get(moduloId) <= hastaNumero);
  const items = [];
  for (const e of encuentros) {
    if (e.dictado && !e.pago_gasto_id && entra(e.modulo_id)) items.push({ eid: e.profe_id, concepto: "encuentros", monto: montoEncuentro(e, cert), item: e });
  }
  for (const s of sesiones) {
    if (s.realizada && !s.pago_gasto_id && entra(s.modulo_id)) items.push({ eid: s.coach_id, concepto: "sesiones", monto: montoSesion(s, cert), item: s });
  }
  return items;
}

// Agrupa por persona y concepto: { equipo_id, nombre, concepto, cantidad, total }.
// Si algún ítem no tiene tarifa, el total es null (igual que en la base).
function agrupar(items, equipo) {
  const personas = new Map(equipo.map((p) => [p.id, p]));
  const grupos = new Map();
  for (const it of items) {
    const persona = personas.get(it.eid);
    if (!persona) continue;
    const clave = `${it.eid}|${it.concepto}`;
    if (!grupos.has(clave)) grupos.set(clave, { equipo_id: it.eid, nombre: persona.nombre, concepto: it.concepto, cantidad: 0, total: 0 });
    const g = grupos.get(clave);
    g.cantidad += 1;
    g.total = g.total === null || it.monto === null ? null : g.total + it.monto;
  }
  return [...grupos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es") || a.concepto.localeCompare(b.concepto));
}

// calcular_liquidacion(p_modulo_id): lo que se paga al cerrar ese módulo
// (incluye lo hecho y no pagado de módulos anteriores).
export function calcularLiquidacion(datos, moduloId) {
  const modulo = datos.modulos.find((m) => m.id === moduloId);
  if (!modulo) return [];
  return agrupar(itemsImpagos(datos, modulo.numero), datos.equipo);
}

// calcular_pendientes(p_certificacion_id): todo lo hecho y no pagado.
export function calcularPendientes(datos) {
  return agrupar(itemsImpagos(datos), datos.equipo);
}

// Total, cantidad de personas y si falta alguna tarifa.
export function resumenLiquidacion(filas) {
  const faltaTarifa = filas.some((f) => f.total === null);
  return {
    total: faltaTarifa ? null : filas.reduce((acc, f) => acc + Number(f.total), 0),
    personas: new Set(filas.map((f) => f.equipo_id)).size,
    faltaTarifa,
    vacio: filas.length === 0,
  };
}

// "1 sesión", "3 encuentros".
export function textoCantidad(concepto, cantidad) {
  if (concepto === "sesiones") return cantidad === 1 ? "1 sesión" : `${cantidad} sesiones`;
  return cantidad === 1 ? "1 encuentro" : `${cantidad} encuentros`;
}

// Descripción del pago en Gastos, igual que la arma la base.
export function descripcionPago(certNombre, moduloNumero, concepto, cantidad) {
  const donde = moduloNumero == null ? "Pagos atrasados" : `Módulo ${moduloNumero}`;
  return `${certNombre} · ${donde} · ${textoCantidad(concepto, cantidad)}`;
}

// liquidar_modulo / liquidar_pendientes en memoria. Devuelve los datos nuevos y
// los pagos creados; tira Error con los mismos mensajes que la base.
//   opciones: { moduloId (null = pendientes), fecha_pago, metodo_pago,
//               categorias: { sesiones, encuentros }, nuevoId, ahora }
export function liquidar(datos, { moduloId = null, fecha_pago, metodo_pago, categorias, nuevoId, ahora = new Date().toISOString() }) {
  if (metodo_pago != null && !["efectivo", "transferencia"].includes(metodo_pago)) throw new Error("Método de pago inválido");
  const modulo = moduloId ? datos.modulos.find((m) => m.id === moduloId) : null;
  if (moduloId && !modulo) throw new Error("El módulo no existe");
  if (modulo?.cerrado_en) throw new Error("Este módulo ya fue pagado");
  if (!categorias?.sesiones || !categorias?.encuentros) throw new Error("Faltan los tipos de gasto de pago al equipo de coaches");

  const filas = modulo ? calcularLiquidacion(datos, moduloId) : calcularPendientes(datos);
  if (filas.some((f) => f.total === null)) throw new Error("Falta definir la tarifa de la certificación antes de pagar al equipo");

  const items = itemsImpagos(datos, modulo ? modulo.numero : null);
  const pagoDe = new Map(); // ítem id -> pago id
  const pagos = [];
  for (const f of filas) {
    if (!(f.total > 0)) continue;
    const pago = {
      id: nuevoId(),
      categoria_id: f.concepto === "sesiones" ? categorias.sesiones : categorias.encuentros,
      fecha_pago,
      periodo: null,
      monto: f.total,
      metodo_pago: metodo_pago ?? null,
      descripcion: descripcionPago(datos.cert.nombre, modulo ? modulo.numero : null, f.concepto, f.cantidad),
      proveedor: null,
      comprobante_path: null,
      equipo_id: f.equipo_id,
      modulo_id: modulo ? modulo.id : null,
      created_at: ahora,
    };
    pagos.push(pago);
    for (const it of items) if (it.eid === f.equipo_id && it.concepto === f.concepto) pagoDe.set(it.item.id, pago.id);
  }

  return {
    pagos,
    datos: {
      ...datos,
      encuentros: datos.encuentros.map((e) => (pagoDe.has(e.id) ? { ...e, pago_gasto_id: pagoDe.get(e.id) } : e)),
      sesiones: datos.sesiones.map((s) => (pagoDe.has(s.id) ? { ...s, pago_gasto_id: pagoDe.get(s.id) } : s)),
      modulos: modulo ? datos.modulos.map((m) => (m.id === modulo.id ? { ...m, cerrado_en: ahora } : m)) : datos.modulos,
    },
  };
}

// --- Vistas -----------------------------------------------------------------------

// estado_modulos: por módulo, encuentros y sesiones hechos y si está listo para
// liquidar (no cerrado, con sus 4 encuentros regulares y todos dictados).
export function estadoDeModulos({ modulos, encuentros, sesiones }) {
  return [...modulos]
    .sort((a, b) => a.numero - b.numero)
    .map((m) => {
      const enc = encuentros.filter((e) => e.modulo_id === m.id);
      const ses = sesiones.filter((s) => s.modulo_id === m.id);
      const regulares = enc.filter((e) => e.tipo === "regular").length;
      return {
        modulo_id: m.id,
        certificacion_id: m.certificacion_id,
        numero: m.numero,
        fecha_inicio: m.fecha_inicio ?? null,
        fecha_fin: m.fecha_fin ?? null,
        cerrado_en: m.cerrado_en ?? null,
        encuentros_regulares: regulares,
        encuentros_total: enc.length,
        encuentros_dictados: enc.filter((e) => e.dictado).length,
        sesiones_total: ses.length,
        sesiones_realizadas: ses.filter((s) => s.realizada).length,
        listo_para_liquidar: !m.cerrado_en && regulares >= ENCUENTROS_POR_MODULO && enc.every((e) => e.dictado),
      };
    });
}

// "liquidado", "listo" o "en_curso" a partir de una fila de estado_modulos.
export function estadoModulo(fila) {
  if (fila.cerrado_en) return "liquidado";
  if (fila.listo_para_liquidar) return "listo";
  return "en_curso";
}

// El módulo en curso: el primero sin liquidar. null si están todos liquidados.
export function moduloEnCurso(estados) {
  return estados.find((f) => !f.cerrado_en) || null;
}

// progreso_certificacion: avance de cada alumno inscripto.
export function progresoAlumnos({ inscripciones, sesiones, alumnos, equipo }) {
  const nombreAlumno = new Map(alumnos.map((a) => [a.id, a.nombre]));
  const nombrePersona = new Map(equipo.map((p) => [p.id, p.nombre]));
  return inscripciones
    .map((i) => {
      const propias = sesiones.filter((s) => s.inscripcion_id === i.id);
      const realizadas = propias.filter((s) => s.realizada).length;
      return {
        inscripcion_id: i.id,
        certificacion_id: i.certificacion_id,
        alumno_id: i.alumno_id,
        alumno: nombreAlumno.get(i.alumno_id) ?? "",
        coach_id: i.coach_id ?? null,
        coach: i.coach_id ? (nombrePersona.get(i.coach_id) ?? null) : null,
        sesiones_realizadas: realizadas,
        sesiones_totales: propias.length,
        en_condiciones: realizadas === MODULOS,
      };
    })
    .filter((p) => p.sesiones_totales > 0)
    .sort((a, b) => a.alumno.localeCompare(b.alumno, "es"));
}

// Cambiar el coach de una inscripción: pasan al nuevo solo las sesiones no hechas
// y no pagadas (las hechas conservan a quien las dio).
export function cambiarCoach({ inscripciones, sesiones }, inscripcionId, coachId) {
  return {
    inscripciones: inscripciones.map((i) => (i.id === inscripcionId ? { ...i, coach_id: coachId } : i)),
    sesiones: sesiones.map((s) =>
      s.inscripcion_id === inscripcionId && !s.realizada && !s.pago_gasto_id ? { ...s, coach_id: coachId } : s
    ),
  };
}

// Ítems hechos y no pagados de módulos ya liquidados: lo que se completó tarde.
// Es lo que avisa "Para hacer hoy" (lo de un módulo abierto se paga al cerrarlo).
export function pendientesTardios(datos) {
  const cerrados = new Set(datos.modulos.filter((m) => m.cerrado_en).map((m) => m.id));
  return calcularPendientes({
    ...datos,
    encuentros: datos.encuentros.filter((e) => cerrados.has(e.modulo_id)),
    sesiones: datos.sesiones.filter((s) => cerrados.has(s.modulo_id)),
  });
}

// Prácticas finales: dónde se puede agregar una y cuál es su número.
export function validarNuevaPractica({ modulos, encuentros }, moduloId) {
  const modulo = modulos.find((m) => m.id === moduloId);
  if (!modulo) return { error: "El módulo no existe" };
  if (!MODULOS_CON_PRACTICA.includes(modulo.numero)) return { error: "Las prácticas finales solo pueden estar en los módulos 9 y 10" };
  const deLaCert = new Set(modulos.filter((m) => m.certificacion_id === modulo.certificacion_id).map((m) => m.id));
  const practicas = encuentros.filter((e) => e.tipo === "practica_final" && deLaCert.has(e.modulo_id));
  if (practicas.length >= MAX_PRACTICAS) return { error: "Una certificación tiene como máximo 5 encuentros de práctica final" };
  const usados = new Set(practicas.filter((e) => e.modulo_id === moduloId).map((e) => e.numero));
  let numero = 1;
  while (usados.has(numero)) numero += 1;
  return { numero };
}
