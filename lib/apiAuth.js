import { NextResponse } from "next/server";

// Antes, una request sin sesión (o con sesión vencida) llegaba hasta acá,
// RLS filtraba todo en silencio y el endpoint devolvía [] con 200: el
// frontend mostraba "no hay nada cargado" en vez de avisar que hay que
// volver a iniciar sesión. Este chequeo explícito corta antes y devuelve 401.
export async function exigirSesion(supabase) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return NextResponse.json(
      { error: "Tu sesión venció. Iniciá sesión de nuevo para continuar." },
      { status: 401 }
    );
  }
  return null;
}
