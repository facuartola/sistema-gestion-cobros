import { describe, expect, it } from "vitest";
import { armarPendientes, cobradoPorFechaDePago, gastosPorPagar, mesesHasta, proximosVencimientos } from "./resumen";
import { gastosPorHacer, totalesDePagos } from "./gastos";
import { calcularLiquidacion, calcularPendientes, estadoDeModulos, progresoAlumnos } from "./certificacion";
import { sumarDiasISO } from "./fechas";

// Carga simulada en memoria (nunca en la base): 200 clientes, 500 pagos de
// gasto y una certificación con 40 alumnos. Fija que los cálculos de Inicio y de
// la certificación sigan siendo instantáneos con un volumen varias veces mayor
// al de hoy, y que los totales cierren.
const HOY = "2026-10-04";
const ahora = new Date("2026-10-04T15:00:00-03:00");

function medir(fn) {
  const t = performance.now();
  const r = fn();
  return { r, ms: performance.now() - t };
}

const personas = Array.from({ length: 200 }, (_, i) => ({
  id: `p${i}`,
  tipo: i % 2 ? "jugador" : "alumno",
  nombre: `Persona ${i}`,
  dia_vencimiento: (i % 28) + 1,
  monto_mensual: 100 + (i % 5) * 10,
  meses_adeudados: i % 3,
  cuota_actual: { estado: i % 4 === 0 ? "pagado" : "pendiente", monto: 100 + (i % 5) * 10 },
}));

const categorias = Array.from({ length: 20 }, (_, i) => ({
  id: `c${i}`,
  nombre: `Categoría ${i}`,
  parent_id: i < 4 ? null : `c${i % 4}`,
  orden: i,
  recurrencia: i % 3 === 0 ? "mensual" : i % 3 === 1 ? "anual" : "ninguna",
  mes_vencimiento: i % 3 === 1 ? (i % 12) + 1 : null,
  dia_vencimiento: (i % 28) + 1,
  monto_estimado: 10 * i,
  activo: true,
}));

const pagos = Array.from({ length: 500 }, (_, i) => ({
  categoria_id: `c${4 + (i % 16)}`,
  fecha_pago: sumarDiasISO(HOY, -(i % 300)),
  periodo: null,
  monto: 10 + (i % 7),
}));

const cuotas = Array.from({ length: 2400 }, (_, i) => ({ mes: `2026-${String((i % 10) + 1).padStart(2, "0")}-01`, fecha_pago: sumarDiasISO(HOY, -(i % 280)), monto: 100 }));

function certificacionGrande() {
  const cert = { id: "k", nombre: "Carga", tarifa_sesion: 50, tarifa_encuentro: 40, tarifa_practica: 60 };
  const modulos = Array.from({ length: 10 }, (_, i) => ({ id: `m${i + 1}`, certificacion_id: "k", numero: i + 1, cerrado_en: null }));
  const equipo = Array.from({ length: 12 }, (_, i) => ({ id: `e${i}`, nombre: `Equipo ${i}` }));
  const encuentros = modulos.flatMap((m, j) => [1, 2, 3, 4].map((n) => ({ id: `${m.id}e${n}`, modulo_id: m.id, tipo: "regular", numero: n, profe_id: `e${n}`, tarifa: null, dictado: j < 5 })));
  const inscripciones = Array.from({ length: 40 }, (_, i) => ({ id: `i${i}`, certificacion_id: "k", alumno_id: `a${i}`, coach_id: `e${4 + (i % 8)}` }));
  const sesiones = inscripciones.flatMap((ins, i) => modulos.map((m, j) => ({ id: `${ins.id}${m.id}`, inscripcion_id: ins.id, modulo_id: m.id, coach_id: ins.coach_id, realizada: j < 5 || i % 7 === 0, tarifa: null })));
  const alumnos = inscripciones.map((i) => ({ id: i.alumno_id, nombre: `Alumno ${i.alumno_id}` }));
  return { cert, modulos, equipo, encuentros, inscripciones, sesiones, alumnos };
}

describe("carga simulada en memoria", () => {
  it("Inicio con 200 clientes y 500 pagos: pendientes, vencimientos y totales al instante", () => {
    const grupos = { vencidos: [], hoy: [], proximos: [], hechos: [] };
    const gastos = medir(() => gastosPorHacer({ categorias, pagos, hoy: HOY }));
    const pendientes = medir(() => armarPendientes({ personas, mes: "2026-10", hoy: HOY, grupos, gastos: gastos.r, ahora }));
    const proximos = medir(() =>
      proximosVencimientos({ personas, pagadas: new Set(), categorias, pagos, hoy: HOY })
    );
    const porPagar = medir(() => gastosPorPagar({ categorias, pagos, hoy: HOY }));
    const serie = medir(() => cobradoPorFechaDePago(cuotas, mesesHasta("2026-10", 6)));
    for (const m of [gastos, pendientes, proximos, porPagar, serie]) expect(m.ms).toBeLessThan(200);
    // Atrasados: pendientes cuyo día de vencimiento (1 a 3) ya pasó el 4 de octubre, más los gastos.
    const atrasados = personas.filter((p) => p.cuota_actual.estado === "pendiente" && p.dia_vencimiento < 4).length;
    expect(pendientes.r.filter((f) => f.tipo === "cobro")).toHaveLength(atrasados);
    expect(pendientes.r.filter((f) => f.tipo === "gasto")).toHaveLength(gastos.r.length);
    expect(serie.r.reduce((a, b) => a + b, 0)).toBe(cuotas.filter((c) => c.fecha_pago >= "2026-05-01").length * 100);
    expect(totalesDePagos(pagos, HOY).anio).toBe(pagos.filter((p) => p.fecha_pago.startsWith("2026")).reduce((a, p) => a + p.monto, 0));
  });

  it("certificación con 40 alumnos: liquidación, pendientes, estado y avance al instante y cuadrados", () => {
    const d = certificacionGrande();
    const liq = medir(() => calcularLiquidacion(d, "m5"));
    const pend = medir(() => calcularPendientes(d));
    const est = medir(() => estadoDeModulos(d));
    const av = medir(() => progresoAlumnos(d));
    for (const m of [liq, pend, est, av]) expect(m.ms).toBeLessThan(200);
    const sesionesHechas = d.sesiones.filter((s) => s.realizada && Number(s.modulo_id.slice(1)) <= 5).length;
    const total = liq.r.reduce((a, f) => a + f.total, 0);
    expect(total).toBe(sesionesHechas * 50 + 20 * 40);
    expect(est.r.filter((f) => f.listo_para_liquidar).length).toBe(5);
    expect(av.r.filter((a) => a.en_condiciones).length).toBe(d.inscripciones.filter((_, i) => i % 7 === 0).length);
  });
});
