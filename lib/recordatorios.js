// Validación compartida de recordatorios, usada por las rutas API y por los
// tests. Separada de las rutas para poder probarla sin levantar un servidor.
import { LIMITES, esFechaISO, esUuid } from "./validacion";

const TIPOS_RECORDATORIO = ["general", "cobro", "seguimiento"];

// null/""/undefined = sin persona. Cualquier otra cosa tiene que ser un uuid:
// si no, Postgres rechaza el insert con un error técnico.
function idPersonaValido(valor) {
  return valor == null || valor === "" || esUuid(valor);
}

// Valida el body de un POST (creación). Devuelve { datos } listo para insert,
// o { error } con un mensaje para mostrar tal cual.
export function validarRecordatorioNuevo(body) {
  const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
  if (!titulo) {
    return { error: "El título es obligatorio." };
  }
  if (titulo.length > LIMITES.titulo) {
    return { error: `El título no puede superar los ${LIMITES.titulo} caracteres.` };
  }

  const fecha = body.fecha;
  if (!esFechaISO(fecha)) {
    return { error: "La fecha no es válida." };
  }

  const tipo = body.tipo || "general";
  if (!TIPOS_RECORDATORIO.includes(tipo)) {
    return { error: "El tipo de recordatorio no es válido." };
  }

  const nota = typeof body.nota === "string" ? body.nota.trim() : "";
  if (nota.length > LIMITES.nota) {
    return { error: `La nota no puede superar los ${LIMITES.nota} caracteres.` };
  }

  if (!idPersonaValido(body.jugador_id) || !idPersonaValido(body.alumno_id)) {
    return { error: "La persona asociada no es válida." };
  }
  const jugadorId = body.jugador_id || null;
  const alumnoId = body.alumno_id || null;
  if (jugadorId && alumnoId) {
    return { error: "Un recordatorio no puede estar asociado a un jugador y a un alumno a la vez." };
  }

  return {
    datos: {
      titulo,
      nota: nota || null,
      fecha,
      tipo,
      jugador_id: jugadorId,
      alumno_id: alumnoId,
    },
  };
}

// Valida el body de un PATCH (edición parcial). Solo valida los campos
// presentes; "hecho" se maneja aparte porque además fija hecho_en.
export function validarRecordatorioEdicion(body) {
  const updates = {};

  if (body.titulo !== undefined) {
    const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
    if (!titulo) return { error: "El título no puede quedar vacío." };
    if (titulo.length > LIMITES.titulo) {
      return { error: `El título no puede superar los ${LIMITES.titulo} caracteres.` };
    }
    updates.titulo = titulo;
  }

  if (body.nota !== undefined) {
    const nota = typeof body.nota === "string" ? body.nota.trim() : "";
    if (nota.length > LIMITES.nota) {
      return { error: `La nota no puede superar los ${LIMITES.nota} caracteres.` };
    }
    updates.nota = nota || null;
  }

  if (body.fecha !== undefined) {
    if (!esFechaISO(body.fecha)) return { error: "La fecha no es válida." };
    updates.fecha = body.fecha;
  }

  if (body.tipo !== undefined) {
    if (!TIPOS_RECORDATORIO.includes(body.tipo)) return { error: "El tipo de recordatorio no es válido." };
    updates.tipo = body.tipo;
  }

  const tocaJugador = body.jugador_id !== undefined;
  const tocaAlumno = body.alumno_id !== undefined;
  if ((tocaJugador && !idPersonaValido(body.jugador_id)) || (tocaAlumno && !idPersonaValido(body.alumno_id))) {
    return { error: "La persona asociada no es válida." };
  }
  if (tocaJugador) updates.jugador_id = body.jugador_id || null;
  if (tocaAlumno) updates.alumno_id = body.alumno_id || null;
  if ((tocaJugador || tocaAlumno) && updates.jugador_id && updates.alumno_id) {
    return { error: "Un recordatorio no puede estar asociado a un jugador y a un alumno a la vez." };
  }

  return { updates };
}
