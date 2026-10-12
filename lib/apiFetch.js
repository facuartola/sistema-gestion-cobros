import { supabase } from "./supabaseClient";
import { CLAVES_NAVEGADOR } from "./navegador";

// Esperas entre reintentos cuando el backend responde 503 "reintentable"
// (PostgREST rechazó un token recién renovado; ver lib/respuestasApi.js).
const ESPERAS_REINTENTO_MS = [1500, 4000];

// Wrapper de fetch que agrega el token de sesión del usuario logueado
// como header Authorization, para que el backend pueda validar RLS
// como ese usuario en vez de como anónimo.
export async function apiFetch(url, options = {}) {
  for (let intento = 0; ; intento++) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    const headers = {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const res = await fetch(url, { ...options, headers });

    if (res.status === 503 && intento < ESPERAS_REINTENTO_MS.length) {
      const body = await res.clone().json().catch(() => null);
      if (body?.reintentable) {
        await new Promise((r) => setTimeout(r, ESPERAS_REINTENTO_MS[intento]));
        continue;
      }
    }

    // Si el backend dice que la sesión venció, cerramos sesión acá también:
    // AuthGate reacciona al cambio y muestra el login con un aviso, en vez de
    // dejar la pantalla actual con datos vacíos o a medio cargar.
    // scope "local": solo este navegador. El default ("global") cerraba la
    // sesión de la clienta también en el celular por un 401 en la compu.
    if (res.status === 401) {
      try {
        sessionStorage.setItem(CLAVES_NAVEGADOR.sesionExpirada, "1");
      } catch {
        // Si sessionStorage no está disponible (modo privado, etc.) seguimos igual.
      }
      await supabase.auth.signOut({ scope: "local" });
    }

    return res;
  }
}
