import { rutaCuotas } from "../../../../../lib/rutasPersonas";

// GET -> últimas cuotas · POST -> registrar o actualizar la cuota de un mes (lib/rutasPersonas.js).
export const GET = rutaCuotas("alumno").GET;
export const POST = rutaCuotas("alumno").POST;
