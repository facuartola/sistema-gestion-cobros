import { describe, expect, it } from "vitest";
import {
  agruparPorDia,
  cobradoPorMetodo,
  distribucionSesiones,
  estadoDeCobrosDelMes,
  gastosPorGrupo,
  grupoDeRuta,
  indicadoresDelMes,
  marcasDelEje,
  mesesDeTendencia,
  mesesDelPeriodo,
  montoCorto,
  periodoValido,
  proximosDias,
  proyeccionDelMes,
  quienDebe,
  serieMensual,
  tasaDeCobranza,
  textoDelTramo,
  textoVariacion,
  totalDelTramo,
  tramosDeComparacion,
  tonoVariacion,
  variacion,
} from "./panorama";

const cobro = (mes, total, metodo = "transferencia", origen = "jugadores", cantidad = 1) => ({ mes: `${mes}-01`, origen, metodo, total: String(total), cantidad });
const gasto = (mes, ruta, total, cantidad = 1) => ({ mes: `${mes}-01`, categoria_id: ruta, ruta, nivel: ruta.split(" > ").length, total: String(total), cantidad });

describe("períodos", () => {
  it("meses de cada período", () => {
    expect(mesesDelPeriodo("mes", "2026-10")).toEqual(["2026-10"]);
    expect(mesesDelPeriodo("6m", "2026-10")).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(mesesDelPeriodo("anio", "2026-03")).toEqual(["2026-01", "2026-02", "2026-03"]);
  });
  it("la tendencia nunca es de un solo mes", () => {
    expect(mesesDeTendencia("mes", "2026-10")).toHaveLength(6);
    expect(mesesDeTendencia("anio", "2026-01")).toEqual(["2025-11", "2025-12", "2026-01"]);
    expect(mesesDeTendencia("anio", "2026-10")).toHaveLength(10);
  });
  it("valida la clave", () => {
    expect(periodoValido("6m")).toBe("6m");
    expect(periodoValido("x")).toBeNull();
  });
});

describe("serieMensual e indicadores", () => {
  it("suma por mes, rellena con ceros y calcula el resultado", () => {
    const s = serieMensual(
      [cobro("2026-09", 100), cobro("2026-09", 50, "efectivo"), cobro("2026-10", 80)],
      [gasto("2026-10", "Gastos fijos > Wifi", 30)],
      ["2026-08", "2026-09", "2026-10"]
    );
    expect(s).toEqual([
      { mes: "2026-08", cobrado: 0, gastado: 0, resultado: 0 },
      { mes: "2026-09", cobrado: 150, gastado: 0, resultado: 150 },
      { mes: "2026-10", cobrado: 80, gastado: 30, resultado: 50 },
    ]);
  });
  it("ignora meses fuera de la serie y totales raros", () => {
    const s = serieMensual([cobro("2020-01", 999), { mes: "2026-10-01", total: null, cantidad: 0 }], [], ["2026-10"]);
    expect(s[0].cobrado).toBe(0);
  });
  it("la serie y el valor del mes siguen siendo mensuales", () => {
    const i = indicadoresDelMes([cobro("2025-12", 200), cobro("2026-01", 300)], [], "2026-01");
    expect(i.cobrado.valor).toBe(300);
    expect(i.serie[0].mes).toBe("2025-08");
  });
  it("sin datos diarios no hay base de comparación (mensaje neutro, no un porcentaje)", () => {
    const i = indicadoresDelMes([cobro("2026-10", 90)], [], "2026-10");
    expect(i.cobrado.valor).toBe(90);
    expect(i.cobrado.variacion).toEqual({ pct: null, direccion: "igual", sinBase: true });
    expect(i.gastado.variacion.sinBase).toBe(true);
  });
});

const dia = (fecha, total) => ({ fecha, total });

