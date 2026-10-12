// Validación de la certificación y del equipo. La misma en el servidor (que no
// puede confiar en el navegador) y en los formularios. Todas devuelven
// { datos } listo para guardar o { error } en castellano.
import { traducirMensaje } from "./mensajesApi";
import { esFechaISO, esUuid, METODOS_PAGO } from "./validacion";

export const LIMITES_CERT = {
  nombreCertificacion: 100,
  nombrePersona: 100,
  contacto: 300,
  notas: 1000,
  // numeric(10,2)
  tarifaMaxima: 99_999_999.99,
};

function texto(valor, { limite, nombre, obligatorio = false }) {
  if (valor === undefined) return { ausente: true };
  if (valor === null || (typeof valor === "string" && valor.trim() === "")) {
    return obligatorio ? { error: `Ingresá ${nombre}.` } : { valor: null };
  }
  if (typeof valor !== "string") return { error: `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} no es válido.` };
  const limpio = valor.trim().replace(/[ \t]+/g, " ");
  if (limpio.length > limite) return { error: `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} no puede pasar de ${limite} caracteres.` };
  return { valor: limpio };
}

// Tarifa en US$: vacía = sin definir (null); si viene, un número de 0 en adelante.
export function parseTarifa(valor, nombre = "La tarifa") {
  if (valor === undefined) return { ausente: true };
  if (valor === null || valor === "") return { valor: null };
  if (typeof valor === "boolean") return { error: `${nombre} tiene que ser un número de 0 en adelante, o quedar vacía.` };
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) return { error: `${nombre} tiene que ser un número de 0 en adelante, o quedar vacía.` };
  if (n > LIMITES_CERT.tarifaMaxima) return { error: `${nombre} es demasiado alta. Revisá que no sobre ningún cero.` };
  return { valor: Math.round(n * 100) / 100 };
}

function fechaOpcional(valor, nombre) {
  if (valor === undefined) return { ausente: true };
  if (valor === null || valor === "") return { valor: null };
  if (!esFechaISO(valor)) return { error: `${nombre} no es válida.` };
  return { valor };
}

function juntar(campos) {
  const datos = {};
  for (const [clave, r] of Object.entries(campos)) {
    if (r.error) return { error: r.error };
    if (!r.ausente) datos[clave] = r.valor;
  }
  return { datos };
}

// --- Certificación -------------------------------------------------------------

const TARIFAS = {
  tarifa_sesion: "La tarifa por sesión",
  tarifa_encuentro: "La tarifa por encuentro",
  tarifa_practica: "La tarifa por práctica final",
};

export function validarCertificacion(body, { creando }) {
  const campos = {
    nombre: texto(body.nombre, { limite: LIMITES_CERT.nombreCertificacion, nombre: "el nombre de la certificación", obligatorio: true }),
    fecha_inicio: fechaOpcional(body.fecha_inicio, "La fecha de inicio"),
    ...Object.fromEntries(Object.entries(TARIFAS).map(([k, n]) => [k, parseTarifa(body[k], n)])),
  };
  if (body.estado !== undefined) {
    campos.estado = ["en_curso", "finalizada"].includes(body.estado) ? { valor: body.estado } : { error: "El estado tiene que ser en curso o finalizada." };
  }
  if (creando && campos.nombre.ausente) return { error: "Ingresá el nombre de la certificación." };
  const r = juntar(campos);
  if (r.error) return r;
  if (!creando && Object.keys(r.datos).length === 0) return { error: "No hay nada para actualizar." };
  return r;
}

// --- Equipo --------------------------------------------------------------------

export function validarPersonaEquipo(body, { creando }) {
  const campos = {
    nombre: texto(body.nombre, { limite: LIMITES_CERT.nombrePersona, nombre: "el nombre", obligatorio: true }),
    contacto: texto(body.contacto, { limite: LIMITES_CERT.contacto, nombre: "el contacto" }),
    notas: texto(body.notas, { limite: LIMITES_CERT.notas, nombre: "las notas" }),
  };
  if (body.activo !== undefined) {
    campos.activo = typeof body.activo === "boolean" ? { valor: body.activo } : { error: "El estado de la persona no es válido." };
  }
  if (creando && campos.nombre.ausente) return { error: "Ingresá el nombre." };
  const r = juntar(campos);
  if (r.error) return r;
  if (!creando && Object.keys(r.datos).length === 0) return { error: "No hay nada para actualizar." };
  return r;
}

// --- Encuentros y sesiones ----------------------------------------------------------

