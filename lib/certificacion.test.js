import { describe, expect, it } from "vitest";
import {
  calcularLiquidacion,
  calcularPendientes,
  cambiarCoach,
  descripcionPago,
  estadoDeModulos,
  estadoModulo,
  liquidar,
  moduloEnCurso,
  pendientesTardios,
  progresoAlumnos,
  resumenLiquidacion,
  textoCantidad,
  validarNuevaPractica,
} from "./certificacion";

// Caso de referencia, verificado en la base real: tarifa_sesion 50,
// tarifa_encuentro 40, tarifa_practica 60. Módulo 1: la sesión la da el coach A;
// los encuentros 1 y 2 el profe B; el 3 el profe C; el 4 también C con tarifa
// especial de 100.
function caso({ tarifas = { tarifa_sesion: 50, tarifa_encuentro: 40, tarifa_practica: 60 } } = {}) {
  const cert = { id: "c", nombre: "Cert TEST", ...tarifas, estado: "en_curso" };
  const modulos = Array.from({ length: 10 }, (_, i) => ({ id: `m${i + 1}`, certificacion_id: "c", numero: i + 1, cerrado_en: null }));
  const encuentros = modulos.flatMap((m) =>
    [1, 2, 3, 4].map((n) => ({ id: `${m.id}-e${n}`, modulo_id: m.id, tipo: "regular", numero: n, profe_id: null, tarifa: null, dictado: false, pago_gasto_id: null }))
  );
  const inscripciones = [
    { id: "i1", certificacion_id: "c", alumno_id: "al1", coach_id: "A" },
    { id: "i2", certificacion_id: "c", alumno_id: "al2", coach_id: "A" },
  ];
  const sesiones = inscripciones.flatMap((i) =>
    modulos.map((m) => ({ id: `${i.id}-${m.id}`, inscripcion_id: i.id, modulo_id: m.id, coach_id: i.coach_id, realizada: false, fecha_realizada: null, tarifa: null, pago_gasto_id: null }))
  );
  const equipo = [
    { id: "A", nombre: "Ana Coach", activo: true },
    { id: "B", nombre: "Beto Profe", activo: true },
    { id: "C", nombre: "Caro Profe", activo: true },
  ];
  const alumnos = [
    { id: "al1", nombre: "Alumno Uno" },
    { id: "al2", nombre: "Alumno Dos" },
  ];
  return { cert, modulos, encuentros, sesiones, equipo, inscripciones, alumnos };
}

function moduloUnoCompleto(d) {
  const profe = { 1: "B", 2: "B", 3: "C", 4: "C" };
  return {
    ...d,
    encuentros: d.encuentros.map((e) =>
      e.modulo_id === "m1" ? { ...e, profe_id: profe[e.numero], dictado: true, tarifa: e.numero === 4 ? 100 : null } : e
    ),
    sesiones: d.sesiones.map((s) => (s.id === "i1-m1" ? { ...s, realizada: true, fecha_realizada: "2026-10-04" } : s)),
  };
}

let n = 0;
const opciones = (extra = {}) => ({
  fecha_pago: "2026-10-04",
  metodo_pago: "transferencia",
  categorias: { sesiones: "cat-ses", encuentros: "cat-enc" },
  nuevoId: () => `pago-${(n += 1)}`,
  ahora: "2026-10-04T15:00:00.000Z",
  ...extra,
});

