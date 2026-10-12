import { apiFetch } from "./apiFetch";

// Best-effort, igual que lib/registrarErrorServidor.js: si esto falla (sin
// sesión, sin red), no debe romper nada más. Quien llama no necesita esperar
// ni manejar el resultado.
export function registrarErrorFrontend({ mensaje, stack, ruta }) {
  try {
    apiFetch("/api/errores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje, stack, ruta }),
    }).catch(() => {});
  } catch {
    // Intencionalmente silencioso.
  }
}
