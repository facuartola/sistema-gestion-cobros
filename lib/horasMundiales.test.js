import { describe, expect, it } from "vitest";
import { horasMundiales } from "./horasMundiales";

function porId(horas) {
  return Object.fromEntries(horas.map((h) => [h.id, h]));
}

describe("horasMundiales", () => {
  it("Miami en horario de verano (EDT, UTC-4): mismo día que Argentina", () => {
    // 2026-07-15 12:00 UTC — Miami ya está en DST (empieza el 8/3, termina el 1/11 de 2026).
    // Valores verificados contra Intl.DateTimeFormat con cada timeZone real.
    const fecha = new Date("2026-07-15T12:00:00Z");
    const h = porId(horasMundiales(fecha));

    expect(h.miami.hora).toBe("08:00"); // UTC-4
    expect(h.argentina.hora).toBe("09:00"); // UTC-3, fijo todo el año
    expect(h.paraguay.hora).toBe("09:00"); // UTC-3
    expect(h.mexico.hora).toBe("06:00"); // UTC-6, sin horario de verano desde 2022
    expect(h.miami.diferenciaDias).toBeNull();
    expect(h.paraguay.diferenciaDias).toBeNull();
    expect(h.mexico.diferenciaDias).toBeNull();
  });

  it("Miami en horario estándar (EST, UTC-5) y un caso con día distinto al de Argentina", () => {
    // 2026-01-15 03:30 UTC = 00:30 del 15/01 en Argentina (recién cruzó la
    // medianoche), pero todavía 14/01 en Miami y Ciudad de México.
    const fecha = new Date("2026-01-15T03:30:00Z");
    const h = porId(horasMundiales(fecha));

    expect(h.argentina.hora).toBe("00:30");
    expect(h.argentina.diferenciaDias).toBeNull();

    expect(h.miami.hora).toBe("22:30"); // UTC-5 (horario estándar, sin DST en enero)
    expect(h.miami.diferenciaDias).toBe(-1);

    expect(h.paraguay.hora).toBe("00:30"); // UTC-3, mismo día que Argentina
    expect(h.paraguay.diferenciaDias).toBeNull();

    expect(h.mexico.hora).toBe("21:30"); // UTC-6
    expect(h.mexico.diferenciaDias).toBe(-1);
  });

  it("devuelve las 4 ciudades en el orden esperado", () => {
    const h = horasMundiales(new Date("2026-05-01T12:00:00Z"));
    expect(h.map((x) => x.id)).toEqual(["argentina", "miami", "paraguay", "mexico"]);
  });
});
