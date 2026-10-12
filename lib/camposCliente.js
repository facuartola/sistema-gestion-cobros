// Validación compartida de los campos de "cliente" (jugador o alumno) que
// llegan en el body de POST /api/{jugadores,alumnos} y PATCH /api/{...}/:id.
//
// Devuelve { updates } con solo los campos presentes en el body (listos para
// insert/update) o { error } con un mensaje pensado para mostrarse tal cual.
// Un campo ausente (undefined) se ignora; null o "" en los opcionales lo borra.

import { LIMITES } from "./validacion";

function esVacio(v) {
  return v === null || v === "";
}

// El contacto es texto libre y opcional: un teléfono, un mail o una nota.
// No se valida el formato a propósito: el sistema no le escribe a nadie, solo
// le deja el dato a mano a quien lo cargó. Se acota el largo para no guardar
// un texto absurdo.

// Nombre obligatorio (alta) o presente (edición): recortado, no vacío y con
// un largo razonable.
export function validarNombre(valor) {
  const nombre = typeof valor === "string" ? valor.trim() : "";
  if (!nombre) return { error: "El nombre no puede quedar vacío." };
  if (nombre.length > LIMITES.nombre) {
    return { error: `El nombre no puede superar los ${LIMITES.nombre} caracteres.` };
  }
  return { nombre };
}

export function parseCamposCliente(body, { esAlumno }) {
  const updates = {};

  if (body.contacto !== undefined) {
    if (body.contacto !== null && typeof body.contacto !== "string") {
      return { error: "El contacto tiene que ser texto." };
    }
    const contacto = (body.contacto || "").trim();
    if (contacto.length > LIMITES.contacto) {
      return { error: `El contacto no puede superar los ${LIMITES.contacto} caracteres.` };
    }
    updates.contacto = contacto || null;
  }

  if (body.notas !== undefined) {
    const notas = typeof body.notas === "string" ? body.notas.trim() : "";
    if (notas.length > LIMITES.notas) {
      return { error: `Las notas no pueden superar los ${LIMITES.notas} caracteres.` };
    }
    updates.notas = notas || null;
  }

  if (body.monto_mensual !== undefined) {
    const monto = Number(body.monto_mensual);
    if (esVacio(body.monto_mensual) || !Number.isFinite(monto) || monto <= 0) {
      return { error: "El monto mensual tiene que ser un número mayor a 0." };
    }
    if (monto > LIMITES.montoMaximo) {
      return { error: "El monto mensual es demasiado alto. Revisá que no sobre ningún cero." };
    }
    updates.monto_mensual = monto;
  }

  if (body.dia_vencimiento !== undefined) {
    if (esVacio(body.dia_vencimiento)) {
      updates.dia_vencimiento = null;
    } else {
      const dia = Number(body.dia_vencimiento);
      if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
        return { error: "El día de vencimiento tiene que ser un número entero entre 1 y 31." };
      }
      updates.dia_vencimiento = dia;
    }
  }

  // monto_total solo existe en la tabla de alumnos: en jugadores se ignora.
  if (esAlumno && body.monto_total !== undefined) {
    if (esVacio(body.monto_total)) {
      updates.monto_total = null;
    } else {
      const total = Number(body.monto_total);
      if (!Number.isFinite(total) || total <= 0) {
        return { error: "El monto total tiene que ser un número mayor a 0 (o dejarlo vacío)." };
      }
      if (total > LIMITES.montoMaximo) {
        return { error: "El monto total es demasiado alto. Revisá que no sobre ningún cero." };
      }
      updates.monto_total = total;
    }
  }

  return { updates };
}
