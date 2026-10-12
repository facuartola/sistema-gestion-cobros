import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Palabras que no pueden verse en pantalla (Tanda 4): liquidar, liquidación,
// liquidado, pendientes, período, categoría, recurrencia, cuota actual. Se
// revisan los textos del código (cadenas con espacios o tildes y texto de JSX):
// los nombres internos (categoria_id, liquidarModulo, columnas SQL) no cuentan.
const PROHIBIDAS = /liquid|pendientes|per[ií]odo|categor[ií]a|recurrenc|cuota actual/i;
const RAIZ = path.resolve(__dirname, "..");
// Lo único que puede nombrarlas: el mapa que traduce los mensajes de la base.
const EXCEPCIONES = new Set(["lib/mensajesApi.js"]);

function* archivos(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) {
      if (!["node_modules", ".next", "fonts"].includes(f.name)) yield* archivos(p);
    } else if (/\.js$/.test(f.name) && !/\.test\.js$/.test(f.name)) yield p;
  }
}

function textosDe(linea) {
  const textos = [];
  for (const m of linea.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) textos.push(m[1] ?? m[2] ?? m[3]);
  for (const m of linea.matchAll(/>([^<>{}]+)</g)) textos.push(m[1]);
  if (/^\s*[A-Za-zÁÉÍÓÚ¿¡“][^=;(){},]*$/.test(linea) && !/^\s*(import|export|const|let|return|if|else|for|\w+:\s)/.test(linea)) textos.push(linea.trim());
  // Lo que va dentro de ${...} es código, no texto.
  return textos.map((t) => t.replace(/\$\{[^}]*\}/g, ""));
}

// Cadenas que no son texto para leer: rutas, nombres de columnas y de clases.
function esTecnico(texto) {
  const t = texto.trim();
  if (!/\s/.test(t) && !/[áéíóú]/i.test(t)) return true;
  if (/^(\.{0,2}\/|\/api)/.test(t)) return true;
  if (/\w_\w/.test(t)) return true; // columnas SQL: categoria_id, equipo_id…
  if (/^[\w-]+(\s[\w-]+)*$/.test(t) && !/[áéíóú]/i.test(t) && !/\s[a-z]{4,}\s/.test(t)) return true; // lista de clases CSS
  return false;
}

describe("vocabulario de pantalla", () => {
  it("ningún texto de la app usa las palabras prohibidas", () => {
    const hallazgos = [];
    for (const dir of ["app", "components", "lib"]) {
      for (const archivo of archivos(path.join(RAIZ, dir))) {
        const rel = path.relative(RAIZ, archivo).replaceAll("\\", "/");
        if (EXCEPCIONES.has(rel)) continue;
        fs.readFileSync(archivo, "utf8")
          .split(/\r?\n/)
          .forEach((linea, i) => {
            if (/^\s*(\/\/|\*|\/\*)/.test(linea)) return;
            for (const texto of textosDe(linea)) {
              if (PROHIBIDAS.test(texto) && !esTecnico(texto)) hallazgos.push(`${rel}:${i + 1}: ${texto.trim().slice(0, 100)}`);
            }
          });
      }
    }
    expect(hallazgos).toEqual([]);
  });
});
