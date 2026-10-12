import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TAREAS, filtrarTareas } from "./ayuda";

const APP = path.resolve(__dirname, "../app");

// Carpetas con [[...ruta]]: atienden también todo lo que cuelga de ellas.
const COMODINES = [];

// Rutas de pantalla que existen: cada carpeta de app/ con un page.js. Una
// carpeta con [[...ruta]] atiende también todo lo que cuelga de ella.
function pantallas(dir = APP, base = "") {
  const salida = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.isDirectory() && f.name !== "api") {
      const hija = path.join(dir, f.name);
      if (fs.existsSync(path.join(hija, "page.js"))) salida.push(`${base}/${f.name}`.replace(/\/\[\[\.\.\..*\]\]$/, ""));
      if (/\[\[\.\.\./.test(f.name) && fs.existsSync(path.join(hija, "page.js"))) COMODINES.push(`${base}/${f.name}`.replace(/\/\[\[\.\.\..*\]\]$/, ""));
      salida.push(...pantallas(hija, `${base}/${f.name}`));
    }
  }
  return salida;
}

describe("ayuda", () => {
  const existentes = new Set(["/", ...pantallas()]);

  it("cada «Ir ahí» apunta a una ruta que existe", () => {
    const conBoton = TAREAS.filter((t) => t.ir);
    expect(conBoton.length).toBeGreaterThan(8);
    for (const t of conBoton) {
      const ruta = t.ir.split("?")[0];
      const atendida = existentes.has(ruta) || COMODINES.some((c) => ruta.startsWith(`${c}/`));
      expect(atendida, `${t.id} -> ${t.ir}`).toBe(true);
    }
  });

  it("tiene las 12 tareas, con 3 o 4 pasos cada una", () => {
    expect(TAREAS).toHaveLength(12);
    for (const t of TAREAS) {
      expect(t.pasos.length, t.id).toBeGreaterThanOrEqual(3);
      expect(t.pasos.length, t.id).toBeLessThanOrEqual(4);
    }
  });

  it("los ids son únicos", () => {
    expect(new Set(TAREAS.map((t) => t.id)).size).toBe(TAREAS.length);
  });

  it("el buscador encuentra por palabra, sin importar tildes ni mayúsculas", () => {
    expect(filtrarTareas("")).toHaveLength(TAREAS.length);
    expect(filtrarTareas("CONTRASEÑA").map((t) => t.id)).toContain("contrasena");
    expect(filtrarTareas("contrasena").map((t) => t.id)).toContain("contrasena");
    expect(filtrarTareas("comprobante").map((t) => t.id)).toContain("gasto-comprobante");
    expect(filtrarTareas("zzzz")).toEqual([]);
  });
});
