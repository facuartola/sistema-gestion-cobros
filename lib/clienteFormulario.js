// Validación y armado del cuerpo de un cliente (jugador o alumno) a partir de
// los campos de texto de un formulario. La comparten la ventana "Agregar
// cliente" y el panel de Cobros: una sola regla para las dos.
// Devuelve { error } o { body }.
export function armarCuerpoCliente({ nombre, montoMensual, montoTotal, dia, contacto, notas, esAlumno }) {
  const nombreLimpio = nombre.trim();
  const monto = Number(montoMensual);
  if (!nombreLimpio) return { error: "Ingresá el nombre." };
  if (montoMensual.trim() === "" || !Number.isFinite(monto) || monto <= 0) {
    return { error: "El monto mensual es obligatorio: ingresá un número mayor a 0." };
  }
  if (dia.trim() !== "") {
    const d = Number(dia);
    if (!Number.isInteger(d) || d < 1 || d > 31) {
      return { error: "El día de pago tiene que ser un número entero entre 1 y 31." };
    }
  }
  const total = Number(montoTotal);
  if (esAlumno && montoTotal.trim() !== "" && (!Number.isFinite(total) || total <= 0)) {
    return { error: "El monto total tiene que ser un número mayor a 0, o dejarlo vacío." };
  }
  const body = {
    nombre: nombreLimpio,
    monto_mensual: monto,
    dia_vencimiento: dia.trim() === "" ? null : Number(dia),
    contacto: contacto.trim() || null,
    notas: notas.trim() || null,
  };
  if (esAlumno) body.monto_total = montoTotal.trim() === "" ? null : total;
  return { body };
}
