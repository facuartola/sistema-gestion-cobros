import { describe, expect, it } from "vitest";
import {
  parseTarifa,
  respuestaDeErrorIntencional,
  validarCambioCoach,
  validarCambiosEncuentro,
  validarCambiosSesion,
  validarCertificacion,
  validarInscripcion,
  validarLiquidacion,
  validarPersonaEquipo,
} from "./certificacionValidacion";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

describe("certificación", () => {
  it("crea con nombre, fecha y las tres tarifas del caso de referencia", () => {
    const { datos, error } = validarCertificacion(
      { nombre: "  Certificación TEST  ", fecha_inicio: "2026-10-04", tarifa_sesion: "50", tarifa_encuentro: 40, tarifa_practica: 60 },
      { creando: true }
    );
    expect(error).toBeUndefined();
    expect(datos).toEqual({ nombre: "Certificación TEST", fecha_inicio: "2026-10-04", tarifa_sesion: 50, tarifa_encuentro: 40, tarifa_practica: 60 });
  });

  it("una tarifa vacía queda sin definir (null): las prácticas usan la de encuentro", () => {
    expect(validarCertificacion({ nombre: "X", tarifa_practica: "" }, { creando: true }).datos.tarifa_practica).toBeNull();
  });

  it("exige el nombre y valida fechas, tarifas y estado", () => {
    expect(validarCertificacion({}, { creando: true }).error).toMatch(/nombre/);
    expect(validarCertificacion({ nombre: "   " }, { creando: true }).error).toMatch(/nombre/);
    expect(validarCertificacion({ nombre: "X", fecha_inicio: "2026-02-30" }, { creando: true }).error).toMatch(/fecha/);
    expect(validarCertificacion({ nombre: "X", tarifa_sesion: -1 }, { creando: true }).error).toMatch(/tarifa por sesión/);
    expect(validarCertificacion({ nombre: "X", tarifa_encuentro: "abc" }, { creando: true }).error).toMatch(/tarifa por encuentro/);
    expect(validarCertificacion({ estado: "cerrada" }, { creando: false }).error).toMatch(/estado/);
    expect(validarCertificacion({}, { creando: false }).error).toMatch(/nada para actualizar/);
  });

  it("al editar solo toca lo que viene", () => {
    expect(validarCertificacion({ tarifa_sesion: 55 }, { creando: false }).datos).toEqual({ tarifa_sesion: 55 });
  });

  it("tarifas: 0 es válido, redondea a centavos", () => {
    expect(parseTarifa(0)).toEqual({ valor: 0 });
    expect(parseTarifa("40.456")).toEqual({ valor: 40.46 });
    expect(parseTarifa(true).error).toBeDefined();
  });
});

describe("equipo", () => {
  it("alta con nombre y contacto y notas opcionales", () => {
    expect(validarPersonaEquipo({ nombre: " Ana ", contacto: "", notas: null }, { creando: true }).datos).toEqual({ nombre: "Ana", contacto: null, notas: null });
    expect(validarPersonaEquipo({ nombre: "" }, { creando: true }).error).toMatch(/nombre/);
    expect(validarPersonaEquipo({ nombre: "a".repeat(101) }, { creando: true }).error).toMatch(/100/);
    expect(validarPersonaEquipo({ nombre: "Ana", notas: "x".repeat(1001) }, { creando: true }).error).toMatch(/1000/);
  });

  it("desactivar es un booleano", () => {
    expect(validarPersonaEquipo({ activo: false }, { creando: false }).datos).toEqual({ activo: false });
    expect(validarPersonaEquipo({ activo: "no" }, { creando: false }).error).toMatch(/estado/);
  });
});

describe("encuentros", () => {
  const actual = { profe_id: null, dictado: false, tarifa: null };

  it("asigna profe, marca dictado y tarifa especial de invitado (100)", () => {
    const { datos } = validarCambiosEncuentro({ profe_id: U1, dictado: true, tarifa: 100, fecha: "2026-10-04" }, actual);
    expect(datos).toEqual({ profe_id: U1, dictado: true, tarifa: 100, fecha: "2026-10-04" });
  });

  it("no se marca dictado sin profe, tampoco quitándole el profe a uno dictado", () => {
    expect(validarCambiosEncuentro({ dictado: true }, actual).error).toMatch(/Elegí quién dio el encuentro/);
    expect(validarCambiosEncuentro({ profe_id: null }, { ...actual, profe_id: U1, dictado: true }).error).toMatch(/Elegí quién/);
  });

  it("rechaza un profe mal formado o un pedido vacío", () => {
    expect(validarCambiosEncuentro({ profe_id: "x" }, actual).error).toMatch(/profe/);
    expect(validarCambiosEncuentro({}, actual).error).toMatch(/nada/);
    expect(validarCambiosEncuentro({ dictado: "si" }, actual).error).toMatch(/estado/);
  });
});

