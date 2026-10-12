// Mensajes que lanza la base (funciones liquidar_*) con palabras que la app ya
// no usa en pantalla. Se traducen en la capa de la API, sin tocar la base. Un
// solo lugar: cualquier mensaje que no esté acá pasa tal cual.
export const MENSAJES_TRADUCIDOS = {
  "Este módulo ya fue liquidado": "Este módulo ya fue pagado",
  "Falta definir la tarifa de la certificación antes de liquidar": "Falta definir la tarifa de la certificación antes de pagar al equipo",
  "Faltan las categorías de pago al equipo de coaches": "Faltan los tipos de gasto de pago al equipo de coaches",
};

export function traducirMensaje(mensaje) {
  return Object.hasOwn(MENSAJES_TRADUCIDOS, mensaje) ? MENSAJES_TRADUCIDOS[mensaje] : mensaje;
}
