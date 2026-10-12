import { describe, expect, it, vi } from "vitest";
import { calcularInicio, conRespaldo, lista, normalizarPanorama, normalizarResumen } from "./inicioDatos";
import { agendaProxima, armarPendientes, fraseGastosPorPagar, ultimosMovimientos } from "./resumen";
import { armarParaHacer } from "./paraHacer";
import { recorteDeValores, valorDibujado } from "./panorama";
import { vistaValida } from "./inicioVistas";

const hoy = "2026-10-06";
const base = { personas: [], panorama: null, resumen: null, categorias: [], periodo: "6m", mesActual: "2026-10", hoy, ahora: new Date("2026-10-06T15:00:00Z"), avance: [] };

describe("falla real: TypeError 'e is not iterable' en Inicio", () => {
  it("agendaProxima ya no se rompe si los vencimientos no vienen como lista", () => {
    expect(() => agendaProxima(undefined, [], hoy)).not.toThrow();
    expect(agendaProxima(undefined, undefined, hoy)).toEqual([]);
    expect(agendaProxima(null, [], hoy)).toEqual([]);
    expect(agendaProxima({ no: "lista" }, [], hoy)).toEqual([]);
  });

  it("armarPendientes tolera grupos, gastos, personas y certificaciones ausentes", () => {
    expect(armarPendientes({ personas: undefined, mes: "2026-10", hoy, grupos: undefined, gastos: null, certificaciones: null })).toEqual([]);
    const cert = [{ id: "c", nombre: "Cert", modulosListos: undefined, listosParaCertificar: undefined, tardios: null }];
    expect(armarPendientes({ personas: [], mes: "2026-10", hoy, grupos: {}, certificaciones: cert })).toEqual([]);
  });

  it("armarParaHacer y ultimosMovimientos toleran entradas ausentes", () => {
    expect(armarParaHacer({ pendientes: undefined, proximos: undefined, personas: undefined, hoy })).toEqual({ hoy: [], semana: [] });
    expect(ultimosMovimientos(undefined, null)).toEqual([]);
  });
});

describe("normalizarResumen / normalizarPanorama", () => {
  it("una respuesta vacía o rara da null; una incompleta se completa", () => {
    expect(normalizarResumen(null)).toBeNull();
    expect(normalizarResumen("x")).toBeNull();
    expect(normalizarResumen([])).toBeNull();
    expect(normalizarPanorama(undefined)).toBeNull();
    const r = normalizarResumen({ mes: "2026-10" });
    expect(r.proximos).toEqual([]);
    expect(r.gastos).toEqual([]);
    expect(r.movimientos).toEqual([]);
    expect(r.certificaciones).toBeNull();
    expect(r.gastosPorPagar).toEqual({ items: [], total: 0, conMonto: 0, sinMonto: 0 });
    const p = normalizarPanorama({ cobros: "nada", gastos: null });
    expect(p).toMatchObject({ cobros: [], gastos: [], pagos: [], diarios: null });
  });

  it("completa las listas de las certificaciones", () => {
    const r = normalizarResumen({ certificaciones: [{ id: 1 }, null, 5] });
    expect(r.certificaciones).toEqual([{ id: 1, modulosListos: [], listosParaCertificar: [] }]);
  });

  it("lista() siempre devuelve una lista", () => {
    expect(lista(undefined)).toEqual([]);
    expect(lista({})).toEqual([]);
    expect(lista([1])).toEqual([1]);
  });
});

describe("calcularInicio", () => {
  it("con la base vacía todo da ceros y listas vacías", () => {
    const r = calcularInicio(base);
    expect(r.estado.personas).toBe(0);
    expect(r.estado.esperado).toBe(0);
    expect(r.tasa).toBeNull();
    expect(r.serie).toHaveLength(6);
    expect(r.serie.every((s) => s.cobrado === 0 && s.gastado === 0)).toBe(true);
    expect(r.porMetodo).toEqual([]);
    expect(r.porGrupo).toEqual([]);
    expect(r.debe).toEqual({ total: 0, items: [] });
    expect(r.prox.hayAlgo).toBe(false);
    expect(r.proy.cierre).toBe(0);
    expect(r.distSesiones).toEqual(Array(11).fill(0));
  });

  it("con respuestas con campos faltantes o de otra forma no se rompe", () => {
    const panorama = { cobros: "x", gastos: { a: 1 }, pagos: 5, diarios: { cobros: null } };
    const resumen = { gastosPorPagar: { items: "x" }, proximos: null };
    expect(() => calcularInicio({ ...base, panorama, resumen, categorias: undefined, personas: undefined, avance: undefined })).not.toThrow();
    expect(() => calcularInicio({ ...base, panorama: normalizarPanorama(panorama), resumen: normalizarResumen(resumen) })).not.toThrow();
  });

  it("filas de panorama rotas (sin mes o con totales no numéricos) cuentan como cero", () => {
    const panorama = normalizarPanorama({ cobros: [{}, { mes: null, total: "abc" }], gastos: [{ mes: "2026-10-01", ruta: undefined, total: "x" }] });
    expect(() => calcularInicio({ ...base, panorama })).not.toThrow();
  });

  it("un cliente de monto extremo no rompe los cálculos", () => {
    const personas = [
      { id: 1, tipo: "alumno", nombre: "TEST Grande", monto_mensual: 1e15, dia_vencimiento: 1, cuota_actual: null, meses_adeudados: 3 },
      { id: 2, tipo: "jugador", nombre: "TEST Chico", monto_mensual: 20, dia_vencimiento: 31, cuota_actual: null, meses_adeudados: 0 },
    ];
    const r = calcularInicio({ ...base, personas });
    expect(Number.isFinite(r.estado.esperado)).toBe(true);
    expect(r.debe.total).toBeGreaterThan(0);
  });

  it("conRespaldo devuelve el valor por defecto si la cuenta falla", () => {
    const aviso = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      conRespaldo(
        "prueba",
        () => {
          throw new TypeError("e is not iterable");
        },
        []
      )
    ).toEqual([]);
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });
});

