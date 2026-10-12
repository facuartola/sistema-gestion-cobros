import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guardarUltimoMetodo, leerUltimoMetodo } from "./metodoPago";

// Sin navegador: un localStorage y un window mínimos.
function instalar(pathname) {
  const datos = new Map();
  vi.stubGlobal("window", { location: { pathname } });
  vi.stubGlobal("localStorage", { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, String(v)) });
  return datos;
}

describe("método de pago recordado", () => {
  afterEach(() => vi.unstubAllGlobals());

  describe("en la app", () => {
    beforeEach(() => instalar("/"));

    it("sin nada guardado no preselecciona", () => {
      expect(leerUltimoMetodo()).toBeNull();
    });

    it("recuerda el último método usado", () => {
      guardarUltimoMetodo("transferencia");
      expect(leerUltimoMetodo()).toBe("transferencia");
      guardarUltimoMetodo("efectivo");
      expect(leerUltimoMetodo()).toBe("efectivo");
    });

    it("ignora valores que no son un método", () => {
      guardarUltimoMetodo("cheque");
      guardarUltimoMetodo(null);
      expect(leerUltimoMetodo()).toBeNull();
    });
  });

  it("en /demo no lee ni escribe nada", () => {
    const datos = instalar("/demo");
    guardarUltimoMetodo("efectivo");
    expect(datos.size).toBe(0);
    datos.set("ultimo_metodo_pago", "efectivo");
    expect(leerUltimoMetodo()).toBeNull();
  });
});
