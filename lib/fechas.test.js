import { describe, expect, it } from "vitest";
import {
  cuotaAtrasada,
  diaArgentinaDe,
  fechaDMA,
  fechaHoraArgentina,
  hoyArgentinaISO,
  mesArgentinaISO,
  mesLabel,
  partesArgentina,
  sumarDiasISO,
  sumarMesesISO,
} from "./fechas";

// Todos los instantes se escriben con offset explícito, así el resultado no
// depende del huso de la máquina que corre los tests. `npm test` con TZ=UTC,
// TZ=Asia/Tokyo o TZ=America/Los_Angeles tiene que dar lo mismo.
const ar = (s) => new Date(`${s}-03:00`); // hora Argentina

describe("hoyArgentinaISO / mesArgentinaISO", () => {
  it("31 de octubre a las 22:00 hora Argentina sigue siendo octubre (en UTC ya es 1/11)", () => {
    const fecha = ar("2026-10-31T22:00:00");
    expect(fecha.toISOString().slice(0, 10)).toBe("2026-11-01"); // la trampa
    expect(hoyArgentinaISO(fecha)).toBe("2026-10-31");
    expect(mesArgentinaISO(fecha)).toBe("2026-10");
  });

  it("último día del mes a las 23:59 hora Argentina sigue siendo ese día", () => {
    expect(hoyArgentinaISO(ar("2026-02-28T23:59:00"))).toBe("2026-02-28");
  });

  it("un navegador en Japón (UTC+9) a las 10:00 del 1/10 todavía es 30/09 en Argentina", () => {
    const fecha = new Date("2026-10-01T10:00:00+09:00"); // = 30/09 22:00 en Argentina
    expect(hoyArgentinaISO(fecha)).toBe("2026-09-30");
    expect(mesArgentinaISO(fecha)).toBe("2026-09");
    expect(partesArgentina(fecha).hora).toBe(22);
  });

  it("medianoche en punto hora Argentina ya es el día nuevo, hora 0", () => {
    const fecha = ar("2026-10-01T00:00:00");
    expect(hoyArgentinaISO(fecha)).toBe("2026-10-01");
    expect(partesArgentina(fecha).hora).toBe(0);
  });

  it("diaArgentinaDe convierte un timestamp UTC de la base", () => {
    expect(diaArgentinaDe("2026-10-01T01:30:00.000Z")).toBe("2026-09-30");
  });
});

describe("cuotaAtrasada", () => {
  it("sin día de vencimiento nunca está atrasada", () => {
    expect(cuotaAtrasada("2026-09", null, ar("2026-09-30T12:00:00"))).toBe(false);
  });

  it("mes anterior al actual siempre está atrasado", () => {
    expect(cuotaAtrasada("2026-08", 15, ar("2026-09-01T12:00:00"))).toBe(true);
  });

  it("mes futuro nunca está atrasado", () => {
    expect(cuotaAtrasada("2026-10", 1, ar("2026-09-30T12:00:00"))).toBe(false);
  });

  it("mes actual: atrasado recién el día después del vencimiento", () => {
    expect(cuotaAtrasada("2026-09", 10, ar("2026-09-10T12:00:00"))).toBe(false); // el propio día, todavía no
    expect(cuotaAtrasada("2026-09", 10, ar("2026-09-11T12:00:00"))).toBe(true);
  });

  it("vence el 10: a las 22:00 del 10 hora Argentina todavía no (en UTC ya es el 11)", () => {
    // Antes esto dependía del reloj de la máquina: en el servidor (UTC) daba atrasado.
    expect(cuotaAtrasada("2026-09", 10, ar("2026-09-10T22:00:00"))).toBe(false);
  });

  it("día 31 en un mes de 30 días vence el día 30 (no se pasa a octubre)", () => {
    expect(cuotaAtrasada("2026-09", 31, ar("2026-09-30T12:00:00"))).toBe(false);
    // Ya es octubre => "2026-09" es mes anterior al actual => true directo.
    expect(cuotaAtrasada("2026-09", 31, ar("2026-10-01T12:00:00"))).toBe(true);
  });

  it("29 de febrero en año no bisiesto se ajusta al 28", () => {
    expect(cuotaAtrasada("2026-02", 29, ar("2026-02-28T12:00:00"))).toBe(false);
    expect(cuotaAtrasada("2026-02", 29, ar("2026-03-01T12:00:00"))).toBe(true);
  });
});

describe("sumarDiasISO / sumarMesesISO", () => {
  it("suma días cruzando fin de mes", () => {
    expect(sumarDiasISO("2026-09-28", 7)).toBe("2026-10-05");
  });

  it("con 0 días devuelve la misma fecha", () => {
    expect(sumarDiasISO("2026-09-28", 0)).toBe("2026-09-28");
  });

  it("resta meses cruzando el año", () => {
    expect(sumarMesesISO("2026-02", -3)).toBe("2025-11");
    expect(sumarMesesISO("2026-09", 0)).toBe("2026-09");
  });
});

describe("mesLabel", () => {
  it("no se corre de mes en husos negativos", () => {
    expect(mesLabel("2026-09")).toBe("Septiembre de 2026");
  });
});

describe("fechaHoraArgentina", () => {
  it("muestra la hora argentina en 24 horas", () => {
    expect(fechaHoraArgentina("2026-10-04T23:53:37Z")).toBe("04/10/2026, 20:53:37");
    expect(fechaHoraArgentina("2026-10-05T02:01:42Z")).toBe("04/10/2026, 23:01:42");
    expect(fechaHoraArgentina("2026-10-04T03:05:00Z")).toBe("04/10/2026, 00:05:00");
  });
});

describe("fechaDMA", () => {
  it("pasa de ISO a día/mes/año", () => {
    expect(fechaDMA("2026-10-04")).toBe("04/10/2026");
  });
});
