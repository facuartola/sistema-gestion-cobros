import { describe, expect, it, vi } from "vitest";
import { esFechaISO, esMesISO, esUuid, normalizarMesCuota, parseMetodoPago } from "./validacion";
import { validarRecordatorioNuevo, validarRecordatorioEdicion } from "./recordatorios";
import { parseCamposCliente, validarNombre } from "./camposCliente";
import { errorDeBase } from "./respuestasApi";

describe("validaciones de forma", () => {
  it("esUuid acepta uuids y rechaza cualquier otra cosa", () => {
    expect(esUuid("90244826-de2d-4deb-b35d-18c3d16ef2cd")).toBe(true);
    expect(esUuid("undefined")).toBe(false);
    expect(esUuid("1; drop table jugadores")).toBe(false);
    expect(esUuid(undefined)).toBe(false);
  });

  it("esFechaISO rechaza fechas que no existen", () => {
    expect(esFechaISO("2026-02-28")).toBe(true);
    expect(esFechaISO("2026-02-30")).toBe(false);
    expect(esFechaISO("28/02/2026")).toBe(false);
  });

  it("esMesISO", () => {
    expect(esMesISO("2026-09")).toBe(true);
    expect(esMesISO("2026-13")).toBe(false);
    expect(esMesISO("abc")).toBe(false);
  });

  it("normalizarMesCuota lleva siempre al día 1, para que el unique (persona, mes) no se burle", () => {
    expect(normalizarMesCuota("2026-09")).toBe("2026-09-01");
    expect(normalizarMesCuota("2026-09-01")).toBe("2026-09-01");
    expect(normalizarMesCuota("2026-09-15")).toBe("2026-09-01");
    expect(normalizarMesCuota("2026-09-31")).toBeNull();
    expect(normalizarMesCuota("septiembre")).toBeNull();
    expect(normalizarMesCuota(undefined)).toBeNull();
  });
});

describe("límites de texto y montos", () => {
  it("nombre: obligatorio y con largo razonable", () => {
    expect(validarNombre("  Ana  ")).toEqual({ nombre: "Ana" });
    expect(validarNombre("   ").error).toBeTruthy();
    expect(validarNombre(42).error).toBeTruthy();
    expect(validarNombre("x".repeat(121)).error).toMatch(/120/);
  });

  it("monto mensual absurdo se rechaza", () => {
    expect(parseCamposCliente({ monto_mensual: 1e12 }, { esAlumno: false }).error).toMatch(/demasiado alto/);
  });

  it("notas larguísimas se rechazan", () => {
    expect(parseCamposCliente({ notas: "x".repeat(2001) }, { esAlumno: false }).error).toMatch(/2000/);
  });

  it("recordatorio: persona asociada tiene que ser un uuid", () => {
    expect(validarRecordatorioNuevo({ titulo: "X", fecha: "2026-09-28", jugador_id: "abc" }).error).toMatch(
      /persona/
    );
    expect(validarRecordatorioEdicion({ alumno_id: "abc" }).error).toMatch(/persona/);
    expect(validarRecordatorioEdicion({ alumno_id: null }).updates).toEqual({ alumno_id: null });
  });

  it("recordatorio: título demasiado largo", () => {
    expect(validarRecordatorioNuevo({ titulo: "x".repeat(201), fecha: "2026-09-28" }).error).toMatch(/200/);
  });
});

describe("errorDeBase", () => {
  function supabaseFalso() {
    const insert = vi.fn().mockResolvedValue({ error: null });
    return { insert, cliente: { from: () => ({ insert }) } };
  }

  it("no expone el mensaje técnico y mapea códigos conocidos", async () => {
    const { insert, cliente } = supabaseFalso();
    const res = await errorDeBase(cliente, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" }, "/x");
    expect(res.status).toBe(404);
    expect((await res.json()).error).not.toMatch(/JSON object/);
    expect(insert).not.toHaveBeenCalled();
  });

  it("un error desconocido devuelve 500 genérico y queda registrado con el detalle técnico", async () => {
    const { insert, cliente } = supabaseFalso();
    const res = await errorDeBase(cliente, { code: "XX000", message: "algo interno raro" }, "/api/jugadores");
    expect(res.status).toBe(500);
    expect((await res.json()).error).not.toMatch(/interno raro/);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ mensaje: "[XX000] algo interno raro", origen: "api" }));
  });
});

describe("parseMetodoPago", () => {
  it("ausente no toca el valor; vacío lo borra; solo acepta efectivo o transferencia", () => {
    expect(parseMetodoPago(undefined)).toEqual({ metodo: {} });
    expect(parseMetodoPago(null)).toEqual({ metodo: { metodo_pago: null } });
    expect(parseMetodoPago("")).toEqual({ metodo: { metodo_pago: null } });
    expect(parseMetodoPago("efectivo")).toEqual({ metodo: { metodo_pago: "efectivo" } });
    expect(parseMetodoPago("transferencia")).toEqual({ metodo: { metodo_pago: "transferencia" } });
    expect(parseMetodoPago("cheque").error).toMatch(/efectivo o transferencia/);
  });
});