describe("comparación contra el mismo tramo del mes anterior", () => {
  it("el tramo es del 1 al día de hoy, contra del 1 al mismo día del mes anterior", () => {
    const t = tramosDeComparacion("2026-10-05");
    expect(t.actual).toEqual({ desde: "2026-10-01", hasta: "2026-10-05" });
    expect(t.anterior).toEqual({ desde: "2026-09-01", hasta: "2026-09-05" });
    expect(textoDelTramo("2026-10-05")).toBe("del 1 al 5");
    expect(textoDelTramo("2026-10-01")).toBe("el día 1");
  });
  it("si el mes anterior es más corto, se compara contra todo ese mes", () => {
    expect(tramosDeComparacion("2026-03-31").anterior).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
    expect(tramosDeComparacion("2024-03-31").anterior.hasta).toBe("2024-02-29");
  });
  it("enero se compara con diciembre del año anterior", () => {
    expect(tramosDeComparacion("2026-01-10").anterior).toEqual({ desde: "2025-12-01", hasta: "2025-12-10" });
  });
  it("suma solo lo que cae dentro del tramo", () => {
    const diarios = [dia("2026-09-03", 100), dia("2026-09-05", 50), dia("2026-09-06", 999), dia("2026-10-02", 70)];
    expect(totalDelTramo(diarios, { desde: "2026-09-01", hasta: "2026-09-05" })).toBe(150);
    expect(totalDelTramo([], { desde: "2026-09-01", hasta: "2026-09-05" })).toBe(0);
  });
  it("del 1 al 5 de este mes contra del 1 al 5 del anterior (y no contra todo el mes anterior)", () => {
    const cobros = [dia("2026-09-02", 100), dia("2026-09-04", 100), dia("2026-09-20", 800), dia("2026-10-03", 220)];
    const i = indicadoresDelMes([cobro("2026-09", 1000), cobro("2026-10", 220)], [], "2026-10", 6, { hoy: "2026-10-05", cobros, gastos: [] });
    // Contra el mes completo habría sido ▼ 78 %; contra el mismo tramo sube.
    expect(i.cobrado.variacion).toEqual({ pct: 10, direccion: "sube", sinBase: false });
    expect(textoVariacion(i.cobrado.variacion)).toBe("▲ 10 %");
  });
  it("gastado y resultado se comparan igual", () => {
    const cobros = [dia("2026-09-02", 100), dia("2026-10-02", 100)];
    const gastos = [dia("2026-09-03", 40), dia("2026-10-03", 20), dia("2026-09-25", 500)];
    const i = indicadoresDelMes([], [], "2026-10", 6, { hoy: "2026-10-05", cobros, gastos });
    expect(i.gastado.variacion).toEqual({ pct: -50, direccion: "baja", sinBase: false });
    expect(tonoVariacion(i.gastado.variacion, false)).toBe("ok");
    expect(i.resultado.variacion).toEqual({ pct: 33, direccion: "sube", sinBase: false });
  });
  it("sin movimientos en el tramo anterior: mensaje neutro en vez de un porcentaje", () => {
    const cobros = [dia("2026-09-20", 500), dia("2026-10-02", 100)];
    const i = indicadoresDelMes([], [], "2026-10", 6, { hoy: "2026-10-05", cobros, gastos: [] });
    expect(i.cobrado.variacion.sinBase).toBe(true);
    expect(i.cobrado.variacion.pct).toBeNull();
    expect(textoVariacion(i.cobrado.variacion)).toBe("Sin datos del mismo tramo del mes anterior");
    expect(tonoVariacion(i.cobrado.variacion)).toBe("neutro");
  });
  it("agrupa por día las filas con fecha de pago y descarta las que no tienen", () => {
    const filas = [
      { fecha_pago: "2026-10-02", monto: "50" },
      { fecha_pago: "2026-10-02", monto: 25 },
      { fecha_pago: "2026-10-01", monto: 10 },
      { fecha_pago: null, monto: 99 },
    ];
    expect(agruparPorDia(filas)).toEqual([dia("2026-10-01", 10), dia("2026-10-02", 75)]);
  });
});

