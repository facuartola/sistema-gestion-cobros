import { describe, expect, it } from "vitest";
import { validarRecordatorioEdicion, validarRecordatorioNuevo } from "./recordatorios";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

describe("validarRecordatorioNuevo", () => {
  it("exige título", () => {
    const { error } = validarRecordatorioNuevo({ fecha: "2026-09-28" });
    expect(error).toMatch(/título/);
  });

  it("exige fecha válida", () => {
    expect(validarRecordatorioNuevo({ titulo: "X", fecha: "" }).error).toMatch(/fecha/);
    expect(validarRecordatorioNuevo({ titulo: "X", fecha: "2026-13-01" }).error).toMatch(/fecha/);
    expect(validarRecordatorioNuevo({ titulo: "X", fecha: "2026-02-30" }).error).toMatch(/fecha/);
  });

  it("rechaza tipo inválido", () => {
    const { error } = validarRecordatorioNuevo({ titulo: "X", fecha: "2026-09-28", tipo: "urgente" });
    expect(error).toMatch(/tipo/);
  });

  it("no permite jugador_id y alumno_id a la vez", () => {
    const { error } = validarRecordatorioNuevo({
      titulo: "X",
      fecha: "2026-09-28",
      jugador_id: U1,
      alumno_id: U2,
    });
    expect(error).toMatch(/jugador.*alumno|a la vez/);
  });

  it("arma los datos con valores por defecto", () => {
    const { datos, error } = validarRecordatorioNuevo({ titulo: "  Cobrar  ", fecha: "2026-09-28" });
    expect(error).toBeUndefined();
    expect(datos).toEqual({
      titulo: "Cobrar",
      nota: null,
      fecha: "2026-09-28",
      tipo: "general",
      jugador_id: null,
      alumno_id: null,
    });
  });
});

describe("validarRecordatorioEdicion", () => {
  it("permite editar solo algunos campos", () => {
    const { updates, error } = validarRecordatorioEdicion({ nota: "nueva nota" });
    expect(error).toBeUndefined();
    expect(updates).toEqual({ nota: "nueva nota" });
  });

  it("rechaza título vacío", () => {
    const { error } = validarRecordatorioEdicion({ titulo: "   " });
    expect(error).toMatch(/título/);
  });

  it("rechaza asociar a jugador y alumno a la vez", () => {
    const { error } = validarRecordatorioEdicion({ jugador_id: U1, alumno_id: U2 });
    expect(error).toBeTruthy();
  });

  it("sin ningún campo devuelve updates vacío (la ruta decide qué hacer)", () => {
    const { updates, error } = validarRecordatorioEdicion({});
    expect(error).toBeUndefined();
    expect(updates).toEqual({});
  });
});
