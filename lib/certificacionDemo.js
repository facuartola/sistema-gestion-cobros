// Certificación de ejemplo para /demo: equipo, alumnos inscriptos con distinto
// avance, dos módulos ya liquidados, el 3 listo para liquidar y una sesión hecha
// tarde. Todo en memoria, con la misma interfaz que la capa real
// (lib/dataProvider.js) y la misma lógica que la base, reimplementada en
// lib/certificacion.js. Nunca llama a la API.
import {
  calcularLiquidacion,
  calcularPendientes,
  cambiarCoach,
  estadoDeModulos,
  liquidar,
  progresoAlumnos,
  validarNuevaPractica,
} from "./certificacion";
import {
  validarCambioCoach,
  validarCambiosEncuentro,
  validarCambiosSesion,
  validarCertificacion,
  validarLiquidacion,
  validarPersonaEquipo,
} from "./certificacionValidacion";
import { resumenDesdeDatos } from "./certificacionResumen";
import { hoyArgentinaISO, sumarDiasISO } from "./fechas";

const ENCUENTRO_PAGADO = "Este encuentro ya fue pagado: para corregirlo, primero eliminá el pago en Gastos";
const SESION_PAGADA = "Esta sesión ya fue pagada: para corregirla, primero eliminá el pago en Gastos";

function generadorDeIds() {
  let n = 0;
  return () => `00000000-0000-4000-9000-${String((n += 1)).padStart(12, "0")}`;
}

function nuevaCertificacion(nuevoId, datos) {
  const cert = { id: nuevoId(), estado: "en_curso", fecha_inicio: null, tarifa_sesion: null, tarifa_encuentro: null, tarifa_practica: null, created_at: new Date().toISOString(), ...datos };
  const modulos = Array.from({ length: 10 }, (_, i) => ({ id: nuevoId(), certificacion_id: cert.id, numero: i + 1, fecha_inicio: null, fecha_fin: null, cerrado_en: null }));
  const encuentros = modulos.flatMap((m) =>
    [1, 2, 3, 4].map((numero) => ({ id: nuevoId(), modulo_id: m.id, tipo: "regular", numero, fecha: null, profe_id: null, tarifa: null, dictado: false, pago_gasto_id: null }))
  );
  return { cert, modulos, encuentros };
}

function sesionesPara(nuevoId, inscripcion, modulos) {
  return modulos
    .filter((m) => m.certificacion_id === inscripcion.certificacion_id)
    .map((m) => ({ id: nuevoId(), inscripcion_id: inscripcion.id, modulo_id: m.id, coach_id: inscripcion.coach_id, realizada: false, fecha_realizada: null, tarifa: null, pago_gasto_id: null }));
}

