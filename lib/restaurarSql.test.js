import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { ORDEN_RESTAURACION } from "./copia";

const { generarSql, literal, ORDEN, CON_AUTOMATISMOS } = createRequire(import.meta.url)("../scripts/restaurar-sql.js");

function datos(extra = {}) {
  const tablas = Object.fromEntries(ORDEN.map((t) => [t, []]));
  return { version: 1, generado_en: "2026-10-05T15:00:00.000Z", tablas: { ...tablas, ...extra } };
}

describe("restaurar-sql", () => {
  it("el orden coincide con el de la copia", () => {
    expect(ORDEN).toEqual(ORDEN_RESTAURACION);
  });

  it("carga las tablas en orden de dependencias", () => {
    const sql = generarSql(datos());
    const pos = ORDEN.map((t) => sql.indexOf(`-- ${t}:`));
    expect(pos.every((p) => p > 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  });

  it("apaga los automatismos antes de cargar y los prende al final, dentro de una transacción", () => {
    const sql = generarSql(datos({ jugadores: [{ id: "a", nombre: "x" }] }));
    for (const t of CON_AUTOMATISMOS) {
      const apagar = sql.indexOf(`ALTER TABLE public.${t} DISABLE TRIGGER USER;`);
      const prender = sql.indexOf(`ALTER TABLE public.${t} ENABLE TRIGGER USER;`);
      expect(apagar).toBeGreaterThan(sql.indexOf("BEGIN;"));
      expect(apagar).toBeLessThan(sql.indexOf("-- equipo:"));
      expect(prender).toBeGreaterThan(sql.indexOf("-- recordatorios:"));
      expect(prender).toBeLessThan(sql.lastIndexOf("COMMIT;"));
    }
    expect([...CON_AUTOMATISMOS].sort()).toEqual(["categorias_gasto", "certificaciones", "encuentros", "inscripciones", "modulos", "sesiones"]);
  });

  it("apaga el trigger de los tipos de gasto ANTES de vaciarlos y lo prende después de cargarlos (proteger_categorias bloquea borrar los que tienen clave)", () => {
    const sql = generarSql(datos({ categorias_gasto: [{ id: "g1", nombre: "A", parent_id: null, clave: "pago_sesiones" }] }));
    const apagar = sql.indexOf("ALTER TABLE public.categorias_gasto DISABLE TRIGGER USER;");
    const borrar = sql.indexOf("DELETE FROM public.categorias_gasto;");
    const cargar = sql.indexOf("INSERT INTO public.categorias_gasto");
    const prender = sql.indexOf("ALTER TABLE public.categorias_gasto ENABLE TRIGGER USER;");
    expect(apagar).toBeGreaterThan(-1);
    expect(apagar).toBeLessThan(borrar);
    expect(borrar).toBeLessThan(cargar);
    expect(cargar).toBeLessThan(prender);
    expect(prender).toBeLessThan(sql.lastIndexOf("COMMIT;"));
  });

  it("vacía los tipos de gasto de ejemplo antes de cargar los de la copia", () => {
    const sql = generarSql(datos({ categorias_gasto: [{ id: "g1", nombre: "A", parent_id: null }] }));
    expect(sql.indexOf("DELETE FROM public.categorias_gasto;")).toBeLessThan(sql.indexOf("INSERT INTO public.categorias_gasto"));
  });

  it("los padres de los tipos de gasto se cargan antes que los hijos", () => {
    const sql = generarSql(
      datos({
        categorias_gasto: [
          { id: "hijo", nombre: "H", parent_id: "padre" },
          { id: "padre", nombre: "P", parent_id: null },
        ],
      })
    );
    expect(sql.indexOf("('padre'")).toBeLessThan(sql.indexOf("('hijo'"));
  });

  it("detecta tipos de gasto que se apuntan en círculo", () => {
    expect(() =>
      generarSql(
        datos({
          categorias_gasto: [
            { id: "a", nombre: "A", parent_id: "b" },
            { id: "b", nombre: "B", parent_id: "a" },
          ],
        })
      )
    ).toThrow(/círculo/);
  });

  it("escapa comillas, conserva tildes y saltos de línea, nulos, booleanos y números", () => {
    expect(literal("D'Ejemplo", "t")).toBe("'D''Ejemplo'");
    expect(literal("Ñandú\nsegunda", "t")).toBe("'Ñandú\nsegunda'");
    expect(literal("a\\b", "t")).toBe("'a\\b'");
    expect(literal(null, "t")).toBe("NULL");
    expect(literal(undefined, "t")).toBe("NULL");
    expect(literal(true, "t")).toBe("TRUE");
    expect(literal(false, "t")).toBe("FALSE");
    expect(literal(12500.5, "t")).toBe("12500.5");
    expect(literal("", "t")).toBe("''");
    expect(() => literal(NaN, "t")).toThrow();
    expect(() => literal({}, "t")).toThrow();
    expect(() => literal("a\u0000b", "t")).toThrow();
  });

  it("conserva los ids y arma el control de conteos", () => {
    const sql = generarSql(datos({ equipo: [{ id: "id-1", nombre: "N", contacto: null, activo: true }] }));
    expect(sql).toContain("('id-1', 'N', NULL, TRUE)");
    expect(sql).toContain("SELECT count(*) FROM public.equipo) <> 1");
    expect(sql).toContain("standard_conforming_strings = on");
  });

  it("rechaza archivos que no son una copia o con tablas faltantes", () => {
    expect(() => generarSql({})).toThrow();
    expect(() => generarSql({ version: 2, tablas: {} })).toThrow(/Versión/);
    expect(() => generarSql({ version: 1, tablas: { equipo: [] } })).toThrow(/Falta la tabla/);
  });

  it("parte los lotes grandes en varios INSERT", () => {
    const filas = Array.from({ length: 450 }, (_, i) => ({ id: `id-${i}`, nombre: "x" }));
    const sql = generarSql(datos({ equipo: filas }));
    expect(sql.match(/INSERT INTO public\.equipo/g)).toHaveLength(3);
  });
});
