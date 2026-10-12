import { rutasColeccion } from "../../../lib/rutasPersonas";

// GET ?mes=YYYY-MM -> lista con la cuota de ese mes · POST -> alta.
// Implementación compartida con la ruta hermana en lib/rutasPersonas.js.
const rutas = rutasColeccion("alumno");
export const GET = rutas.GET;
export const POST = rutas.POST;