describe("variacion", () => {
  it("sube, baja e igual", () => {
    expect(variacion(112, 100)).toEqual({ pct: 12, direccion: "sube", sinBase: false });
    expect(variacion(92, 100)).toEqual({ pct: -8, direccion: "baja", sinBase: false });
    expect(variacion(100, 100)).toEqual({ pct: 0, direccion: "igual", sinBase: false });
  });
  it("división por cero: sin base, sin porcentaje", () => {
    expect(variacion(50, 0)).toEqual({ pct: null, direccion: "sube", sinBase: true });
    expect(variacion(0, 0).direccion).toBe("igual");
    expect(variacion(undefined, null).sinBase).toBe(true);
  });
  it("con resultados negativos usa el valor absoluto del anterior", () => {
    expect(variacion(-50, -100)).toEqual({ pct: 50, direccion: "sube", sinBase: false });
    expect(variacion(-150, -100).direccion).toBe("baja");
  });
  it("textos y tonos", () => {
    expect(textoVariacion(variacion(112, 100))).toBe("▲ 12 %");
    expect(textoVariacion(variacion(92, 100))).toBe("▼ 8 %");
    expect(textoVariacion(variacion(100, 100))).toBe("= 0 %");
    expect(textoVariacion(variacion(100000, 1))).toBe("▲ más de 999 %");
    expect(textoVariacion(variacion(112, 100))).toBe("▲ 12 %");
    expect(textoVariacion(variacion(5, 0))).toMatch(/mismo tramo del mes anterior/);
    expect(tonoVariacion(variacion(112, 100))).toBe("ok");
    expect(tonoVariacion(variacion(112, 100), false)).toBe("warn");
    expect(tonoVariacion(variacion(92, 100), false)).toBe("ok");
    expect(tonoVariacion(variacion(5, 0))).toBe("neutro");
  });
});

describe("cobradoPorMetodo", () => {
  it("separa efectivo, transferencia y sin método, y solo muestra lo que hay", () => {
    const r = cobradoPorMetodo(
      [cobro("2026-10", 100, "efectivo", "jugadores", 2), cobro("2026-10", 40, "efectivo", "alumnos"), cobro("2026-09", 60, "transferencia"), cobro("2026-10", 25, "sin_metodo")],
      ["2026-10"]
    );
    expect(r.map((m) => [m.clave, m.total, m.cantidad])).toEqual([
      ["efectivo", 140, 3],
      ["sin_metodo", 25, 1],
    ]);
  });
  it("sin cobros, vacío", () => {
    expect(cobradoPorMetodo([], ["2026-10"])).toEqual([]);
  });
});

describe("gastosPorGrupo", () => {
  it("toma el nivel 2 del árbol y agrupa los fijos por su nivel 1", () => {
    expect(grupoDeRuta("Gastos variables > Equipo de marketing > Consultora de marketing")).toBe("Equipo de marketing");
    expect(grupoDeRuta("Gastos fijos > Wifi")).toBe("Gastos fijos");
    expect(grupoDeRuta("Suelto")).toBe("Suelto");
  });
  it("suma, ordena de mayor a menor y deja el detalle", () => {
    const g = gastosPorGrupo(
      [
        gasto("2026-10", "Gastos fijos > Wifi", 45),
        gasto("2026-10", "Gastos fijos > Celulares", 55),
        gasto("2026-10", "Gastos variables > Equipo de marketing > Consultora de marketing", 300),
        gasto("2026-09", "Gastos fijos > Wifi", 999),
      ],
      ["2026-10"]
    );
    expect(g.map((x) => [x.nombre, x.total])).toEqual([
      ["Equipo de marketing", 300],
      ["Gastos fijos", 100],
    ]);
    expect(g[1].detalle.map((d) => d.nombre)).toEqual(["Celulares", "Wifi"]);
  });
  it("junta el resto en Otros pasado el máximo", () => {
    const filas = ["A", "B", "C", "D", "E", "F", "G"].map((n, i) => gasto("2026-10", `Gastos variables > ${n} > x`, 100 - i * 10));
    const g = gastosPorGrupo(filas, ["2026-10"], 5);
    expect(g).toHaveLength(5);
    expect(g[4]).toMatchObject({ clave: "__otros", nombre: "Otros", total: 60 + 50 + 40 });
    expect(g.reduce((a, x) => a + x.total, 0)).toBe(100 + 90 + 80 + 70 + 60 + 50 + 40);
  });
  it("sin gastos, vacío", () => {
    expect(gastosPorGrupo([], ["2026-10"])).toEqual([]);
  });
});

