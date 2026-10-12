import { describe, expect, it } from "vitest";
import { agruparRecordatorios, gruposParaPantalla } from "./recordatoriosAgrupar";

const r = (id, fecha, hecho = false) => ({ id, fecha, hecho, hecho_en: hecho ? `${fecha}T12:00:00Z` : null });

describe("gruposParaPantalla", () => {
  const lista = [r("v", "2026-10-01"), r("h", "2026-10-05"), r("s", "2026-10-09"), r("m", "2026-11-20"), r("x", "2026-10-02", true)];
  const g = gruposParaPantalla(agruparRecordatorios(lista, "2026-10-05"));

  it("lo vencido va con lo de hoy", () => {
    expect(g.hoy.map((x) => x.id)).toEqual(["v", "h"]);
  });
  it("esta semana, más adelante y hechos", () => {
    expect(g.semana.map((x) => x.id)).toEqual(["s"]);
    expect(g.masAdelante.map((x) => x.id)).toEqual(["m"]);
    expect(g.hechos.map((x) => x.id)).toEqual(["x"]);
  });
  it("no se pierde ninguno", () => {
    expect(Object.values(g).flat()).toHaveLength(lista.length);
  });
});
