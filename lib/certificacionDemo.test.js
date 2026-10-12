import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearCertificacionDemo } from "./certificacionDemo";
import { crearGastosDemo } from "./gastosDemo";

// Arma la demo como lo hace dataProviderDemo: gastos y certificación conectados.
function demo() {
  let cert = null;
  const gastos = crearGastosDemo({ alEliminarPago: (id) => cert.alEliminarPago(id) });
  const alumnos = [
    { id: "al-1", nombre: "Rocío Herrera" },
    { id: "al-2", nombre: "Federico Luna" },
    { id: "al-3", nombre: "Agustina Varela" },
    { id: "al-4", nombre: "Ezequiel Molina" },
    { id: "al-5", nombre: "Alumno Nuevo" },
  ];
  cert = crearCertificacionDemo({ gastos, alumnosActivos: () => alumnos });
  return { cert, gastos };
}

// El caso de referencia sobre una certificación nueva de la demo.
async function casoDeReferencia({ tarifa_encuentro = 40 } = {}) {
  const { cert, gastos } = demo();
  const c = await cert.crearCertificacion({ nombre: "Cert TEST", tarifa_sesion: 50, tarifa_encuentro, tarifa_practica: 60 });
  const a = await cert.crearPersonaEquipo({ nombre: "A Coach" });
  const b = await cert.crearPersonaEquipo({ nombre: "B Profe" });
  const cc = await cert.crearPersonaEquipo({ nombre: "C Profe" });
  const ins = await cert.inscribirAlumno({ certificacion_id: c.id, alumno_id: "al-5", coach_id: a.id });
  const { modulos } = await cert.obtenerCertificacion(c.id);
  const m1 = modulos.find((m) => m.numero === 1).modulo_id;
  return { cert, gastos, c, a, b, cc, ins, modulos, m1 };
}

async function completarModuloUno({ cert, b, cc, m1 }) {
  const { encuentros, sesiones } = await cert.obtenerModulo(m1);
  const profe = { 1: b.id, 2: b.id, 3: cc.id, 4: cc.id };
  for (const e of encuentros) {
    await cert.actualizarEncuentro(e.id, { profe_id: profe[e.numero], dictado: true, ...(e.numero === 4 ? { tarifa: 100 } : {}) });
  }
  await cert.actualizarSesion(sesiones.find((s) => s.alumno === "Alumno Nuevo").id, { realizada: true });
}

