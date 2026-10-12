import { describe, expect, it } from "vitest";
import { armarParaHacer, etiquetaDia } from "./paraHacer";

const hoy = "2026-10-04";
const personas = [{ id: "a", tipo: "jugador", nombre: "Ana" }];

describe("Para hacer", () => {
  it("etiqueta el día: mañana o día de la semana", () => {
    expect(etiquetaDia("2026-10-05", hoy)).toBe("mañana");
    expect(etiquetaDia("2026-10-10", hoy)).toBe("sáb 10");
  });

  it("Hoy deja lo vencido y de hoy; el gasto que todavía no vence pasa a Esta semana (sin duplicarse)", () => {
    const pendientes = [
      { clave: "cobro-jugador-a", tipo: "cobro" },
      { clave: "gasto-zoom", tipo: "gasto", gasto: { id: "z", estado: "vencido" } },
      { clave: "gasto-wifi", tipo: "gasto", gasto: { id: "w", estado: "pendiente" } },
    ];
    const proximos = [{ clave: "gasto-w-2026-10-10", tipo: "gasto", fecha: "2026-10-10", nombre: "Wifi", categoriaId: "w", periodo: "2026-10-01", monto: null }];
    const r = armarParaHacer({ pendientes, proximos, personas, hoy });
    expect(r.hoy.map((f) => f.clave)).toEqual(["cobro-jugador-a", "gasto-zoom"]);
    expect(r.semana).toHaveLength(1);
    expect(r.semana[0]).toMatchObject({ tipo: "gasto", titulo: "Pagar Wifi", detalle: "Vence el 10 de octubre", etiqueta: "sáb 10", gasto: { id: "w", periodo: "2026-10-01" } });
  });

  it("cada fila de Esta semana trae lo que su botón necesita", () => {
    const proximos = [
      { clave: "c1", tipo: "cobro", fecha: "2026-10-06", nombre: "Ana", personaTipo: "jugador", personaId: "a", monto: 100 },
      { clave: "c2", tipo: "cobro", fecha: "2026-10-06", nombre: "Fantasma", personaTipo: "jugador", personaId: "x", monto: 1 },
      { clave: "r1", tipo: "recordatorio", fecha: "2026-10-07", titulo: "Llamar", nombre: "Llamar", recordatorio: { id: "r1" } },
    ];
    const { semana } = armarParaHacer({ pendientes: [], proximos, personas, hoy });
    expect(semana.map((f) => f.clave)).toEqual(["c1", "r1"]);
    expect(semana[0]).toMatchObject({ titulo: "Cobrar a Ana", persona: { id: "a" }, monto: 100 });
    expect(semana[1]).toMatchObject({ tipo: "recordatorio", recordatorio: { id: "r1" }, nombre: null });
  });
});
