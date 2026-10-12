import { describe, expect, it } from "vitest";
import { errorFechaDePago, errorMesDeCuota } from "./validacion";
import { validarEdicionPagoLiquidacion, validarPago } from "./gastosValidacion";

describe("fechas de pago y mes de cuota razonables", () => {
  it("una fecha de pago de hoy o anterior es válida", () => {
    expect(errorFechaDePago("2026-10-05", "2026-10-05")).toBeNull();
    expect(errorFechaDePago("2026-05-01", "2026-10-05")).toBeNull();
  });
  it("no acepta fechas futuras ni de antes de 2020", () => {
    expect(errorFechaDePago("2026-10-06", "2026-10-05")).toMatch(/posterior a hoy/);
    expect(errorFechaDePago("2031-01-01", "2026-10-05")).toMatch(/posterior a hoy/);
    expect(errorFechaDePago("1999-01-01", "2026-10-05")).toMatch(/antigua/);
  });
  it("el mes de una cuota puede ser de hasta un año adelante, no más", () => {
    expect(errorMesDeCuota("2026-10-01", "2026-10")).toBeNull();
    expect(errorMesDeCuota("2027-10-01", "2026-10")).toBeNull();
    expect(errorMesDeCuota("2027-11-01", "2026-10")).toMatch(/adelante/);
    expect(errorMesDeCuota("2031-01-01", "2026-10")).toMatch(/adelante/);
    expect(errorMesDeCuota("2019-12-01", "2026-10")).toMatch(/antiguo/);
  });
  it("editar la fecha de un pago al equipo tampoco acepta el futuro", () => {
    const actual = { monto: 70, categoria_id: "a", equipo_id: "b", modulo_id: "c", periodo: null };
    expect(validarEdicionPagoLiquidacion({ fecha_pago: "2031-01-01" }, actual, "2026-10-05").error).toMatch(/posterior a hoy/);
    expect(validarEdicionPagoLiquidacion({ fecha_pago: "2026-10-04" }, actual, "2026-10-05").datos).toEqual({ fecha_pago: "2026-10-04" });
  });

  it("un pago de gasto con fecha futura se rechaza", () => {
    const wifi = { id: "w", nombre: "Wifi", activo: true, recurrencia: "mensual", dia_vencimiento: 10 };
    expect(validarPago({ monto: 10, metodo_pago: "efectivo", fecha_pago: "2031-01-01" }, wifi, "2026-10-05").error).toMatch(/posterior a hoy/);
    expect(validarPago({ monto: 10, metodo_pago: "efectivo", fecha_pago: "2026-10-05" }, wifi, "2026-10-05").error).toBeUndefined();
  });
});