describe("cuotas del mes", () => {
  const ahora = new Date("2026-10-15T15:00:00Z");
  const p = (nombre, dia, monto, cuota = null, extra = {}) => ({ id: nombre, nombre, tipo: "jugador", dia_vencimiento: dia, monto_mensual: monto, cuota_actual: cuota, meses_adeudados: 0, ...extra });
  const personas = [
    p("Ana", 5, 100, { estado: "pagado", monto: 100 }),
    p("Beto", 3, 200), // atrasado
    p("Cata", 25, 300), // por vencer
    p("Dani", null, 50), // sin vencimiento: por vencer
  ];

  it("reparte en pagó, por vencer y atrasado con montos", () => {
    const e = estadoDeCobrosDelMes(personas, "2026-10", ahora);
    expect(e.pago).toEqual({ n: 1, monto: 100 });
    expect(e.atrasado).toEqual({ n: 1, monto: 200 });
    expect(e.porVencer).toEqual({ n: 2, monto: 350 });
    expect(e.esperado).toBe(650);
    expect(e.porCobrar).toBe(550);
    expect(e.porCobrarN).toBe(3);
  });
  it("tasa de cobranza: cobrado sobre esperado; null sin nadie", () => {
    expect(tasaDeCobranza(estadoDeCobrosDelMes(personas, "2026-10", ahora))).toBe(15);
    expect(tasaDeCobranza(estadoDeCobrosDelMes([], "2026-10", ahora))).toBeNull();
  });

  it("quién debe: atrasados y deuda de meses anteriores, del más antiguo al más nuevo", () => {
    const lista = [
      ...personas,
      p("Eli", 25, 400, null, { meses_adeudados: 2 }), // debe 2 meses anteriores, este no venció
      p("Fede", 1, 80, null, { meses_adeudados: 1 }), // atrasado este mes
    ];
    const r = quienDebe(lista, "2026-10", "2026-10-15", ahora);
    expect(r.items.map((i) => i.persona.nombre)).toEqual(["Eli", "Fede", "Beto"]);
    const eli = r.items[0];
    expect(eli).toMatchObject({ meses: 2, monto: 800, puedeCobrar: false, diasAtraso: null });
    const fede = r.items[1];
    expect(fede).toMatchObject({ meses: 1, diasAtraso: 14, monto: 80, puedeCobrar: true });
  });
  it("la deuda de meses anteriores es más antigua que la cuota atrasada de este mes", () => {
    const lista = [p("Gus", 1, 80), p("Hana", 25, 90, null, { meses_adeudados: 1 })];
    const r = quienDebe(lista, "2026-10", "2026-10-15", ahora);
    expect(r.items.map((i) => i.persona.nombre)).toEqual(["Hana", "Gus"]);
  });
  it("máximo de filas y total", () => {
    const muchos = Array.from({ length: 8 }, (_, i) => p(`P${i}`, 1, 10));
    const r = quienDebe(muchos, "2026-10", "2026-10-15", ahora, 5);
    expect(r.items).toHaveLength(5);
    expect(r.total).toBe(8);
  });
  it("nadie debe nada", () => {
    expect(quienDebe([personas[0]], "2026-10", "2026-10-15", ahora)).toEqual({ total: 0, items: [] });
  });
});

describe("proyeccionDelMes", () => {
  it("si todos pagan: ingresos esperados menos gastos, con margen", () => {
    expect(proyeccionDelMes({ cobrado: 600, porCobrar: 400, gastado: 200, gastosPorPagar: 100 })).toMatchObject({ ingresos: 1000, egresos: 300, cierre: 700, margenPct: 70 });
  });
  it("sin ingresos no hay margen (división por cero)", () => {
    const r = proyeccionDelMes({ cobrado: 0, porCobrar: 0, gastado: 50, gastosPorPagar: 0 });
    expect(r.cierre).toBe(-50);
    expect(r.margenPct).toBeNull();
  });
});