function idOpcional(valor, mensaje) {
  if (valor === undefined) return { ausente: true };
  if (valor === null || valor === "") return { valor: null };
  if (!esUuid(valor)) return { error: mensaje };
  return { valor };
}

function booleano(valor, mensaje) {
  if (valor === undefined) return { ausente: true };
  if (typeof valor !== "boolean") return { error: mensaje };
  return { valor };
}

// Cambios en un encuentro: fecha, profe, dictado y tarifa especial. `actual` es
// la fila existente, para validar "dictado sin profe" con el resultado final.
export function validarCambiosEncuentro(body, actual) {
  const r = juntar({
    fecha: fechaOpcional(body.fecha, "La fecha del encuentro"),
    profe_id: idOpcional(body.profe_id, "El profe elegido no es válido."),
    dictado: booleano(body.dictado, "El estado del encuentro no es válido."),
    tarifa: parseTarifa(body.tarifa, "La tarifa especial"),
  });
  if (r.error) return r;
  if (Object.keys(r.datos).length === 0) return { error: "No hay nada para actualizar." };
  const final = { ...actual, ...r.datos };
  if (final.dictado && !final.profe_id) return { error: "Elegí quién dio el encuentro antes de marcarlo como dictado." };
  return r;
}

// Cambios en una sesión: realizada, fecha y tarifa especial. Al marcarla
// realizada sin fecha se usa `hoy`; al desmarcarla se borra la fecha.
export function validarCambiosSesion(body, actual, hoy) {
  const r = juntar({
    realizada: booleano(body.realizada, "El estado de la sesión no es válido."),
    fecha_realizada: fechaOpcional(body.fecha_realizada, "La fecha de la sesión"),
    tarifa: parseTarifa(body.tarifa, "La tarifa especial"),
  });
  if (r.error) return r;
  if (Object.keys(r.datos).length === 0) return { error: "No hay nada para actualizar." };
  const final = { ...actual, ...r.datos };
  if (final.realizada && !final.coach_id) return { error: "Esta sesión no tiene coach: asignale uno al alumno antes de marcarla." };
  if (r.datos.realizada === true && !final.fecha_realizada) r.datos.fecha_realizada = hoy;
  if (r.datos.realizada === false) r.datos.fecha_realizada = null;
  return r;
}

// --- Inscripciones y liquidaciones -----------------------------------------------------

export function validarInscripcion(body) {
  if (!esUuid(body.certificacion_id)) return { error: "La certificación no es válida." };
  if (!esUuid(body.alumno_id)) return { error: "Elegí el alumno que vas a inscribir." };
  if (body.coach_id !== undefined && body.coach_id !== null && body.coach_id !== "" && !esUuid(body.coach_id)) {
    return { error: "El coach elegido no es válido." };
  }
  return { datos: { certificacion_id: body.certificacion_id, alumno_id: body.alumno_id, coach_id: body.coach_id || null } };
}

export function validarCambioCoach(body) {
  if (body.coach_id === undefined) return { error: "Elegí el coach nuevo." };
  if (body.coach_id !== null && body.coach_id !== "" && !esUuid(body.coach_id)) return { error: "El coach elegido no es válido." };
  return { datos: { coach_id: body.coach_id || null } };
}

// Fecha y método de una liquidación. El método es obligatorio.
export function validarLiquidacion(body, hoy) {
  const fecha = body.fecha_pago === undefined || body.fecha_pago === null || body.fecha_pago === "" ? hoy : body.fecha_pago;
  if (!esFechaISO(fecha)) return { error: "La fecha de pago no es válida." };
  if (!METODOS_PAGO.includes(body.metodo_pago)) return { error: "Elegí cómo vas a pagar: efectivo o transferencia." };
  return { datos: { fecha_pago: fecha, metodo_pago: body.metodo_pago } };
}

// --- Errores de la base ------------------------------------------------------------------

// Los errores que la base lanza a propósito (raise exception, código P0001) ya
// están escritos para la administradora: se devuelven tal cual. Los que dicen que algo
// "ya fue" hecho son un conflicto (409); el resto, un pedido que no se puede
// cumplir (400).
export function respuestaDeErrorIntencional(error) {
  if (error?.code !== "P0001" || !error.message) return null;
  if (error.message === "No autorizado") return { mensaje: "No tenés permiso para hacer esto.", status: 403 };
  const mensaje = traducirMensaje(error.message);
  return { mensaje, status: /ya fue|máximo/i.test(mensaje) ? 409 : 400 };
}
