// El método de pago usado la última vez (efectivo o transferencia) queda
// preseleccionado en las ventanas de cobro y de pago. Se guarda solo en el
// navegador y nunca en /demo, que no escribe nada.
import { METODOS_PAGO } from "./validacion";
import { CLAVES_NAVEGADOR, enDemo } from "./navegador";

// Etiqueta de cada método (para mostrar) y las opciones de los selectores.
export const ETIQUETA_METODO = { efectivo: "Efectivo", transferencia: "Transferencia" };
export const OPCIONES_METODO = METODOS_PAGO.map((valor) => ({ valor, etiqueta: ETIQUETA_METODO[valor] }));

export function leerUltimoMetodo() {
  if (typeof window === "undefined" || enDemo()) return null;
  try {
    const guardado = localStorage.getItem(CLAVES_NAVEGADOR.ultimoMetodoPago);
    return METODOS_PAGO.includes(guardado) ? guardado : null;
  } catch {
    return null;
  }
}

export function guardarUltimoMetodo(metodo) {
  if (typeof window === "undefined" || enDemo() || !METODOS_PAGO.includes(metodo)) return;
  try {
    localStorage.setItem(CLAVES_NAVEGADOR.ultimoMetodoPago, metodo);
  } catch {
    // Sin localStorage, simplemente no se recuerda.
  }
}
