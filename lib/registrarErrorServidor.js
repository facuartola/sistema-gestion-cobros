// Best-effort: registrar un error nunca debe romper la respuesta real al
// usuario. Si el insert falla (sin sesión, RLS, Supabase caído), se ignora
// en silencio — ya perdimos el error original, no vale la pena perder también
// la respuesta que sí podíamos dar.
export async function registrarErrorServidor(supabase, { mensaje, stack, ruta }) {
  try {
    await supabase.from("errores_app").insert({
      mensaje: String(mensaje || "Error desconocido").slice(0, 2000),
      stack: stack ? String(stack).slice(0, 5000) : null,
      ruta: ruta || null,
      origen: "api",
    });
  } catch {
    // Ver comentario de arriba: intencionalmente silencioso.
  }
}

// Envuelve un route handler de Next para que cualquier excepción no
// contemplada (no los "if (error) return 400/500" ya manejados a mano) quede
// registrada en errores_app y el usuario reciba un 500 con mensaje en
// castellano en vez de la página de error genérica de Next.
export function conRegistroDeErrores(handler, ruta) {
  return async function (request, context) {
    try {
      return await handler(request, context);
    } catch (err) {
      const { supabaseForRequest } = await import("./supabaseServer");
      const supabase = supabaseForRequest(request);
      await registrarErrorServidor(supabase, { mensaje: err?.message, stack: err?.stack, ruta });
      const { NextResponse } = await import("next/server");
      return NextResponse.json(
        { error: "Ocurrió un error inesperado en el servidor. Probá de nuevo en un momento." },
        { status: 500 }
      );
    }
  };
}
