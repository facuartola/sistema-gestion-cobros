import { describe, expect, it } from "vitest";
import { mesesAdeudados } from "./deuda";

describe("mesesAdeudados", () => {
  it("sin cuotas pagadas, desde el mes de inicio hasta uno antes del actual: todos cuentan", () => {
    const ahora = new Date(2026, 8, 15); // 15 de septiembre 2026, sin día de vencimiento
    const n = mesesAdeudados({
      mesInicio: "2026-06",
      mesActual: "2026-09",
      mesesPagados: new Set(),
      diaVencimiento: null,
      ahora,
    });
    // jun, jul, ago cuentan siempre (meses pasados); septiembre no, porque
    // sin día de vencimiento el mes actual nunca se considera "atrasado".
    expect(n).toBe(3);
  });

  it("meses pagados no cuentan", () => {
    const ahora = new Date(2026, 8, 15);
    const n = mesesAdeudados({
      mesInicio: "2026-06",
      mesActual: "2026-09",
      mesesPagados: new Set(["2026-06", "2026-07"]),
      diaVencimiento: null,
      ahora,
    });
    expect(n).toBe(1); // solo agosto
  });

  it("el mes actual cuenta si ya está atrasado (con día de vencimiento)", () => {
    const ahora = new Date(2026, 8, 20); // 20 de septiembre
    const n = mesesAdeudados({
      mesInicio: "2026-09",
      mesActual: "2026-09",
      mesesPagados: new Set(),
      diaVencimiento: 10, // ya pasó
      ahora,
    });
    expect(n).toBe(1);
  });

  it("el mes actual NO cuenta si todavía no venció", () => {
    const ahora = new Date(2026, 8, 5); // 5 de septiembre
    const n = mesesAdeudados({
      mesInicio: "2026-09",
      mesActual: "2026-09",
      mesesPagados: new Set(),
      diaVencimiento: 10,
      ahora,
    });
    expect(n).toBe(0);
  });

  it("persona sin ningún mes debido devuelve 0", () => {
    const ahora = new Date(2026, 8, 15);
    const n = mesesAdeudados({
      mesInicio: "2026-09",
      mesActual: "2026-09",
      mesesPagados: new Set(["2026-09"]),
      diaVencimiento: 10,
      ahora,
    });
    expect(n).toBe(0);
  });
});
