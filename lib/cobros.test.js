import { describe, expect, it } from "vitest";
import { estadoDeCobro, fraseDeResumen, porcentajeAbonado, textoDeuda, tipoValido } from "./cobros";

const ahora = new Date("2026-10-05T15:00:00Z");
const cuotaPagada = { estado: "pagado", monto: 100 };
// El formato de moneda usa un espacio duro: se compara con espacio común.
const frase = (ps) => fraseDeResumen(ps)?.replace(/ /g, " ") ?? null;

describe("estadoDeCobro", () => {
  it("pagó", () => {
    expect(estadoDeCobro({ cuota_actual: cuotaPagada, dia_vencimiento: 3 }, "2026-10", ahora).texto).toBe("Pagó");
  });
  it("atrasado cuando el día ya pasó", () => {
    expect(estadoDeCobro({ cuota_actual: null, dia_vencimiento: 3 }, "2026-10", ahora)).toMatchObject({ texto: "Atrasado", tono: "atrasado" });
  });
  it("vence el N cuando todavía no llegó", () => {
    expect(estadoDeCobro({ cuota_actual: null, dia_vencimiento: 10 }, "2026-10", ahora).texto).toBe("Vence el 10");
  });
  it("sin vencimiento", () => {
    expect(estadoDeCobro({ cuota_actual: null, dia_vencimiento: null }, "2026-10", ahora).texto).toBe("Sin vencimiento");
  });
  it("un mes anterior sin pagar está atrasado", () => {
    expect(estadoDeCobro({ cuota_actual: null, dia_vencimiento: 25 }, "2026-09", ahora).clave).toBe("atrasado");
  });
});

describe("fraseDeResumen", () => {
  it("suma lo que falta", () => {
    const ps = [
      { monto_mensual: 100, cuota_actual: null },
      { monto_mensual: 50, cuota_actual: { estado: "pendiente", monto: 70 } },
      { monto_mensual: 10, cuota_actual: cuotaPagada },
    ];
    expect(frase(ps)).toBe("Faltan US$ 170 de 2 personas.");
  });
  it("singular, todos pagaron y vacío", () => {
    expect(frase([{ monto_mensual: 500, cuota_actual: null }])).toBe("Falta US$ 500 de 1 persona.");
    expect(frase([{ monto_mensual: 5, cuota_actual: cuotaPagada }])).toBe("Todos pagaron este mes.");
    expect(frase([])).toBeNull();
  });
});

describe("otros", () => {
  it("deuda", () => {
    expect(textoDeuda(0)).toBeNull();
    expect(textoDeuda(1)).toBe("debe 1 mes");
    expect(textoDeuda(3)).toBe("debe 3 meses");
  });
  it("porcentaje", () => {
    expect(porcentajeAbonado(799, 10900)).toBe(7);
    expect(porcentajeAbonado(20000, 10900)).toBe(100);
    expect(porcentajeAbonado(5, 0)).toBe(0);
  });
  it("tipo válido", () => {
    expect(tipoValido("alumno")).toBe("alumno");
    expect(tipoValido("x")).toBeNull();
  });
});
