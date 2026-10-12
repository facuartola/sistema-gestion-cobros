import { describe, expect, it } from "vitest";
import { formatoDolares } from "./moneda";

// Intl usa un espacio de no separación entre "US$" y el número.
const normal = (s) => s.replace(/\u00a0/g, " ");

describe("formatoDolares", () => {
  it("enteros: US$ con separador de miles de es-AR y sin centavos", () => {
    expect(normal(formatoDolares(1234))).toBe("US$ 1.234");
    expect(normal(formatoDolares(15000))).toBe("US$ 15.000");
    expect(normal(formatoDolares(0))).toBe("US$ 0");
  });

  it("con centavos los muestra siempre con dos dígitos", () => {
    expect(normal(formatoDolares(1234.5))).toBe("US$ 1.234,50");
    expect(normal(formatoDolares(49.99))).toBe("US$ 49,99");
  });

  it("acepta números como texto (numeric de Postgres) y valores raros", () => {
    expect(normal(formatoDolares("50.00"))).toBe("US$ 50");
    expect(normal(formatoDolares(undefined))).toBe("US$ 0");
    expect(normal(formatoDolares(null))).toBe("US$ 0");
  });
});