describe("certificación de /demo", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T15:00:00-03:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("trae una certificación de ejemplo con el módulo 3 listo para liquidar y un pendiente tardío", async () => {
    const { cert } = demo();
    const [c] = await cert.listarCertificaciones();
    const r = await cert.obtenerCertificacion(c.id);
    expect(r.modulos.filter((m) => m.cerrado_en).map((m) => m.numero)).toEqual([1, 2]);
    expect(r.modulos.find((m) => m.listo_para_liquidar).numero).toBe(3);
    expect(r.avance.map((x) => x.sesiones_realizadas).sort()).toEqual([1, 2, 3, 3]);
    const [resumen] = cert.resumenCertificaciones();
    expect(resumen.modulosListos).toHaveLength(1);
    expect(resumen.tardios).toMatchObject({ total: 50, personas: 1 });
    expect(resumen.moduloEnCurso).toBe(3);
  });

  it("caso de referencia: liquidar el módulo 1 da A 50, B 80 y C 140, y crea los pagos en Gastos", async () => {
    const caso = await casoDeReferencia();
    await completarModuloUno(caso);
    const planilla = await caso.cert.obtenerModulo(caso.m1);
    expect(planilla.liquidacion.map((f) => [f.nombre, f.concepto, f.cantidad, f.total])).toEqual([
      ["A Coach", "sesiones", 1, 50],
      ["B Profe", "encuentros", 2, 80],
      ["C Profe", "encuentros", 2, 140],
    ]);
    expect(planilla.modulo.listo_para_liquidar).toBe(true);

    const r = await caso.cert.liquidarModulo(caso.m1, { metodo_pago: "transferencia" });
    expect(r.creados).toBe(3);
    const { pagos } = await caso.gastos.listarPagosGasto();
    const deLiquidacion = pagos.filter((p) => p.de_liquidacion && p.descripcion.startsWith("Cert TEST"));
    expect(deLiquidacion.map((p) => [p.categoria_nombre, p.monto, p.fecha_pago]).sort()).toEqual([
      ["Pago de encuentros", 140, "2026-10-04"],
      ["Pago de encuentros", 80, "2026-10-04"],
      ["Pago de sesiones", 50, "2026-10-04"],
    ]);
    const despues = await caso.cert.obtenerModulo(caso.m1);
    expect(despues.modulo.cerrado_en).not.toBeNull();
    expect(despues.encuentros.every((e) => e.pago_gasto_id)).toBe(true);
    await expect(caso.cert.liquidarModulo(caso.m1, { metodo_pago: "efectivo" })).rejects.toThrow("Este módulo ya fue pagado");
  });

  it("lo pagado queda protegido con el mensaje de la base", async () => {
    const caso = await casoDeReferencia();
    await completarModuloUno(caso);
    await caso.cert.liquidarModulo(caso.m1, { metodo_pago: "efectivo" });
    const { encuentros } = await caso.cert.obtenerModulo(caso.m1);
    await expect(caso.cert.actualizarEncuentro(encuentros[0].id, { tarifa: 10 })).rejects.toThrow(
      "Este encuentro ya fue pagado: para corregirlo, primero eliminá el pago en Gastos"
    );
    // La fecha no está protegida.
    await expect(caso.cert.actualizarEncuentro(encuentros[0].id, { fecha: "2026-10-01" })).resolves.toMatchObject({ fecha: "2026-10-01" });
  });

  it("una sesión hecha tarde queda pendiente de 50 y liquidar pendientes la paga una sola vez", async () => {
    const caso = await casoDeReferencia();
    await completarModuloUno(caso);
    await caso.cert.liquidarModulo(caso.m1, { metodo_pago: "efectivo" });
    const otro = await caso.cert.inscribirAlumno({ certificacion_id: caso.c.id, alumno_id: "al-1", coach_id: caso.a.id });
    const ficha = await caso.cert.obtenerInscripcion(otro.id);
    await caso.cert.actualizarSesion(ficha.sesiones.find((s) => s.modulo === 1).id, { realizada: true });

    const { pendientes } = await caso.cert.obtenerCertificacion(caso.c.id);
    expect(pendientes).toEqual([{ equipo_id: caso.a.id, nombre: "A Coach", concepto: "sesiones", cantidad: 1, total: 50 }]);
    const primera = await caso.cert.liquidarPendientes(caso.c.id, { metodo_pago: "transferencia" });
    expect(primera.creados).toBe(1);
    expect(primera.pagos[0]).toMatchObject({ monto: 50, descripcion: "Cert TEST · Pagos atrasados · 1 sesión", modulo_id: null });
    const segunda = await caso.cert.liquidarPendientes(caso.c.id, { metodo_pago: "transferencia" });
    expect(segunda.creados).toBe(0);
  });

  it("con tarifa_encuentro vacía y un encuentro dictado el total es null y no se liquida", async () => {
    const caso = await casoDeReferencia({ tarifa_encuentro: "" });
    const { encuentros } = await caso.cert.obtenerModulo(caso.m1);
    await caso.cert.actualizarEncuentro(encuentros[0].id, { profe_id: caso.b.id, dictado: true });
    const { liquidacion } = await caso.cert.obtenerModulo(caso.m1);
    expect(liquidacion).toEqual([{ equipo_id: caso.b.id, nombre: "B Profe", concepto: "encuentros", cantidad: 1, total: null }]);
    await expect(caso.cert.liquidarModulo(caso.m1, { metodo_pago: "efectivo" })).rejects.toThrow(
      "Falta definir la tarifa de la certificación antes de pagar al equipo"
    );
  });

  it("eliminar el pago en Gastos deja el ítem pendiente otra vez", async () => {
    const caso = await casoDeReferencia();
    await completarModuloUno(caso);
    const { pagos } = await caso.cert.liquidarModulo(caso.m1, { metodo_pago: "efectivo" });
    const pagoC = pagos.find((p) => p.equipo_id === caso.cc.id);
    await caso.gastos.eliminarPagoGasto(pagoC.id);
    const { encuentros } = await caso.cert.obtenerModulo(caso.m1);
    expect(encuentros.filter((e) => e.profe_id === caso.cc.id).every((e) => e.pago_gasto_id === null)).toBe(true);
    const { pendientes } = await caso.cert.obtenerCertificacion(caso.c.id);
    expect(pendientes).toEqual([{ equipo_id: caso.cc.id, nombre: "C Profe", concepto: "encuentros", cantidad: 2, total: 140 }]);
  });

  it("en un pago de liquidación se corrigen método y fecha, pero no el monto ni la categoría", async () => {
    const caso = await casoDeReferencia();
    await completarModuloUno(caso);
    const { pagos } = await caso.cert.liquidarModulo(caso.m1, { metodo_pago: "efectivo" });
    await expect(caso.gastos.actualizarPagoGasto(pagos[0].id, { monto: 1 })).rejects.toThrow(/solo se pueden cambiar/);
    const editado = await caso.gastos.actualizarPagoGasto(pagos[0].id, { metodo_pago: "transferencia", fecha_pago: "2026-10-03", proveedor: "Banco" });
    expect(editado).toMatchObject({ metodo_pago: "transferencia", fecha_pago: "2026-10-03", proveedor: "Banco", monto: 50, de_liquidacion: true });
  });

  it("cambiar el coach mueve solo las sesiones pendientes", async () => {
    const caso = await casoDeReferencia();
    await completarModuloUno(caso);
    await caso.cert.cambiarCoach(caso.ins.id, caso.b.id);
    const ficha = await caso.cert.obtenerInscripcion(caso.ins.id);
    expect(ficha.sesiones.find((s) => s.modulo === 1).coach).toBe("A Coach");
    expect(ficha.sesiones.filter((s) => s.modulo > 1).every((s) => s.coach === "B Profe")).toBe(true);
  });

  it("prácticas finales: no en el módulo 3, y como máximo 5", async () => {
    const caso = await casoDeReferencia();
    const numero = (n) => caso.modulos.find((m) => m.numero === n).modulo_id;
    await expect(caso.cert.agregarPractica(numero(3))).rejects.toThrow("Las prácticas finales solo pueden estar en los módulos 9 y 10");
    for (let i = 0; i < 3; i += 1) await caso.cert.agregarPractica(numero(9));
    await caso.cert.agregarPractica(numero(10));
    await caso.cert.agregarPractica(numero(10));
    await expect(caso.cert.agregarPractica(numero(10))).rejects.toThrow("Una certificación tiene como máximo 5 encuentros de práctica final");
  });

  it("una persona con historial no se borra: se explica que se desactiva", async () => {
    const caso = await casoDeReferencia();
    await expect(caso.cert.eliminarPersonaEquipo(caso.a.id)).rejects.toThrow(/Desactivala/);
    const sinHistorial = await caso.cert.crearPersonaEquipo({ nombre: "Sin historial" });
    await expect(caso.cert.eliminarPersonaEquipo(sinHistorial.id)).resolves.toEqual({ ok: true });
  });
});