describe("calcularLiquidacion (caso de referencia)", () => {
  it("módulo 1: coach A 1 sesión 50; profe B 2 encuentros 80; profe C 2 encuentros 140", () => {
    const filas = calcularLiquidacion(moduloUnoCompleto(caso()), "m1");
    expect(filas).toEqual([
      { equipo_id: "A", nombre: "Ana Coach", concepto: "sesiones", cantidad: 1, total: 50 },
      { equipo_id: "B", nombre: "Beto Profe", concepto: "encuentros", cantidad: 2, total: 80 },
      { equipo_id: "C", nombre: "Caro Profe", concepto: "encuentros", cantidad: 2, total: 140 },
    ]);
    expect(resumenLiquidacion(filas)).toEqual({ total: 270, personas: 3, faltaTarifa: false, vacio: false });
  });

  it("con tarifa_encuentro vacía y un encuentro dictado, el total es null y no se puede liquidar", () => {
    const d = caso({ tarifas: { tarifa_sesion: 50, tarifa_encuentro: null, tarifa_practica: null } });
    d.encuentros = d.encuentros.map((e) => (e.id === "m1-e1" ? { ...e, profe_id: "B", dictado: true } : e));
    const filas = calcularLiquidacion(d, "m1");
    expect(filas).toEqual([{ equipo_id: "B", nombre: "Beto Profe", concepto: "encuentros", cantidad: 1, total: null }]);
    expect(resumenLiquidacion(filas)).toMatchObject({ total: null, faltaTarifa: true });
    expect(() => liquidar(d, opciones({ moduloId: "m1" }))).toThrow("Falta definir la tarifa de la certificación antes de pagar al equipo");
  });

  it("incluye lo hecho y no pagado de módulos anteriores, no de los posteriores", () => {
    const d = moduloUnoCompleto(caso());
    d.sesiones = d.sesiones.map((s) => (s.id === "i2-m3" ? { ...s, realizada: true } : s));
    expect(calcularLiquidacion(d, "m1").find((f) => f.concepto === "sesiones").cantidad).toBe(1);
    expect(calcularLiquidacion(d, "m3").find((f) => f.concepto === "sesiones").cantidad).toBe(2);
  });

  it("las prácticas finales usan su tarifa y, si falta, la de encuentro", () => {
    const d = caso();
    d.encuentros.push({ id: "p1", modulo_id: "m9", tipo: "practica_final", numero: 1, profe_id: "B", tarifa: null, dictado: true, pago_gasto_id: null });
    expect(calcularLiquidacion(d, "m9")[0].total).toBe(60);
    d.cert = { ...d.cert, tarifa_practica: null };
    expect(calcularLiquidacion(d, "m9")[0].total).toBe(40);
  });
});

describe("liquidar", () => {
  it("crea un pago por persona y concepto, marca lo pagado y cierra el módulo", () => {
    const { datos, pagos } = liquidar(moduloUnoCompleto(caso()), opciones({ moduloId: "m1" }));
    expect(pagos.map((p) => [p.equipo_id, p.categoria_id, p.monto, p.descripcion, p.modulo_id])).toEqual([
      ["A", "cat-ses", 50, "Cert TEST · Módulo 1 · 1 sesión", "m1"],
      ["B", "cat-enc", 80, "Cert TEST · Módulo 1 · 2 encuentros", "m1"],
      ["C", "cat-enc", 140, "Cert TEST · Módulo 1 · 2 encuentros", "m1"],
    ]);
    expect(datos.modulos.find((m) => m.id === "m1").cerrado_en).toBe("2026-10-04T15:00:00.000Z");
    expect(datos.encuentros.filter((e) => e.modulo_id === "m1").every((e) => e.pago_gasto_id)).toBe(true);
    expect(datos.sesiones.find((s) => s.id === "i1-m1").pago_gasto_id).toBe(pagos[0].id);
    expect(calcularLiquidacion(datos, "m1")).toEqual([]);
  });

  it("un módulo se liquida una sola vez", () => {
    const { datos } = liquidar(moduloUnoCompleto(caso()), opciones({ moduloId: "m1" }));
    expect(() => liquidar(datos, opciones({ moduloId: "m1" }))).toThrow("Este módulo ya fue pagado");
  });

  it("una sesión del módulo 1 hecha tarde queda pendiente de 50 y liquidar pendientes la paga una sola vez", () => {
    const { datos: liquidado } = liquidar(moduloUnoCompleto(caso()), opciones({ moduloId: "m1" }));
    const tarde = { ...liquidado, sesiones: liquidado.sesiones.map((s) => (s.id === "i2-m1" ? { ...s, realizada: true } : s)) };
    expect(calcularPendientes(tarde)).toEqual([{ equipo_id: "A", nombre: "Ana Coach", concepto: "sesiones", cantidad: 1, total: 50 }]);
    expect(pendientesTardios(tarde)).toHaveLength(1);
    const primera = liquidar(tarde, opciones());
    expect(primera.pagos.map((p) => [p.monto, p.descripcion, p.modulo_id])).toEqual([[50, "Cert TEST · Pagos atrasados · 1 sesión", null]]);
    const segunda = liquidar(primera.datos, opciones());
    expect(segunda.pagos).toHaveLength(0);
    expect(calcularPendientes(primera.datos)).toEqual([]);
  });

  it("rechaza un método inválido", () => {
    expect(() => liquidar(moduloUnoCompleto(caso()), opciones({ moduloId: "m1", metodo_pago: "cheque" }))).toThrow("Método de pago inválido");
  });

  it("un pago eliminado deja el ítem pendiente otra vez", () => {
    const { datos, pagos } = liquidar(moduloUnoCompleto(caso()), opciones({ moduloId: "m1" }));
    const pagoC = pagos.find((p) => p.equipo_id === "C").id;
    const sinPago = { ...datos, encuentros: datos.encuentros.map((e) => (e.pago_gasto_id === pagoC ? { ...e, pago_gasto_id: null } : e)) };
    expect(calcularPendientes(sinPago)).toEqual([{ equipo_id: "C", nombre: "Caro Profe", concepto: "encuentros", cantidad: 2, total: 140 }]);
  });
});

