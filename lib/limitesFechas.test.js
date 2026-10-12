import { describe, expect, it } from "vitest";
import { cuotaAtrasada, hoyArgentinaISO, mesArgentinaISO } from "./fechas";
import { estadoActual, gastosPorHacer, vencimientoDelPeriodo } from "./gastos";
import { esFechaISO } from "./validacion";
import { validarPago } from "./gastosValidacion";

// Límites de calendario pedidos en la auditoría. Los instantes llevan offset
// explícito: el resultado no puede depender del huso de la máquina (se corrió
// también con TZ=UTC, Asia/Tokyo y Pacific/Kiritimati).
const ar = (s) => new Date(`${s}-03:00`);

describe("último y primer día del mes, en hora Argentina", () => {
  it("31 de octubre a las 23:30 sigue siendo octubre (en UTC ya es 1 de noviembre)", () => {
    expect(hoyArgentinaISO(ar("2026-10-31T23:30:00"))).toBe("2026-10-31");
    expect(mesArgentinaISO(ar("2026-10-31T23:30:00"))).toBe("2026-10");
  });

  it("1 de noviembre a las 00:10 ya es noviembre", () => {
    expect(hoyArgentinaISO(ar("2026-11-01T00:10:00"))).toBe("2026-11-01");
  });

  it("una cuota que vence el 31 sigue en fecha el 31 a las 23:30 y se atrasa el 1 del mes siguiente", () => {
    expect(cuotaAtrasada("2026-10", 31, ar("2026-10-31T23:30:00"))).toBe(false);
    expect(cuotaAtrasada("2026-10", 31, ar("2026-11-01T00:10:00"))).toBe(true);
  });
});

describe("29 de febrero", () => {
  it("existe en 2028 y no en 2026", () => {
    expect(esFechaISO("2028-02-29")).toBe(true);
    expect(esFechaISO("2026-02-29")).toBe(false);
  });

  it("un pago no acepta el 29 de febrero de un año no bisiesto", () => {
    const wifi = { id: "w", nombre: "Wifi", activo: true, recurrencia: "mensual", dia_vencimiento: 31 };
    expect(validarPago({ monto: 10, metodo_pago: "efectivo", fecha_pago: "2026-02-29" }, wifi, "2026-03-01").error).toMatch(/fecha/);
    expect(validarPago({ monto: 10, metodo_pago: "efectivo", fecha_pago: "2028-02-29" }, wifi, "2028-03-01").datos.periodo).toBe("2028-02-01");
  });

  it("un gasto que vence el 31 vence el 29 en febrero bisiesto y el 28 en uno común", () => {
    const c = { id: "w", recurrencia: "mensual", dia_vencimiento: 31 };
    expect(vencimientoDelPeriodo(c, "2028-02-01")).toBe("2028-02-29");
    expect(vencimientoDelPeriodo(c, "2027-02-01")).toBe("2027-02-28");
    expect(estadoActual({ ...c, activo: true }, [], "2028-02-29").estado).toBe("pendiente");
    expect(estadoActual({ ...c, activo: true }, [], "2028-03-01").estado).toBe("pendiente"); // período nuevo (marzo)
  });

  it("a fin de febrero, la ventana de 7 días entra en marzo sin saltear vencimientos", () => {
    const c = { id: "w", nombre: "Wifi", activo: true, recurrencia: "mensual", dia_vencimiento: 2 };
    const pagos = [{ categoria_id: "w", fecha_pago: "2028-02-01", periodo: "2028-02-01" }];
    expect(gastosPorHacer({ categorias: [c], pagos, hoy: "2028-02-27" }).map((i) => i.vencimiento)).toEqual(["2028-03-02"]);
  });
});
