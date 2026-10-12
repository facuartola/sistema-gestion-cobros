import { describe, expect, it } from "vitest";
import {
  alturaDelSubarbol,
  armarArbol,
  estadoActual,
  gastosPorHacer,
  hojasActivas,
  idsDelGrupo,
  indexar,
  periodoDe,
  periodosElegibles,
  textoRuta,
  totalesDePagos,
  vencimientoDelPeriodo,
} from "./gastos";

const cat = (id, nombre, parent_id = null, extra = {}) => ({
  id,
  nombre,
  parent_id,
  orden: 0,
  recurrencia: "ninguna",
  monto_estimado: null,
  dia_vencimiento: null,
  mes_vencimiento: null,
  activo: true,
  ...extra,
});

const wifi = cat("wifi", "Wifi", "fijos", { recurrencia: "mensual", dia_vencimiento: 10 });
const zoom = cat("zoom", "Zoom", "fijos", { recurrencia: "anual", mes_vencimiento: 7 });
const mant = cat("mant", "Mantenimiento", "app", { recurrencia: "mensual", monto_estimado: 100 });

describe("vencimientos", () => {
  it("mensual: vence el día cargado del mes del período", () => {
    expect(vencimientoDelPeriodo(wifi, "2026-10-01")).toBe("2026-10-10");
  });

  it("mensual con día 31 en un mes corto vence el último día", () => {
    const c = { ...wifi, dia_vencimiento: 31 };
    expect(vencimientoDelPeriodo(c, "2026-04-01")).toBe("2026-04-30");
    expect(vencimientoDelPeriodo(c, "2027-02-01")).toBe("2027-02-28");
    expect(vencimientoDelPeriodo(c, "2028-02-01")).toBe("2028-02-29");
  });

  it("mensual sin día cargado vence a fin de mes", () => {
    expect(vencimientoDelPeriodo(mant, "2026-10-01")).toBe("2026-10-31");
    expect(vencimientoDelPeriodo(mant, "2026-11-01")).toBe("2026-11-30");
  });

  it("anual: vence en el mes de vencimiento del año del período (julio)", () => {
    expect(vencimientoDelPeriodo(zoom, "2026-01-01")).toBe("2026-07-31");
    expect(vencimientoDelPeriodo({ ...zoom, dia_vencimiento: 15 }, "2026-01-01")).toBe("2026-07-15");
  });

  it("el período es el mes o el año de la fecha", () => {
    expect(periodoDe(wifi, "2026-10-04")).toBe("2026-10-01");
    expect(periodoDe(zoom, "2026-10-04")).toBe("2026-01-01");
    expect(periodoDe(cat("x", "X"), "2026-10-04")).toBeNull();
  });
});

describe("estado del período actual", () => {
  it("mensual sin pago antes del vencimiento: pendiente; el propio día todavía en fecha", () => {
    expect(estadoActual(wifi, [], "2026-10-04").estado).toBe("pendiente");
    expect(estadoActual(wifi, [], "2026-10-10").estado).toBe("pendiente");
  });

  it("mensual sin pago pasado el vencimiento: vencido", () => {
    expect(estadoActual(wifi, [], "2026-10-11").estado).toBe("vencido");
  });

  it("un pago del período lo deja pagado, aunque sea de otra fecha", () => {
    const pagos = [{ categoria_id: "wifi", fecha_pago: "2026-10-02", periodo: "2026-10-01" }];
    expect(estadoActual(wifi, pagos, "2026-10-20").estado).toBe("pagado");
    const delMesPasado = [{ categoria_id: "wifi", fecha_pago: "2026-10-02", periodo: "2026-09-01" }];
    expect(estadoActual(wifi, delMesPasado, "2026-10-04").estado).toBe("pendiente");
  });

  it("un pago suelto sin período cuenta para el mes de su fecha", () => {
    const pagos = [{ categoria_id: "wifi", fecha_pago: "2026-10-03", periodo: null }];
    expect(estadoActual(wifi, pagos, "2026-10-04").estado).toBe("pagado");
  });

  it("un pago de otra categoría no cuenta", () => {
    const pagos = [{ categoria_id: "celu", fecha_pago: "2026-10-03", periodo: "2026-10-01" }];
    expect(estadoActual(wifi, pagos, "2026-10-04").estado).toBe("pendiente");
  });

  it("anual sin pago: pendiente hasta julio y vencido después", () => {
    expect(estadoActual(zoom, [], "2026-03-01").estado).toBe("pendiente");
    expect(estadoActual(zoom, [], "2026-07-31").estado).toBe("pendiente");
    expect(estadoActual(zoom, [], "2026-08-01").estado).toBe("vencido");
    expect(estadoActual(zoom, [], "2026-10-04").estado).toBe("vencido");
  });

  it("anual pagado en el año: pagado todo el año, y el año siguiente vuelve a empezar", () => {
    const pagos = [{ categoria_id: "zoom", fecha_pago: "2026-07-05", periodo: "2026-01-01" }];
    expect(estadoActual(zoom, pagos, "2026-12-31").estado).toBe("pagado");
    expect(estadoActual(zoom, pagos, "2027-01-02").estado).toBe("pendiente");
  });

  it("sin recurrencia no hay estado", () => {
    expect(estadoActual(cat("x", "X"), [], "2026-10-04")).toBeNull();
  });
});

