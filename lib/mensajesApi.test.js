import { describe, expect, it } from "vitest";
import { errorDeBase } from "./respuestasApi";
import { MENSAJES_TRADUCIDOS, traducirMensaje } from "./mensajesApi";

const PROHIBIDAS = /liquid|pendientes|período|categor|recurrencia|cuota actual/i;

describe("traducirMensaje", () => {
  it("traduce los mensajes de la base con palabras prohibidas", () => {
    expect(traducirMensaje("Este módulo ya fue liquidado")).toBe("Este módulo ya fue pagado");
    expect(traducirMensaje("Falta definir la tarifa de la certificación antes de liquidar")).toBe(
      "Falta definir la tarifa de la certificación antes de pagar al equipo"
    );
  });

  it("un mensaje desconocido pasa igual que hoy", () => {
    expect(traducirMensaje("Método de pago inválido")).toBe("Método de pago inválido");
    expect(traducirMensaje("toString")).toBe("toString");
    expect(traducirMensaje(undefined)).toBeUndefined();
  });

  it("ningún texto traducido tiene palabras prohibidas", () => {
    for (const nuevo of Object.values(MENSAJES_TRADUCIDOS)) expect(nuevo).not.toMatch(PROHIBIDAS);
  });
});

describe("errorDeBase con mensajes traducidos", () => {
  const supabase = { from: () => ({ insert: async () => ({}) }) };

  it("un módulo ya pagado sale con el texto nuevo y como conflicto (409)", async () => {
    const r = await errorDeBase(supabase, { code: "P0001", message: "Este módulo ya fue liquidado" }, "/x");
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "Este módulo ya fue pagado" });
  });

  it("falta de tarifa sale con el texto nuevo (400)", async () => {
    const r = await errorDeBase(supabase, { code: "P0001", message: "Falta definir la tarifa de la certificación antes de liquidar" }, "/x");
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "Falta definir la tarifa de la certificación antes de pagar al equipo" });
  });
});
