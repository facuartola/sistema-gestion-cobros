import { describe, expect, it } from "vitest";
import { armarCuerpoCliente } from "./clienteFormulario";

const base = { nombre: " Ana ", montoMensual: "50", montoTotal: "", dia: "", contacto: "", notas: "", esAlumno: false };

describe("armarCuerpoCliente", () => {
  it("arma el cuerpo y limpia los vacíos", () => {
    expect(armarCuerpoCliente(base).body).toEqual({ nombre: "Ana", monto_mensual: 50, dia_vencimiento: null, contacto: null, notas: null });
  });
  it("valida nombre, monto y día", () => {
    expect(armarCuerpoCliente({ ...base, nombre: " " }).error).toMatch(/nombre/);
    expect(armarCuerpoCliente({ ...base, montoMensual: "" }).error).toMatch(/monto mensual/);
    expect(armarCuerpoCliente({ ...base, montoMensual: "0" }).error).toMatch(/monto mensual/);
    expect(armarCuerpoCliente({ ...base, dia: "32" }).error).toMatch(/día/);
    expect(armarCuerpoCliente({ ...base, dia: "1.5" }).error).toMatch(/día/);
  });
  it("monto total solo para alumnos, vacío = sin techo", () => {
    expect(armarCuerpoCliente({ ...base, montoTotal: "abc" }).body.monto_total).toBeUndefined();
    expect(armarCuerpoCliente({ ...base, esAlumno: true, montoTotal: "" }).body.monto_total).toBeNull();
    expect(armarCuerpoCliente({ ...base, esAlumno: true, montoTotal: "-1" }).error).toMatch(/monto total/);
    expect(armarCuerpoCliente({ ...base, esAlumno: true, montoTotal: "1000" }).body.monto_total).toBe(1000);
  });
});