describe("fraseGastosPorPagar", () => {
  const item = (monto) => ({ id: String(Math.random()), nombre: "x", monto });
  it("sin gastos por pagar", () => {
    expect(fraseGastosPorPagar({ items: [], total: 0, conMonto: 0, sinMonto: 0 }).texto).toBe(" y no tenés gastos por pagar este mes");
    expect(fraseGastosPorPagar(undefined)).toEqual({ texto: "", sinMonto: 0 });
  });
  it("con monto y algunos sin monto lo aclara", () => {
    const r = fraseGastosPorPagar({ items: [item(10), item(null), item(null)], total: 10, conMonto: 1, sinMonto: 2 });
    expect(r.texto).toMatch(/de gastos por pagar este mes, y 2 gastos sin monto cargado$/);
    expect(r.sinMonto).toBe(2);
    expect(fraseGastosPorPagar({ items: [item(10), item(null)], total: 10, conMonto: 1, sinMonto: 1 }).texto).toContain("1 gasto sin monto cargado");
  });
  it("todos sin monto", () => {
    const r = fraseGastosPorPagar({ items: [item(null), item(null)], total: 0, conMonto: 0, sinMonto: 2 });
    expect(r.texto).toBe(" y tenés 2 gastos por pagar este mes, sin monto cargado");
    expect(r.sinMonto).toBe(2);
  });
  it("todo con monto no ofrece cargar nada", () => {
    expect(fraseGastosPorPagar({ items: [item(5)], total: 5, conMonto: 1, sinMonto: 0 }).sinMonto).toBe(0);
  });
});

describe("recorteDeValores (valores extremos en los gráficos)", () => {
  it("un valor que supera 4 veces la mediana del resto se corta", () => {
    const r = recorteDeValores([100, 120, 90, 110, 1_000_000]);
    expect(r.hayCortes).toBe(true);
    expect(r.cortado(1_000_000)).toBe(true);
    expect(r.cortado(120)).toBe(false);
    expect(r.tope).toBeCloseTo(120 * 1.25);
    expect(valorDibujado(1_000_000, r)).toBe(r.tope);
    expect(valorDibujado(-1_000_000, r)).toBe(-r.tope);
    expect(valorDibujado(90, r)).toBe(90);
  });
  it("sin extremos no se corta nada", () => {
    const r = recorteDeValores([100, 150, 90, 200]);
    expect(r.hayCortes).toBe(false);
    expect(r.tope).toBeNull();
    expect(valorDibujado(200, r)).toBe(200);
  });
  it("el límite es 4 veces la mediana: justo en 4 no se corta", () => {
    expect(recorteDeValores([10, 10, 10, 40]).hayCortes).toBe(false);
    expect(recorteDeValores([10, 10, 10, 41]).hayCortes).toBe(true);
  });
  it("con un solo valor distinto de cero o todo en cero no hay con qué comparar", () => {
    expect(recorteDeValores([0, 0, 5000, 0]).hayCortes).toBe(false);
    expect(recorteDeValores([0, 0, 0]).hayCortes).toBe(false);
    expect(recorteDeValores([]).hayCortes).toBe(false);
    expect(recorteDeValores(undefined).hayCortes).toBe(false);
  });
  it("tolera valores no numéricos", () => {
    expect(() => recorteDeValores([NaN, "x", null, 5, 6, 7000])).not.toThrow();
  });
  it("los negativos extremos también se cortan", () => {
    const r = recorteDeValores([100, -90, 110, -5_000_000]);
    expect(r.cortado(-5_000_000)).toBe(true);
  });
});

describe("vistas de Inicio", () => {
  it("solo acepta hoy y analisis", () => {
    expect(vistaValida("hoy")).toBe("hoy");
    expect(vistaValida("analisis")).toBe("analisis");
    expect(vistaValida("otra")).toBeNull();
    expect(vistaValida(null)).toBeNull();
  });
});
