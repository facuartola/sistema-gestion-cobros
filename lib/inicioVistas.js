// Las dos vistas de Inicio: "Hoy" (lo que hay que hacer) y "Análisis" (todo lo demás).
const VISTAS_INICIO = ["hoy", "analisis"];
export const VISTA_POR_DEFECTO = "hoy";

export function vistaValida(clave) {
  return VISTAS_INICIO.includes(clave) ? clave : null;
}