describe("gastosPorHacer", () => {
  const categorias = [
    cat("fijos", "Gastos fijos"),
    wifi,
    zoom,
    cat("celu", "Celulares", "fijos", { recurrencia: "mensual", dia_vencimiento: 10 }),
    cat("app", "App"),
    mant,
  ];

  it("el 4 de octubre: Wifi y Celulares (en 6 días) y Zoom vencido; Mantenimiento todavía no", () => {
    const items = gastosPorHacer({ categorias, pagos: [], hoy: "2026-10-04" });
    expect(items.map((i) => [i.nombre, i.estado, i.vencimiento])).toEqual([
      ["Zoom", "vencido", "2026-07-31"],
      ["Celulares", "pendiente", "2026-10-10"],
      ["Wifi", "pendiente", "2026-10-10"],
    ]);
    expect(items[2].ruta).toBe("Gastos fijos › Wifi");
  });

  it("un pago saca al gasto de la lista", () => {
    const pagos = [{ categoria_id: "wifi", fecha_pago: "2026-10-04", periodo: "2026-10-01" }];
    const nombres = gastosPorHacer({ categorias, pagos, hoy: "2026-10-04" }).map((i) => i.nombre);
    expect(nombres).not.toContain("Wifi");
  });

  it("el día del vencimiento figura como hoy y al día siguiente como vencido", () => {
    expect(gastosPorHacer({ categorias, pagos: [], hoy: "2026-10-10" }).find((i) => i.nombre === "Wifi").estado).toBe("hoy");
    expect(gastosPorHacer({ categorias, pagos: [], hoy: "2026-10-11" }).find((i) => i.nombre === "Wifi").estado).toBe("vencido");
  });

  it("a fin de mes entra Mantenimiento (vence el 31) y no los vencimientos de dentro de más de 7 días", () => {
    const items = gastosPorHacer({ categorias, pagos: [], hoy: "2026-10-28" });
    expect(items.find((i) => i.nombre === "Mantenimiento").vencimiento).toBe("2026-10-31");
    // El Wifi del 10 de noviembre queda fuera de la ventana (13 días); el de octubre está vencido.
    expect(items.filter((i) => i.nombre === "Wifi").map((i) => i.estado)).toEqual(["vencido"]);
    const finDeAnio = gastosPorHacer({ categorias: [wifi], pagos: [], hoy: "2026-12-31" });
    expect(finDeAnio.map((i) => i.periodo)).toEqual(["2026-12-01"]);
  });

  it("cruza el cambio de mes: un vencimiento del día 2 se ve desde el 26", () => {
    const temprano = { ...wifi, dia_vencimiento: 2 };
    const pagos = [{ categoria_id: "wifi", fecha_pago: "2026-10-01", periodo: "2026-10-01" }];
    const items = gastosPorHacer({ categorias: [temprano], pagos, hoy: "2026-10-27" });
    expect(items.map((i) => i.vencimiento)).toEqual(["2026-11-02"]);
    expect(gastosPorHacer({ categorias: [temprano], pagos, hoy: "2026-10-25" })).toEqual([]);
  });

  it("ignora las categorías desactivadas", () => {
    const inactivas = categorias.map((c) => (c.id === "wifi" ? { ...c, activo: false } : c));
    expect(gastosPorHacer({ categorias: inactivas, pagos: [], hoy: "2026-10-04" }).map((i) => i.nombre)).not.toContain("Wifi");
  });
});

