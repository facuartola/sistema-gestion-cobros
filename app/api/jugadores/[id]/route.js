import { rutasItem } from "../../../../lib/rutasPersonas";

// PATCH -> editar · DELETE -> borrar con sus cuotas (lib/rutasPersonas.js).
const rutas = rutasItem("jugador");
export const PATCH = rutas.PATCH;
export const DELETE = rutas.DELETE;
