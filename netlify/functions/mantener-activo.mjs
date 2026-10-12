// Función programada de Netlify: una vez por día llama a /api/salud de la propia
// web, que a su vez llama a public.ping() de Supabase. Así el proyecto gratuito
// registra actividad y no se pausa. No usa ninguna variable propia: solo la
// dirección de la web (process.env.URL, que Netlify define). Nunca falla: si
// algo sale mal, lo deja en el log. Ver docs/MANTENER-ACTIVO.md.
export default async function mantenerActivo() {
  const base = process.env.URL;
  if (!base) {
    console.log("mantener-activo: no hay process.env.URL, no se hizo ningún chequeo.");
    return;
  }
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/salud`, { cache: "no-store" });
    const cuerpo = await res.json().catch(() => null);
    console.log(`mantener-activo: /api/salud respondió ${res.status} ok=${cuerpo?.ok === true}`);
  } catch (err) {
    console.log(`mantener-activo: no se pudo llamar a /api/salud (${err?.message ?? "error"})`);
  }
}

export const config = { schedule: "@daily" };