describe("proximosDias", () => {
  const hoy = "2026-10-05";
  const personas = [
    { id: "a", nombre: "A", dia_vencimiento: 10, monto_mensual: 100, cuota_actual: null }, // 10 oct: semana 1
    { id: "b", nombre: "B", dia_vencimiento: 20, monto_mensual: 50, cuota_actual: { estado: "pagado", monto: 50 } }, // pagada: no cuenta
    { id: "c", nombre: "C", dia_vencimiento: 2, monto_mensual: 70, cuota_actual: null }, // 2 oct ya venció; 2 nov está a 28 días
    { id: "d", nombre: "D", dia_vencimiento: null, monto_mensual: 90, cuota_actual: null },
    { id: "e", nombre: "E", dia_vencimiento: 28, monto_mensual: 30, cuota_actual: { estado: "pendiente", monto: 35 } }, // 28 oct, 23 días
  ];
  const categorias = [
    { id: "w", nombre: "Wifi", parent_id: null, orden: 1, recurrencia: "mensual", monto_estimado: 45, dia_vencimiento: 12, mes_vencimiento: null, activo: true, created_at: null },
    { id: "m", nombre: "Mant", parent_id: null, orden: 2, recurrencia: "mensual", monto_estimado: null, dia_vencimiento: 8, mes_vencimiento: null, activo: true, created_at: null },
  ];
  const r = proximosDias({ personas, categorias, pagos: [], hoy });

  it("arma 5 semanas desde hoy hasta 30 días", () => {
    expect(r.semanas).toHaveLength(5);
    expect(r.semanas[0].inicio).toBe("2026-10-05");
    expect(r.semanas[4].fin).toBe("2026-11-04");
  });
  it("cuenta cobros por semana, incluida la cuota del mes que viene", () => {
    expect(r.semanas[0].cobros).toBe(100);
    expect(r.semanas[3].cobros).toBe(35); // E: 28 oct, día 23: semana 4
    expect(r.semanas[4].cobros).toBe(70); // C: 2 nov, día 28
    expect(r.totalCobros).toBe(205);
  });
  it("cuenta gastos con monto por semana y avisa los que no lo tienen", () => {
    expect(r.semanas[1].gastos).toBe(45); // Wifi, 12 oct: día 7
    expect(r.totalGastos).toBe(45);
    expect(r.gastosSinMonto).toBe(1); // Mant, 8 oct
    expect(r.semanas[0].nGastos).toBe(1);
    expect(r.hayAlgo).toBe(true);
  });
  it("sin nada que vencer, hayAlgo es falso", () => {
    expect(proximosDias({ personas: [], categorias: [], pagos: [], hoy }).hayAlgo).toBe(false);
  });
});

describe("certificación y ejes", () => {
  it("distribución de alumnos por sesiones hechas, de 0 a 10", () => {
    const d = distribucionSesiones([{ sesiones_realizadas: 0 }, { sesiones_realizadas: 3 }, { sesiones_realizadas: 3 }, { sesiones_realizadas: 10 }, { sesiones_realizadas: 12 }]);
    expect(d).toHaveLength(11);
    expect([d[0], d[3], d[10]]).toEqual([1, 2, 2]);
    expect(distribucionSesiones([])).toEqual(Array(11).fill(0));
  });
  it("montos cortos", () => {
    expect(montoCorto(950)).toBe("950");
    expect(montoCorto(1250)).toBe("1,3 mil");
    expect(montoCorto(12000)).toBe("12 mil");
    expect(montoCorto(2_500_000)).toBe("2,5 M");
    expect(montoCorto(-1500)).toBe("−1,5 mil");
  });
  it("marcas del eje: siempre hay 0 y nunca un eje vacío", () => {
    expect(marcasDelEje(0, 0)).toContain(0);
    expect(marcasDelEje(0, 0).length).toBeGreaterThan(1);
    expect(marcasDelEje(0, 9400)).toEqual([0, 5000, 10000]);
    const conNegativos = marcasDelEje(-300, 1200);
    expect(conNegativos[0]).toBeLessThanOrEqual(-300);
    expect(conNegativos).toContain(0);
  });
});
