// Chequeo de salud: llama a public.ping() de Supabase (devuelve 'ok', no toca
// datos) con la clave pública. Sirve para que el proyecto gratuito no se pause
// por falta de actividad y para que un monitor externo avise si algo se cae.
// El resultado es solo true/false: nunca devuelve detalles de errores.
export const VIGENCIA_MS = 5 * 60 * 1000;
const ESPERA_MAXIMA_MS = 8000;

let guardado = null; // { ok, hasta }

export function reiniciarCache() {
  guardado = null;
}

export async function consultarPing({ url, clave, fetchFn = fetch }) {
  if (!url || !clave) return false;
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), ESPERA_MAXIMA_MS);
  try {
    const res = await fetchFn(`${url}/rest/v1/rpc/ping`, {
      method: "POST",
      headers: { apikey: clave, Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
      signal: control.signal,
    });
    if (!res.ok) return false;
    return (await res.json()) === "ok";
  } catch {
    return false;
  } finally {
    clearTimeout(temporizador);
  }
}

// Con caché en memoria de ~5 minutos: no se consulta a Supabase en cada visita.
export async function estadoDeSalud({ ahora = Date.now(), ...opciones } = {}) {
  if (guardado && guardado.hasta > ahora) return guardado.ok;
  const ok = await consultarPing(opciones);
  guardado = { ok, hasta: ahora + VIGENCIA_MS };
  return ok;
}