//   gastos: lo que expone lib/gastosDemo.js (agregarPagos, categoriasDeLiquidacion, instantanea).
//   alumnosActivos(): alumnos de la demo ({ id, nombre }).
export function crearCertificacionDemo({ gastos, alumnosActivos }) {
  const nuevoId = generadorDeIds();
  const hoy = hoyArgentinaISO();
  const dia = (d) => sumarDiasISO(hoy, d);

  let equipo = [
    ["Laura Pérez", "Coach"],
    ["Martín Ríos", "Coach"],
    ["Sofía Gómez", "Profe"],
    ["Diego Herrera", "Profe"],
    ["Paula Díaz", "Profe y coach"],
    ["Julián Sosa", "Profe invitado"],
  ].map(([nombre, notas]) => ({ id: nuevoId(), nombre, contacto: null, notas, activo: true, created_at: `${dia(-120)}T12:00:00.000Z` }));
  const [laura, martin, sofia, diego, paula, julian] = equipo.map((p) => p.id);

  const base = nuevaCertificacion(nuevoId, {
    nombre: "Certificación 2026",
    fecha_inicio: dia(-70),
    tarifa_sesion: 50,
    tarifa_encuentro: 40,
    tarifa_practica: 60,
  });
  let certificaciones = [base.cert];
  let modulos = base.modulos;
  let encuentros = base.encuentros;
  let inscripciones = [];
  let sesiones = [];

  // Inscriptos: los primeros 4 alumnos de la demo, repartidos entre dos coaches.
  alumnosActivos()
    .slice(0, 4)
    .forEach((a, i) => {
      const ins = { id: nuevoId(), certificacion_id: base.cert.id, alumno_id: a.id, coach_id: i % 2 === 0 ? laura : martin, created_at: `${dia(-70)}T12:00:00.000Z` };
      inscripciones.push(ins);
      sesiones.push(...sesionesPara(nuevoId, ins, modulos));
    });

  const numeroDe = (id) => modulos.find((m) => m.id === id).numero;
  const profes = { 1: sofia, 2: sofia, 3: diego, 4: paula };
  // Módulos 1 a 3 con sus encuentros dictados (en el 3, el último lo da un invitado con tarifa especial).
  encuentros = encuentros.map((e) => {
    const n = numeroDe(e.modulo_id);
    if (n > 3) return e;
    const invitado = n === 3 && e.numero === 4;
    return { ...e, profe_id: invitado ? julian : profes[e.numero], dictado: true, tarifa: invitado ? 100 : null, fecha: dia(-70 + (n - 1) * 21 + e.numero * 3) };
  });
  // Sesiones: avance distinto por alumno (3, 3, 2 y 1 sesiones).
  const avance = [3, 3, 2, 1];
  sesiones = sesiones.map((s) => {
    const i = inscripciones.findIndex((x) => x.id === s.inscripcion_id);
    const n = numeroDe(s.modulo_id);
    if (n > avance[i] || (i === 2 && n === 2)) return s;
    return { ...s, realizada: true, fecha_realizada: dia(-66 + (n - 1) * 21 + i) };
  });

  function datosDe(certId) {
    const cert = certificaciones.find((c) => c.id === certId);
    const mods = modulos.filter((m) => m.certificacion_id === certId);
    const ids = new Set(mods.map((m) => m.id));
    return {
      cert,
      modulos: mods,
      encuentros: encuentros.filter((e) => ids.has(e.modulo_id)),
      sesiones: sesiones.filter((s) => ids.has(s.modulo_id)),
      equipo,
      inscripciones: inscripciones.filter((i) => i.certificacion_id === certId),
      alumnos: alumnosActivos(),
    };
  }

  function aplicar(nuevos) {
    const enc = new Map(nuevos.encuentros.map((e) => [e.id, e]));
    const ses = new Map(nuevos.sesiones.map((s) => [s.id, s]));
    const mod = new Map(nuevos.modulos.map((m) => [m.id, m]));
    encuentros = encuentros.map((e) => enc.get(e.id) ?? e);
    sesiones = sesiones.map((s) => ses.get(s.id) ?? s);
    modulos = modulos.map((m) => mod.get(m.id) ?? m);
  }

  function ejecutarLiquidacion(certId, { moduloId = null, fecha_pago, metodo_pago, ahora }) {
    const { datos, pagos } = liquidar(datosDe(certId), {
      moduloId,
      fecha_pago,
      metodo_pago,
      categorias: gastos.categoriasDeLiquidacion(),
      nuevoId: () => crypto.randomUUID(),
      ahora,
    });
    aplicar(datos);
    gastos.agregarPagos(pagos);
    return pagos;
  }

  // Módulos 1 y 2 ya liquidados; después, una sesión del módulo 2 hecha tarde.
  ejecutarLiquidacion(base.cert.id, { moduloId: modulos[0].id, fecha_pago: dia(-45), metodo_pago: "transferencia", ahora: `${dia(-45)}T15:00:00.000Z` });
  ejecutarLiquidacion(base.cert.id, { moduloId: modulos[1].id, fecha_pago: dia(-24), metodo_pago: "transferencia", ahora: `${dia(-24)}T15:00:00.000Z` });
  const tarde = sesiones.find((s) => s.inscripcion_id === inscripciones[2].id && numeroDe(s.modulo_id) === 2);
  sesiones = sesiones.map((s) => (s.id === tarde.id ? { ...s, realizada: true, fecha_realizada: dia(-3) } : s));

  const nombreAlumno = (id) => alumnosActivos().find((a) => a.id === id)?.nombre ?? "";
  const nombrePersona = (id) => equipo.find((p) => p.id === id)?.nombre ?? null;
  const conAlumno = (s) => {
    const ins = inscripciones.find((i) => i.id === s.inscripcion_id);
    return { ...s, alumno_id: ins?.alumno_id ?? null, alumno: nombreAlumno(ins?.alumno_id) };
  };
  const ordenEncuentros = (a, b) => (a.tipo === b.tipo ? a.numero - b.numero : a.tipo === "regular" ? -1 : 1);
  const certDeModulo = (moduloId) => modulos.find((m) => m.id === moduloId)?.certificacion_id;

  return {
    // Para el resumen de Inicio: una entrada por certificación en curso.
    resumenCertificaciones() {
      return certificaciones
        .filter((c) => c.estado === "en_curso")
        .map((c) => {
          const datos = datosDe(c.id);
          return resumenDesdeDatos(datos, { estados: estadoDeModulos(datos), avance: progresoAlumnos(datos), pendientes: calcularPendientes(datos) }, hoyArgentinaISO());
        });
    },

    // Gastos avisa que se eliminó un pago: lo que pagaba vuelve a pendiente.
    alEliminarPago(pagoId) {
      encuentros = encuentros.map((e) => (e.pago_gasto_id === pagoId ? { ...e, pago_gasto_id: null } : e));
      sesiones = sesiones.map((s) => (s.pago_gasto_id === pagoId ? { ...s, pago_gasto_id: null } : s));
    },

    async listarCertificaciones() {
      return certificaciones.map((c) => ({ ...c }));
    },

    async crearCertificacion(body) {
      const { datos, error } = validarCertificacion(body, { creando: true });
      if (error) throw new Error(error);
      const nueva = nuevaCertificacion(nuevoId, datos);
      certificaciones = [...certificaciones, nueva.cert];
      modulos = [...modulos, ...nueva.modulos];
      encuentros = [...encuentros, ...nueva.encuentros];
      return { ...nueva.cert };
    },

    async actualizarCertificacion(id, body) {
      const { datos, error } = validarCertificacion(body, { creando: false });
      if (error) throw new Error(error);
      certificaciones = certificaciones.map((c) => (c.id === id ? { ...c, ...datos } : c));
      return { ...certificaciones.find((c) => c.id === id) };
    },

    async obtenerCertificacion(id) {
      const datos = datosDe(id);
      if (!datos.cert) throw new Error("No se encontró la certificación. Puede que se haya borrado.");
      const estados = estadoDeModulos(datos);
      const avance = progresoAlumnos(datos);
      const pendientes = calcularPendientes(datos);
      const avisos = resumenDesdeDatos(datos, { estados, avance, pendientes }, hoyArgentinaISO());
      return {
        certificacion: { ...datos.cert },
        modulos: estados,
        avance,
        pendientes,
        equipo: equipo.map((p) => ({ ...p })),
        alumnos: alumnosActivos(),
        listos: avisos.modulosListos,
        tardios: avisos.tardios,
      };
    },

    async liquidarPendientes(certId, body) {
      const { datos, error } = validarLiquidacion(body, hoyArgentinaISO());
      if (error) throw new Error(error);
      const pagos = ejecutarLiquidacion(certId, { ...datos, ahora: new Date().toISOString() });
      return { creados: pagos.length, pagos };
    },

    async listarLiquidaciones(certId) {
      const deLaCert = new Set(modulos.filter((m) => m.certificacion_id === certId).map((m) => m.id));
      // Igual que la ruta real: los pagos de sus módulos y los que cubren sus ítems.
      const referenciados = new Set(
        [...encuentros, ...sesiones].filter((x) => deLaCert.has(x.modulo_id) && x.pago_gasto_id).map((x) => x.pago_gasto_id)
      );
      return gastos
        .instantanea()
        .pagos.filter((p) => deLaCert.has(p.modulo_id) || referenciados.has(p.id))
        .map((p) => ({
          id: p.id,
          fecha_pago: p.fecha_pago,
          monto: p.monto,
          metodo_pago: p.metodo_pago,
          descripcion: p.descripcion,
          equipo_id: p.equipo_id,
          persona: nombrePersona(p.equipo_id) ?? "",
          categoria: p.descripcion?.includes("sesi") ? "Pago de sesiones" : "Pago de encuentros",
          modulo: p.modulo_id ? numeroDe(p.modulo_id) : null,
          created_at: p.created_at,
        }))
        .sort((a, b) => b.fecha_pago.localeCompare(a.fecha_pago) || b.created_at.localeCompare(a.created_at));
    },

    async obtenerModulo(id) {
      const modulo = modulos.find((m) => m.id === id);
      if (!modulo) throw new Error("No se encontró el módulo.");
      const datos = datosDe(modulo.certificacion_id);
      const estado = estadoDeModulos(datos).find((f) => f.modulo_id === id);
      return {
        certificacion: { ...datos.cert },
        modulo: { ...modulo, ...estado, id },
        encuentros: datos.encuentros.filter((e) => e.modulo_id === id).sort(ordenEncuentros),
        sesiones: datos.sesiones
          .filter((s) => s.modulo_id === id)
          .map(conAlumno)
          .sort((a, b) => a.alumno.localeCompare(b.alumno, "es")),
        equipo: equipo.map((p) => ({ ...p })),
        liquidacion: calcularLiquidacion(datos, id),
        practicas: datos.encuentros.filter((e) => e.tipo === "practica_final").length,
        modulos: datos.modulos.map((m) => ({ id: m.id, numero: m.numero })).sort((a, b) => a.numero - b.numero),
      };
    },

    async agregarPractica(moduloId) {
      const { numero, error } = validarNuevaPractica({ modulos, encuentros }, moduloId);
      if (error) throw new Error(error);
      const nuevo = { id: nuevoId(), modulo_id: moduloId, tipo: "practica_final", numero, fecha: null, profe_id: null, tarifa: null, dictado: false, pago_gasto_id: null };
      encuentros = [...encuentros, nuevo];
      return { ...nuevo };
    },

    async liquidarModulo(moduloId, body) {
      const { datos, error } = validarLiquidacion(body, hoyArgentinaISO());
      if (error) throw new Error(error);
      const pagos = ejecutarLiquidacion(certDeModulo(moduloId), { moduloId, ...datos, ahora: new Date().toISOString() });
      return { creados: pagos.length, pagos };
    },

    async actualizarEncuentro(id, body) {
      const actual = encuentros.find((e) => e.id === id);
      if (!actual) throw new Error("No se encontró el encuentro.");
      const { datos, error } = validarCambiosEncuentro(body, actual);
      if (error) throw new Error(error);
      const protegidos = ["profe_id", "dictado", "tarifa"];
      if (actual.pago_gasto_id && protegidos.some((k) => k in datos && datos[k] !== actual[k])) throw new Error(ENCUENTRO_PAGADO);
      encuentros = encuentros.map((e) => (e.id === id ? { ...e, ...datos } : e));
      return { ...encuentros.find((e) => e.id === id) };
    },

    async eliminarEncuentro(id) {
      const actual = encuentros.find((e) => e.id === id);
      if (!actual) return { ok: true };
      if (actual.tipo !== "practica_final") throw new Error("Los 4 encuentros del módulo no se pueden quitar.");
      if (actual.pago_gasto_id) throw new Error("Este encuentro ya fue pagado y no se puede eliminar");
      encuentros = encuentros.filter((e) => e.id !== id);
      return { ok: true };
    },

    async actualizarSesion(id, body) {
      const actual = sesiones.find((s) => s.id === id);
      if (!actual) throw new Error("No se encontró la sesión.");
      const { datos, error } = validarCambiosSesion(body, actual, hoyArgentinaISO());
      if (error) throw new Error(error);
      const protegidos = ["realizada", "tarifa"];
      if (actual.pago_gasto_id && protegidos.some((k) => k in datos && datos[k] !== actual[k])) throw new Error(SESION_PAGADA);
      sesiones = sesiones.map((s) => (s.id === id ? { ...s, ...datos } : s));
      return { ...sesiones.find((s) => s.id === id) };
    },

    async inscribirAlumno(body) {
      if (!body.alumno_id) throw new Error("Elegí el alumno que vas a inscribir.");
      if (inscripciones.some((i) => i.certificacion_id === body.certificacion_id && i.alumno_id === body.alumno_id)) {
        throw new Error("Ese alumno ya está inscripto en esta certificación.");
      }
      const ins = { id: nuevoId(), certificacion_id: body.certificacion_id, alumno_id: body.alumno_id, coach_id: body.coach_id || null, created_at: new Date().toISOString() };
      inscripciones = [...inscripciones, ins];
      sesiones = [...sesiones, ...sesionesPara(nuevoId, ins, modulos)];
      return { ...ins };
    },

    async obtenerInscripcion(id) {
      const ins = inscripciones.find((i) => i.id === id);
      if (!ins) throw new Error("No se encontró la inscripción.");
      return {
        inscripcion: { ...ins },
        alumno: nombreAlumno(ins.alumno_id),
        coach: ins.coach_id ? nombrePersona(ins.coach_id) : null,
        sesiones: sesiones
          .filter((s) => s.inscripcion_id === id)
          .map((s) => ({ ...s, modulo: numeroDe(s.modulo_id), coach: s.coach_id ? nombrePersona(s.coach_id) : null }))
          .sort((a, b) => a.modulo - b.modulo),
      };
    },

    async cambiarCoach(inscripcionId, coachId) {
      const { datos, error } = validarCambioCoach({ coach_id: coachId });
      if (error) throw new Error(error);
      const r = cambiarCoach({ inscripciones, sesiones }, inscripcionId, datos.coach_id);
      inscripciones = r.inscripciones;
      sesiones = r.sesiones;
      return { ...inscripciones.find((i) => i.id === inscripcionId) };
    },

    async listarEquipo({ resumen = false } = {}) {
      const lista = equipo.map((p) => ({ ...p })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      if (!resumen) return lista;
      const pagos = gastos.instantanea().pagos;
      return lista.map((p) => ({
        ...p,
        cobrado: pagos.filter((x) => x.equipo_id === p.id).reduce((acc, x) => acc + Number(x.monto), 0),
        es_profe: encuentros.some((e) => e.profe_id === p.id),
        es_coach: sesiones.some((s) => s.coach_id === p.id) || inscripciones.some((i) => i.coach_id === p.id),
      }));
    },

    async crearPersonaEquipo(body) {
      const { datos, error } = validarPersonaEquipo(body, { creando: true });
      if (error) throw new Error(error);
      const nueva = { id: nuevoId(), contacto: null, notas: null, activo: true, created_at: new Date().toISOString(), ...datos };
      equipo = [...equipo, nueva];
      return { ...nueva };
    },

    async actualizarPersonaEquipo(id, body) {
      const { datos, error } = validarPersonaEquipo(body, { creando: false });
      if (error) throw new Error(error);
      equipo = equipo.map((p) => (p.id === id ? { ...p, ...datos } : p));
      return { ...equipo.find((p) => p.id === id) };
    },

    async eliminarPersonaEquipo(id) {
      const conHistorial =
        encuentros.some((e) => e.profe_id === id) ||
        sesiones.some((s) => s.coach_id === id) ||
        inscripciones.some((i) => i.coach_id === id) ||
        gastos.instantanea().pagos.some((p) => p.equipo_id === id);
      if (conHistorial) {
        throw new Error("Esta persona tiene historial (encuentros, sesiones, alumnos o pagos), así que no se puede borrar. Desactivala: deja de aparecer para asignar y su historial se conserva.");
      }
      equipo = equipo.filter((p) => p.id !== id);
      return { ok: true };
    },

    async obtenerPersonaEquipo(id) {
      const persona = equipo.find((p) => p.id === id);
      if (!persona) throw new Error("No se encontró a esa persona del equipo.");
      const pagos = gastos
        .instantanea()
        .pagos.filter((p) => p.equipo_id === id)
        .sort((a, b) => b.fecha_pago.localeCompare(a.fecha_pago) || b.created_at.localeCompare(a.created_at));
      const filas = certificaciones.flatMap((c) => calcularPendientes(datosDe(c.id)).filter((f) => f.equipo_id === id));
      const faltaTarifa = filas.some((f) => f.total === null);
      const certDe = (moduloId) => certificaciones.find((c) => c.id === certDeModulo(moduloId))?.nombre ?? "";
      return {
        persona: { ...persona },
        cobrado: pagos.reduce((acc, p) => acc + Number(p.monto), 0),
        pendiente: { filas, total: faltaTarifa ? null : filas.reduce((acc, f) => acc + f.total, 0) },
        liquidaciones: pagos.slice(0, 10).map((p) => ({ id: p.id, fecha_pago: p.fecha_pago, monto: p.monto, metodo_pago: p.metodo_pago, descripcion: p.descripcion, modulo_id: p.modulo_id, created_at: p.created_at })),
        encuentros: encuentros
          .filter((e) => e.profe_id === id)
          .map((e) => ({ ...e, modulo: numeroDe(e.modulo_id), certificacion: certDe(e.modulo_id) }))
          .sort((a, b) => a.modulo - b.modulo),
        sesiones: sesiones
          .filter((s) => s.coach_id === id)
          .map((s) => ({ ...conAlumno(s), modulo: numeroDe(s.modulo_id), certificacion: certDe(s.modulo_id) }))
          .sort((a, b) => a.modulo - b.modulo || a.alumno.localeCompare(b.alumno, "es")),
      };
    },
  };
}