describe("árbol", () => {
  const todas = [
    cat("v", "Gastos variables"),
    cat("m", "Equipo de marketing", "v"),
    cat("c", "Consultora de marketing", "m", { orden: 2 }),
    cat("p", "Producciones", "m", { orden: 1 }),
    cat("f", "Gastos fijos", null, { orden: -1 }),
  ];

  it("ordena por orden y anida con su nivel", () => {
    const arbol = armarArbol(todas);
    expect(arbol.map((n) => n.nombre)).toEqual(["Gastos fijos", "Gastos variables"]);
    const marketing = arbol[1].hijos[0];
    expect(marketing.nivel).toBe(2);
    expect(marketing.hijos.map((n) => [n.nombre, n.nivel])).toEqual([
      ["Producciones", 3],
      ["Consultora de marketing", 3],
    ]);
  });

  it("una categoría inactiva se lleva su rama", () => {
    const sinMarketing = todas.map((c) => (c.id === "m" ? { ...c, activo: false } : c));
    expect(armarArbol(sinMarketing, { soloActivas: true })[1].hijos).toEqual([]);
  });

  it("ruta completa, grupo con descendientes y altura", () => {
    expect(textoRuta("c", indexar(todas))).toBe("Gastos variables › Equipo de marketing › Consultora de marketing");
    expect(idsDelGrupo("m", todas).sort()).toEqual(["c", "m", "p"]);
    expect(alturaDelSubarbol("v", todas)).toBe(3);
    expect(alturaDelSubarbol("c", todas)).toBe(1);
  });

  it("las hojas activas son donde se registran los pagos", () => {
    expect(hojasActivas(todas).map((c) => c.id).sort()).toEqual(["c", "f", "p"]);
  });
});

describe("totales y períodos elegibles", () => {
  it("suma el mes y el año por fecha de pago", () => {
    const pagos = [
      { fecha_pago: "2026-10-02", monto: "45.50" },
      { fecha_pago: "2026-09-30", monto: 100 },
      { fecha_pago: "2025-10-02", monto: 999 },
    ];
    expect(totalesDePagos(pagos, "2026-10-04")).toEqual({ mes: 45.5, anio: 145.5 });
  });

  it("ofrece el período actual primero y los anteriores", () => {
    expect(periodosElegibles(wifi, "2026-02-10", 2)).toEqual(["2026-02-01", "2026-01-01", "2025-12-01"]);
    expect(periodosElegibles(zoom, "2026-10-10")).toEqual(["2026-01-01", "2025-01-01", "2024-01-01"]);
    expect(periodosElegibles(cat("x", "X"), "2026-10-10")).toEqual([]);
  });
});

describe("vencimientos anteriores a la creación de la categoría", () => {
  // Creada el 4 de octubre de 2026 (hora Argentina; en UTC ya es el 5).
  const creada = "2026-10-04T23:30:00-03:00";
  const wifiNueva = { ...wifi, created_at: creada };
  const zoomNuevo = { ...zoom, created_at: creada };
  const celu = { ...cat("celu", "Celulares", "fijos", { recurrencia: "mensual", dia_vencimiento: 10 }), created_at: creada };
  const hoy = "2026-10-04";

  it("anual: el julio anterior a la creación no está vencido ni avisa, y el siguiente sí", () => {
    expect(estadoActual(zoomNuevo, [], hoy).estado).toBe("anterior");
    expect(gastosPorHacer({ categorias: [zoomNuevo], pagos: [], hoy })).toEqual([]);
    expect(gastosPorHacer({ categorias: [zoomNuevo], pagos: [], hoy: "2027-07-28" }).map((i) => [i.vencimiento, i.estado])).toEqual([
      ["2027-07-31", "pendiente"],
    ]);
    expect(estadoActual(zoomNuevo, [], "2027-08-01").estado).toBe("vencido");
  });

  it("mensual: un vencimiento posterior a la creación avisa; uno anterior, no", () => {
    expect(gastosPorHacer({ categorias: [wifiNueva, celu], pagos: [], hoy }).map((i) => [i.nombre, i.vencimiento])).toEqual([
      ["Celulares", "2026-10-10"],
      ["Wifi", "2026-10-10"],
    ]);
    // Creada el 20 de octubre: el 10 de octubre es de antes del sistema.
    const tarde = { ...wifi, created_at: "2026-10-20T12:00:00-03:00" };
    expect(estadoActual(tarde, [], "2026-10-21").estado).toBe("anterior");
    expect(gastosPorHacer({ categorias: [tarde], pagos: [], hoy: "2026-10-21" })).toEqual([]);
    // El mes siguiente sí cuenta.
    expect(gastosPorHacer({ categorias: [tarde], pagos: [], hoy: "2026-11-05" }).map((i) => i.vencimiento)).toEqual(["2026-11-10"]);
  });

  it("el día de la creación todavía cuenta (igual o posterior)", () => {
    const mismoDia = { ...wifi, created_at: "2026-10-10T09:00:00-03:00" };
    expect(estadoActual(mismoDia, [], "2026-10-10").estado).toBe("pendiente");
    expect(estadoActual(mismoDia, [], "2026-10-11").estado).toBe("vencido");
  });

  it("un pago de un período anterior a la creación igual lo deja pagado", () => {
    const pagos = [{ categoria_id: "zoom", fecha_pago: "2026-07-05", periodo: "2026-01-01" }];
    expect(estadoActual(zoomNuevo, pagos, hoy).estado).toBe("pagado");
  });
});
