import { describe, expect, it } from "vitest";
import { deudaDe, estadoEnTira, leerRutaCert, moduloParaRegistrar, rolDe, textoAtrasados, textoModuloListo } from "./certificacionPagina";

const llano = (t) => t.replace(/\s/g, " ");
const fila = (o = {}) => ({ cerrado_en: null, listo_para_liquidar: false, encuentros_dictados: 0, sesiones_realizadas: 0, ...o });

describe("leerRutaCert: las direcciones viejas caen en su pestaña", () => {
  it("la raíz no pide ninguna pestaña (se usa la recordada)", () => {
    expect(leerRutaCert("/certificacion")).toEqual({ pestana: null, id: null });
  });
  it("módulos, alumnos y equipo, con y sin ficha", () => {
    expect(leerRutaCert("/certificacion/modulos")).toEqual({ pestana: "modulos", id: null });
    expect(leerRutaCert("/certificacion/modulos/m1")).toEqual({ pestana: "modulos", id: "m1" });
    expect(leerRutaCert("/certificacion/alumnos/i9")).toEqual({ pestana: "alumnos", id: "i9" });
    expect(leerRutaCert("/certificacion/equipo/p2")).toEqual({ pestana: "equipo", id: "p2" });
  });
  it("una sección desconocida no rompe", () => {
    expect(leerRutaCert("/certificacion/otra")).toEqual({ pestana: null, id: null });
    expect(leerRutaCert(undefined)).toEqual({ pestana: null, id: null });
  });
});

describe("estadoEnTira", () => {
  it("pagado, listo, en curso y sin empezar", () => {
    expect(estadoEnTira(fila({ cerrado_en: "2026-01-01" }))).toBe("pagado");
    expect(estadoEnTira(fila({ listo_para_liquidar: true, encuentros_dictados: 4 }))).toBe("listo");
    expect(estadoEnTira(fila({ encuentros_dictados: 2 }))).toBe("en_curso");
    expect(estadoEnTira(fila({ sesiones_realizadas: 1 }))).toBe("en_curso");
    expect(estadoEnTira(fila())).toBe("sin_empezar");
  });
});

describe("textos de los avisos", () => {
  it("el módulo terminado dice cuánto y a cuántas personas", () => {
    expect(llano(textoModuloListo({ numero: 1, total: 500, personas: 2, faltaTarifa: false }))).toBe("El Módulo 1 terminó: hay que pagar US$ 500 a 2 personas.");
    expect(llano(textoModuloListo({ numero: 3, total: 40, personas: 1, faltaTarifa: false }))).toBe("El Módulo 3 terminó: hay que pagar US$ 40 a 1 persona.");
  });
  it("sin tarifa no inventa un total", () => {
    expect(textoModuloListo({ numero: 2, total: null, personas: 1, faltaTarifa: true })).toMatch(/falta definir la tarifa/);
    expect(textoAtrasados({ total: null, faltaTarifa: true })).toMatch(/falta definir la tarifa/);
  });
  it("pagos atrasados", () => {
    expect(llano(textoAtrasados({ total: 50, faltaTarifa: false }))).toBe("Pagos atrasados al equipo: US$ 50");
  });
  it("ningún texto usa palabras prohibidas", () => {
    const todos = [textoModuloListo({ numero: 1, total: 1, personas: 1 }), textoAtrasados({ total: 1 })].join(" ");
    expect(todos).not.toMatch(/liquid|pendientes|período|categor/i);
  });
});

describe("rolDe", () => {
  it("se deduce de lo asignado", () => {
    expect(rolDe({ es_profe: true, es_coach: false })).toBe("Profe");
    expect(rolDe({ es_profe: false, es_coach: true })).toBe("Coach");
    expect(rolDe({ es_profe: true, es_coach: true })).toBe("Profe y coach");
    expect(rolDe({})).toBe("Sin asignar");
  });
});

describe("deudaDe", () => {
  const filas = [
    { equipo_id: "a", total: 30 },
    { equipo_id: "a", total: 20 },
    { equipo_id: "b", total: null },
  ];
  it("suma lo de la persona", () => expect(deudaDe("a", filas)).toEqual({ total: 50, faltaTarifa: false }));
  it("sin tarifa no hay total", () => expect(deudaDe("b", filas)).toEqual({ total: null, faltaTarifa: true }));
  it("sin nada pendiente, 0", () => expect(deudaDe("c", filas)).toEqual({ total: 0, faltaTarifa: false }));
});

describe("moduloParaRegistrar", () => {
  it("el primero sin pagar", () => {
    expect(moduloParaRegistrar([{ numero: 1, cerrado_en: "x" }, { numero: 2, cerrado_en: null }, { numero: 3, cerrado_en: null }]).numero).toBe(2);
  });
  it("todos pagados o ninguno: null", () => {
    expect(moduloParaRegistrar([{ numero: 1, cerrado_en: "x" }])).toBeNull();
    expect(moduloParaRegistrar(undefined)).toBeNull();
  });
});