describe("estado de módulos y avance", () => {
  it("un módulo está listo con sus 4 encuentros dictados; liquidado cuando se cierra", () => {
    const d = moduloUnoCompleto(caso());
    const estados = estadoDeModulos(d);
    expect(estados[0]).toMatchObject({ numero: 1, encuentros_dictados: 4, encuentros_total: 4, sesiones_realizadas: 1, sesiones_total: 2, listo_para_liquidar: true });
    expect(estadoModulo(estados[0])).toBe("listo");
    expect(estadoModulo(estados[1])).toBe("en_curso");
    const { datos } = liquidar(d, opciones({ moduloId: "m1" }));
    const despues = estadoDeModulos(datos);
    expect(estadoModulo(despues[0])).toBe("liquidado");
    expect(moduloEnCurso(despues).numero).toBe(2);
  });

  it("una práctica sin dictar deja el módulo sin terminar", () => {
    const d = caso();
    d.encuentros = d.encuentros.map((e) => (e.modulo_id === "m9" ? { ...e, profe_id: "B", dictado: true } : e));
    expect(estadoDeModulos(d)[8].listo_para_liquidar).toBe(true);
    d.encuentros.push({ id: "p1", modulo_id: "m9", tipo: "practica_final", numero: 1, dictado: false });
    expect(estadoDeModulos(d)[8].listo_para_liquidar).toBe(false);
  });

  it("avance por alumno: 7 de 10 y en condiciones con 10 de 10", () => {
    const d = caso();
    d.sesiones = d.sesiones.map((s) => {
      const numero = Number(s.modulo_id.slice(1));
      if (s.inscripcion_id === "i1") return { ...s, realizada: true };
      return { ...s, realizada: numero <= 7 };
    });
    const avance = progresoAlumnos(d);
    expect(avance.map((a) => [a.alumno, a.sesiones_realizadas, a.sesiones_totales, a.en_condiciones, a.coach])).toEqual([
      ["Alumno Dos", 7, 10, false, "Ana Coach"],
      ["Alumno Uno", 10, 10, true, "Ana Coach"],
    ]);
  });

  it("cambiar de coach mueve solo las sesiones no hechas y no pagadas", () => {
    const d = moduloUnoCompleto(caso());
    d.sesiones = d.sesiones.map((s) => (s.id === "i1-m2" ? { ...s, pago_gasto_id: "x" } : s));
    const r = cambiarCoach(d, "i1", "B");
    const coachDe = (id) => r.sesiones.find((s) => s.id === id).coach_id;
    expect(coachDe("i1-m1")).toBe("A"); // hecha
    expect(coachDe("i1-m2")).toBe("A"); // pagada
    expect(coachDe("i1-m3")).toBe("B");
    expect(coachDe("i2-m3")).toBe("A"); // otro alumno
    expect(r.inscripciones.find((i) => i.id === "i1").coach_id).toBe("B");
  });
});

describe("prácticas finales", () => {
  it("solo en los módulos 9 y 10, y como máximo 5", () => {
    const d = caso();
    expect(validarNuevaPractica(d, "m3")).toEqual({ error: "Las prácticas finales solo pueden estar en los módulos 9 y 10" });
    expect(validarNuevaPractica(d, "m9")).toEqual({ numero: 1 });
    for (let i = 1; i <= 3; i += 1) d.encuentros.push({ id: `p9-${i}`, modulo_id: "m9", tipo: "practica_final", numero: i });
    d.encuentros.push({ id: "p10-1", modulo_id: "m10", tipo: "practica_final", numero: 1 });
    expect(validarNuevaPractica(d, "m9")).toEqual({ numero: 4 });
    expect(validarNuevaPractica(d, "m10")).toEqual({ numero: 2 });
    d.encuentros.push({ id: "p10-2", modulo_id: "m10", tipo: "practica_final", numero: 2 });
    expect(validarNuevaPractica(d, "m10")).toEqual({ error: "Una certificación tiene como máximo 5 encuentros de práctica final" });
  });
});

describe("textos", () => {
  it("singular y plural, igual que la base", () => {
    expect(textoCantidad("sesiones", 1)).toBe("1 sesión");
    expect(textoCantidad("encuentros", 3)).toBe("3 encuentros");
    expect(descripcionPago("Cert", null, "encuentros", 1)).toBe("Cert · Pagos atrasados · 1 encuentro");
  });
});
