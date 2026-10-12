import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { componer, contraste } from "./contraste";
import { COLORES_AVATAR } from "./resumen";

// Los tokens se leen de app/globals.css: es la única fuente de los colores, y
// este test falla si alguien cambia uno y el par deja de llegar a AA.
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const raiz = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")));
const t = Object.fromEntries([...raiz.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

const AA = 4.5; // texto normal
const aTexto = (c) => `rgb(${c.r}, ${c.g}, ${c.b})`;

// Fondos reales sobre los que se apoya cada superficie. Las translúcidas se
// miden contra el peor caso razonable de lo que hay detrás.
const detrasDelVidrio = [t.fondo, t.card, "#2A3B5C"];

describe("contraste de la paleta (AA 4.5:1)", () => {
  it("tiene los tokens esperados", () => {
    for (const k of ["fondo", "lado", "card", "tinta", "suave", "oro", "oro2", "ok", "warn"]) expect(t[k]).toBeTruthy();
    expect(t.tinta.toLowerCase()).not.toBe("#ffffff");
  });

  const pares = [
    ["tinta sobre fondo", t.tinta, t.fondo],
    ["tinta sobre barra lateral", t.tinta, t.lado],
    ["tinta sobre tarjeta", t.tinta, t.card],
    ["secundario sobre fondo", t.suave, t.fondo],
    ["secundario sobre barra lateral", t.suave, t.lado],
    ["secundario sobre tarjeta", t.suave, t.card],
    ["ítems de la barra lateral", "rgba(236, 229, 215, 0.78)", t.lado],
    ["texto del botón sobre dorado oscuro", t["tinta-oro"], t.oro],
    ["texto del botón sobre dorado claro", t["tinta-oro"], t.oro2],
    ["contador de la barra lateral", t["tinta-oro"], t.oro2],
    ["resultado del mes (dorado) sobre tarjeta", t.oro2, t.card],
    ["positivo sobre tarjeta", t.ok, t.card],
    ["alerta sobre tarjeta", t.warn, t.card],
    ["positivo sobre su píldora", t.ok, t["ok-bg"], t.card],
    ["alerta sobre su píldora", t.warn, t["warn-bg"], t.card],
    ["neutro sobre su píldora", t.suave, t["neutro-bg"], t.card],
    ["alerta sobre su píldora en el fondo", t.warn, t["warn-bg"], t.fondo],
    ["secundario sobre campo de formulario", t.suave, "rgba(236, 229, 215, 0.04)", t.card],
    ["secundario sobre fila resaltada", t.suave, "rgba(236, 229, 215, 0.07)", t.card],
    ["tinta sobre ítem activo", t.tinta, "rgba(236, 229, 215, 0.07)", t.lado],
    ["enlace dorado sobre aviso", t.oro2, t["vidrio-ventana"], t.card],
    // Tandas 2 y 3: error de carga en la barra lateral, avisos dentro de las
    // ventanas (vidrio sobre la tarjeta) y filas pagadas o desactivadas.
    ["alerta sobre barra lateral", t.warn, t.lado],
    ["aviso positivo dentro de una ventana", t.ok, t["ok-bg"], t.card],
    ["error dentro de una ventana", t.warn, t["warn-bg"], t.card],
    ["fila pagada (secundario) sobre tarjeta", t.suave, t.card],
    ...COLORES_AVATAR.map((c) => [`tinta sobre avatar ${c}`, t.tinta, c]),
  ];

  for (const [nombre, texto, fondo, base] of pares) {
    it(nombre, () => {
      expect(contraste(texto, fondo, base)).toBeGreaterThanOrEqual(AA);
    });
  }

  for (const [nombre, fondo] of [
    ["barra superior", t["vidrio-barra"]],
    ["menús", t["vidrio-menu"]],
    ["ventanas", t["vidrio-ventana"]],
  ]) {
    for (const base of detrasDelVidrio) {
      it(`tinta y secundario sobre ${nombre} (detrás ${base})`, () => {
        expect(contraste(t.tinta, fondo, base)).toBeGreaterThanOrEqual(AA);
        expect(contraste(t.suave, fondo, base)).toBeGreaterThanOrEqual(AA);
      });
    }
  }

  it("componer mezcla el alfa sobre el fondo", () => {
    expect(aTexto(componer("rgba(255, 255, 255, 0.5)", "#000000"))).toBe("rgb(128, 128, 128)");
  });
});

// Panel de Inicio: los gráficos. El texto (etiquetas de ejes, valores, variación,
// tooltips) llega a AA 4,5:1; las marcas gráficas (barras, anillos, líneas) a 3:1,
// el mínimo de WCAG para objetos gráficos.
describe("contraste del panel de Inicio", () => {
  const GRAFICO = 3;
  const marcas = [
    ["barra de ingresos (dorado claro)", t.oro2],
    ["línea del resultado y segmento pagó (verde)", t.ok],
    ["segmento atrasado (ámbar)", t.warn],
    ["segmento por vencer (secundario)", t.suave],
    ["segmento azul del reparto", t.azul],
    ["segmento lila del reparto", t.lila],
    ["barra de gastos (hueso translúcido)", "rgba(236, 229, 215, 0.5)"],
  ];
  for (const [nombre, color] of marcas) {
    it(`${nombre} sobre la tarjeta`, () => {
      expect(contraste(color, t.card)).toBeGreaterThanOrEqual(GRAFICO);
    });
  }

  const textos = [
    ["etiquetas de los ejes (secundario) sobre tarjeta", t.suave, t.card],
    ["variación buena (verde) sobre tarjeta", t.ok, t.card],
    ["variación mala (ámbar) sobre tarjeta", t.warn, t.card],
    ["cifra del resultado (dorado) sobre su degradado", t.oro2, "rgba(217, 182, 111, 0.08)", t.card],
    ["tinta sobre el resalte de una barra", t.tinta, "rgba(236, 229, 215, 0.05)", t.card],
    ["secundario sobre el resalte de una barra", t.suave, "rgba(236, 229, 215, 0.05)", t.card],
  ];
  for (const [nombre, texto, fondo, base] of textos) {
    it(nombre, () => {
      expect(contraste(texto, fondo, base ?? undefined)).toBeGreaterThanOrEqual(AA);
    });
  }

  for (const base of detrasDelVidrio) {
    it(`texto del tooltip de vidrio (detrás ${base})`, () => {
      expect(contraste(t.tinta, t["vidrio-menu"], base)).toBeGreaterThanOrEqual(AA);
      expect(contraste(t.suave, t["vidrio-menu"], base)).toBeGreaterThanOrEqual(AA);
    });
  }
});
