import { describe, expect, it, vi } from "vitest";
import { errorDeBase, leerJson } from "./respuestasApi";

const pedido = (cuerpo) => new Request("http://localhost/api/x", { method: "POST", body: cuerpo, headers: { "Content-Type": "application/json" } });

describe("leerJson", () => {
  it("acepta un objeto JSON", async () => {
    expect(await leerJson(pedido('{"a":1}'))).toEqual({ body: { a: 1 } });
  });

  it("un cuerpo roto, un array o null es un pedido mal armado (400), no un error del servidor", async () => {
    for (const cuerpo of ["{roto", "[1]", "null", ""]) {
      const { respuesta } = await leerJson(pedido(cuerpo));
      expect(respuesta.status).toBe(400);
      expect((await respuesta.json()).error).toMatch(/formato esperado/);
    }
  });
});

describe("errorDeBase", () => {
  const supabase = { from: vi.fn(() => ({ insert: vi.fn(async () => ({})) })) };

  it("los errores intencionales de la base (P0001) salen tal cual y no se registran", async () => {
    const r = await errorDeBase(supabase, { code: "P0001", message: "Este módulo ya fue liquidado" }, "/x");
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "Este módulo ya fue pagado" });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("un error inesperado no muestra el mensaje técnico y queda registrado", async () => {
    const r = await errorDeBase(supabase, { code: "XX000", message: 'relation "x" does not exist' }, "/x");
    expect(r.status).toBe(500);
    expect((await r.json()).error).not.toMatch(/relation/);
    expect(supabase.from).toHaveBeenCalledWith("errores_app");
  });

  it("los mensajes propios de la ruta reemplazan al genérico", async () => {
    const r = await errorDeBase(supabase, { code: "23505", message: "duplicate key" }, "/x", { 23505: "Ya hay una categoría con ese nombre." });
    expect(r.status).toBe(409);
    expect((await r.json()).error).toBe("Ya hay una categoría con ese nombre.");
  });
});
