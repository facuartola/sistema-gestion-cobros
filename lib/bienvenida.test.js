import { describe, expect, it } from "vitest";
import { nombreParaEmail, saludoSegunHora, textoBienvenida } from "./bienvenida";

const ar = (s) => new Date(`${s}-03:00`); // hora Argentina

describe("saludoSegunHora", () => {
  it("cortes de mañana, tarde y noche", () => {
    expect(saludoSegunHora(5)).toBe("Buenas noches");
    expect(saludoSegunHora(6)).toBe("Buenos días");
    expect(saludoSegunHora(12)).toBe("Buenos días");
    expect(saludoSegunHora(13)).toBe("Buenas tardes");
    expect(saludoSegunHora(19)).toBe("Buenas tardes");
    expect(saludoSegunHora(20)).toBe("Buenas noches");
    expect(saludoSegunHora(0)).toBe("Buenas noches");
  });
});

describe("nombreParaEmail", () => {
  it("encuentra el nombre sin importar mayúsculas ni espacios", () => {
    expect(nombreParaEmail("admin@ejemplo.com")).toBe("Laura");
    expect(nombreParaEmail(" Admin@Ejemplo.com ")).toBe("Laura");
    expect(nombreParaEmail("dev@ejemplo.com")).toBe("Facu");
  });

  it("sin mapeo, null (también para claves heredadas de Object)", () => {
    expect(nombreParaEmail("otra@ejemplo.com")).toBeNull();
    expect(nombreParaEmail("toString")).toBeNull();
    expect(nombreParaEmail(null)).toBeNull();
  });
});

describe("textoBienvenida", () => {
  it("con nombre mapeado, en los tres horarios de Argentina", () => {
    expect(textoBienvenida("admin@ejemplo.com", ar("2026-09-29T09:00:00")).titulo).toBe("Buenos días, Laura");
    expect(textoBienvenida("admin@ejemplo.com", ar("2026-09-29T15:00:00")).titulo).toBe("Buenas tardes, Laura");
    expect(textoBienvenida("admin@ejemplo.com", ar("2026-09-29T22:00:00")).titulo).toBe("Buenas noches, Laura");
  });

  it("usa la hora de Argentina aunque el instante venga de otro huso", () => {
    // 10:00 en Tokio = 22:00 del día anterior en Argentina
    expect(textoBienvenida("admin@ejemplo.com", new Date("2026-09-30T10:00:00+09:00")).titulo).toBe(
      "Buenas noches, Laura"
    );
  });

  it("sin nombre: saludo solo y un subtítulo genérico", () => {
    expect(textoBienvenida("prueba@ejemplo.com", ar("2026-09-29T15:00:00"))).toEqual({
      titulo: "Buenas tardes",
      subtitulo: "¡Hola de nuevo!",
    });
  });
});
