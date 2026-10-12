import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(__dirname, "../app/api");

function* rutas(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) yield* rutas(p);
    else if (f.name === "route.js") yield p;
  }
}

// Única excepción a "401 sin sesión": la ruta pública que mantiene activa la
// base gratuita (ver docs/MANTENER-ACTIVO.md). No lee ni devuelve datos.
const PUBLICAS = new Set(["salud"]);

// Archivos de lib/ que exigen sesión: varias rutas lo hacen a través de ellos.
const LIB = path.resolve(__dirname);
const ayudantes = fs
  .readdirSync(LIB)
  .filter((f) => /\.js$/.test(f) && !/\.test\.js$/.test(f) && f !== "apiAuth.js" && /exigirSesion/.test(fs.readFileSync(path.join(LIB, f), "utf8")))
  .map((f) => f.replace(/\.js$/, ""));

function exigeSesion(codigo) {
  return /exigirSesion/.test(codigo) || ayudantes.some((a) => new RegExp(`/${a}"`).test(codigo));
}

describe("rutas de la API", () => {
  const todas = [...rutas(RAIZ)].map((p) => {
    const codigo = fs.readFileSync(p, "utf8");
    return { nombre: path.relative(RAIZ, path.dirname(p)).replaceAll("\\", "/"), codigo, sesion: exigeSesion(codigo) };
  });

  it("encuentra las rutas, incluidas las de la copia y la de salud", () => {
    expect(todas.length).toBeGreaterThan(20);
    expect(todas.map((r) => r.nombre)).toEqual(expect.arrayContaining(["copia", "salud"]));
  });

  it("toda ruta exige sesión (401) salvo las públicas documentadas", () => {
    const sinSesion = todas.filter((r) => !PUBLICAS.has(r.nombre) && !r.sesion).map((r) => r.nombre);
    expect(sinSesion).toEqual([]);
  });

  it("las rutas públicas son solo las esperadas y no leen tablas", () => {
    const publicas = todas.filter((r) => !r.sesion).map((r) => r.nombre);
    expect(publicas.sort()).toEqual([...PUBLICAS].sort());
    const salud = todas.find((r) => r.nombre === "salud");
    expect(salud.codigo).not.toMatch(/\.from\(/);
  });
});
