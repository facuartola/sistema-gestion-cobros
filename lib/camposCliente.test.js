import { describe, expect, it } from "vitest";
import { parseCamposCliente } from "./camposCliente";

describe("parseCamposCliente", () => {
  it("rechaza monto_mensual <= 0", () => {
    const { error } = parseCamposCliente({ monto_mensual: 0 }, { esAlumno: false });
    expect(error).toMatch(/monto mensual/);
  });

  it("rechaza dia_vencimiento fuera de rango", () => {
    const { error } = parseCamposCliente({ dia_vencimiento: 32 }, { esAlumno: false });
    expect(error).toMatch(/día de vencimiento/);
  });

  it("permite borrar dia_vencimiento con null", () => {
    const { updates, error } = parseCamposCliente({ dia_vencimiento: null }, { esAlumno: false });
    expect(error).toBeUndefined();
    expect(updates.dia_vencimiento).toBeNull();
  });

  it("ignora monto_total para jugadores (no existe en esa tabla)", () => {
    const { updates } = parseCamposCliente({ monto_total: 50000 }, { esAlumno: false });
    expect(updates.monto_total).toBeUndefined();
  });

  it("valida monto_total para alumnos", () => {
    expect(parseCamposCliente({ monto_total: -5 }, { esAlumno: true }).error).toMatch(/monto total/);
    expect(parseCamposCliente({ monto_total: 100000 }, { esAlumno: true }).updates.monto_total).toBe(100000);
  });

  it("guarda notas recortando espacios, o null si queda vacío", () => {
    expect(parseCamposCliente({ notas: "  hola  " }, { esAlumno: false }).updates.notas).toBe("hola");
    expect(parseCamposCliente({ notas: "   " }, { esAlumno: false }).updates.notas).toBeNull();
  });
});

describe("contacto (texto libre y opcional)", () => {
  it("se guarda tal cual, sin validar formato, recortando espacios", () => {
    const guardar = (contacto) => parseCamposCliente({ contacto }, { esAlumno: false }).updates.contacto;
    expect(guardar("  11 2345-6789 ")).toBe("11 2345-6789");
    expect(guardar("cliente@ejemplo.com")).toBe("cliente@ejemplo.com");
    expect(guardar("escribirle a la noche, prefiere audios")).toBe("escribirle a la noche, prefiere audios");
    expect(guardar("2345-6789")).toBe("2345-6789");
  });

  it("vacío o null lo borra", () => {
    expect(parseCamposCliente({ contacto: "" }, { esAlumno: false }).updates.contacto).toBeNull();
    expect(parseCamposCliente({ contacto: "   " }, { esAlumno: false }).updates.contacto).toBeNull();
    expect(parseCamposCliente({ contacto: null }, { esAlumno: false }).updates.contacto).toBeNull();
  });

  it("ausente no se toca (los contactos ya guardados quedan como están)", () => {
    expect(parseCamposCliente({ notas: "x" }, { esAlumno: false }).updates.contacto).toBeUndefined();
  });

  it("rechaza un tipo que no es texto o un texto demasiado largo", () => {
    expect(parseCamposCliente({ contacto: 1123456789 }, { esAlumno: false }).error).toMatch(/texto/);
    expect(parseCamposCliente({ contacto: "x".repeat(301) }, { esAlumno: false }).error).toMatch(/300/);
    expect(parseCamposCliente({ contacto: "x".repeat(300) }, { esAlumno: false }).error).toBeUndefined();
  });
});