describe("sesiones", () => {
  const actual = { coach_id: U1, realizada: false, fecha_realizada: null, tarifa: null };

  it("al marcarla realizada sin fecha usa hoy; al desmarcarla borra la fecha", () => {
    expect(validarCambiosSesion({ realizada: true }, actual, "2026-10-04").datos).toEqual({ realizada: true, fecha_realizada: "2026-10-04" });
    expect(validarCambiosSesion({ realizada: true, fecha_realizada: "2026-10-01" }, actual, "2026-10-04").datos.fecha_realizada).toBe("2026-10-01");
    expect(validarCambiosSesion({ realizada: false }, { ...actual, realizada: true, fecha_realizada: "2026-10-01" }, "2026-10-04").datos).toEqual({
      realizada: false,
      fecha_realizada: null,
    });
  });

  it("sin coach no se marca realizada", () => {
    expect(validarCambiosSesion({ realizada: true }, { ...actual, coach_id: null }, "2026-10-04").error).toMatch(/no tiene coach/);
  });

  it("tarifa especial de la sesión (la general es 50)", () => {
    expect(validarCambiosSesion({ tarifa: "" }, actual, "2026-10-04").datos).toEqual({ tarifa: null });
    expect(validarCambiosSesion({ tarifa: 70 }, actual, "2026-10-04").datos).toEqual({ tarifa: 70 });
  });
});

describe("inscripción y coach", () => {
  it("inscribe con o sin coach", () => {
    expect(validarInscripcion({ certificacion_id: U1, alumno_id: U2, coach_id: U1 }).datos).toEqual({ certificacion_id: U1, alumno_id: U2, coach_id: U1 });
    expect(validarInscripcion({ certificacion_id: U1, alumno_id: U2 }).datos.coach_id).toBeNull();
    expect(validarInscripcion({ certificacion_id: U1 }).error).toMatch(/alumno/);
    expect(validarInscripcion({ certificacion_id: U1, alumno_id: U2, coach_id: "x" }).error).toMatch(/coach/);
  });

  it("cambio de coach", () => {
    expect(validarCambioCoach({ coach_id: U2 }).datos).toEqual({ coach_id: U2 });
    expect(validarCambioCoach({}).error).toMatch(/coach nuevo/);
  });
});

describe("liquidación", () => {
  it("fecha de hoy por defecto y método obligatorio", () => {
    expect(validarLiquidacion({ metodo_pago: "efectivo" }, "2026-10-04").datos).toEqual({ fecha_pago: "2026-10-04", metodo_pago: "efectivo" });
    expect(validarLiquidacion({}, "2026-10-04").error).toMatch(/efectivo o transferencia/);
    expect(validarLiquidacion({ metodo_pago: "transferencia", fecha_pago: "2026-13-01" }, "2026-10-04").error).toMatch(/fecha/);
  });
});

describe("errores intencionales de la base (P0001)", () => {
  const p = (message) => ({ code: "P0001", message });

  it("se devuelven tal cual: lo que ya fue hecho es 409, el resto 400", () => {
    expect(respuestaDeErrorIntencional(p("Este módulo ya fue liquidado"))).toEqual({ mensaje: "Este módulo ya fue pagado", status: 409 });
    expect(respuestaDeErrorIntencional(p("Este encuentro ya fue pagado: para corregirlo, primero eliminá el pago en Gastos")).status).toBe(409);
    expect(respuestaDeErrorIntencional(p("Una certificación tiene como máximo 5 encuentros de práctica final")).status).toBe(409);
    expect(respuestaDeErrorIntencional(p("Falta definir la tarifa de la certificación antes de liquidar"))).toEqual({
      mensaje: "Falta definir la tarifa de la certificación antes de pagar al equipo",
      status: 400,
    });
    expect(respuestaDeErrorIntencional(p("Las prácticas finales solo pueden estar en los módulos 9 y 10")).status).toBe(400);
  });

  it("'No autorizado' es 403 y los demás códigos no se tocan", () => {
    expect(respuestaDeErrorIntencional(p("No autorizado")).status).toBe(403);
    expect(respuestaDeErrorIntencional({ code: "23505", message: "duplicate" })).toBeNull();
  });
});
