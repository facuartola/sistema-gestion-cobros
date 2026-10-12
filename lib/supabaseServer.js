import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Crea un cliente de Supabase que respeta la sesión del usuario logueado,
// leyendo el token que el frontend manda en el header Authorization.
// Así las políticas RLS ("solo usuarios autenticados") funcionan de verdad,
// en vez de ejecutarse siempre como usuario anónimo.
export function supabaseForRequest(request) {
  const authHeader = request.headers.get("authorization") || "";

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
    // Un cliente por request, sin sesión propia que guardar ni refrescar:
    // la sesión es la del token que manda el navegador.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
