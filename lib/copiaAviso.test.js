import { describe, expect, it } from "vitest";
import { avisoDeCopia, diasSinCopia } from "./copiaAviso";

const ahora = new Date("2026-10-05T12:00:00Z");
const hace = (dias) => new Date(ahora.getTime() - dias * 86400000).toISOString();

describe("aviso de copia", () => {
  it("si nunca se hizo una copia avisa", () => {
    expect(avisoDeCopia(null, ahora)).toEqual({ mostrar: true, texto: "Todavía no descargaste una copia de tus datos." });
  });
  it("hasta 30 días no avisa", () => {
    expect(avisoDeCopia(hace(0), ahora).mostrar).toBe(false);
    expect(avisoDeCopia(hace(30), ahora).mostrar).toBe(false);
  });
  it("pasados los 30 días dice hace cuántos", () => {
    expect(avisoDeCopia(hace(31), ahora)).toEqual({ mostrar: true, texto: "Hace 31 días que no descargás una copia." });
  });
  it("cuenta días enteros y nunca negativos", () => {
    expect(diasSinCopia(hace(2.9), ahora)).toBe(2);
    expect(diasSinCopia(new Date(ahora.getTime() + 5000).toISOString(), ahora)).toBe(0);
    expect(diasSinCopia(null, ahora)).toBeNull();
  });
});
