import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearGastosDemo } from "./gastosDemo";

async function idPorNombre(demo, nombre) {
  const { categorias } = await demo.listarCategoriasGasto();
  return categorias.find((c) => c.nombre === nombre).id;
}

describe("gastos de /demo (en memoria, con las reglas del servidor)", () => {
  // La demo usa fechas relativas a hoy: se fija el día para que los avisos no
  // dependan de cuándo se corra el test.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T15:00:00-03:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("arranca con el árbol de la base y avisos de vencimiento", async () => {
    const demo = crearGastosDemo();
    const { categorias, avisos } = await demo.listarCategoriasGasto();
    expect(categorias).toHaveLength(14);
    expect(categorias.find((c) => c.nombre === "Pago de sesiones").clave).toBe("pago_sesiones");
    expect(avisos.map((a) => a.nombre).sort()).toEqual(["Celulares", "Wifi"]);
  });

  it("un grupo muestra los pagos de sus subcategorías, con la ruta completa", async () => {
    const demo = crearGastosDemo();
    const marketing = await idPorNombre(demo, "Equipo de marketing");
    const { pagos, totales, estado } = await demo.listarPagosGasto({ categoria_id: marketing });
    expect(pagos.map((p) => p.ruta)).toContain("Gastos variables › Equipo de marketing › Consultora de marketing");
    expect(pagos.length).toBe(3);
    expect(totales.anio).toBeGreaterThan(0);
    expect(estado).toBeNull();
  });

  it("registrar el pago de un gasto fijo lo saca de los avisos", async () => {
    const demo = crearGastosDemo();
    const wifi = await idPorNombre(demo, "Wifi");
    await demo.crearPagoGasto({ categoria_id: wifi, monto: 45, metodo_pago: "efectivo" });
    const { avisos } = await demo.listarCategoriasGasto();
    expect(avisos.map((a) => a.nombre)).toEqual(["Celulares"]);
    expect((await demo.listarPagosGasto({ categoria_id: wifi })).estado.estado).toBe("pagado");
  });

  it("no deja registrar pagos en un grupo ni sin método", async () => {
    const demo = crearGastosDemo();
    const fijos = await idPorNombre(demo, "Gastos fijos");
    const wifi = await idPorNombre(demo, "Wifi");
    await expect(demo.crearPagoGasto({ categoria_id: fijos, monto: 10, metodo_pago: "efectivo" })).rejects.toThrow(/grupo/);
    await expect(demo.crearPagoGasto({ categoria_id: wifi, monto: 10 })).rejects.toThrow(/efectivo o transferencia/);
  });

  it("valida la profundidad máxima de 3 niveles", async () => {
    const demo = crearGastosDemo();
    const marketing = await idPorNombre(demo, "Equipo de marketing");
    const consultora = await idPorNombre(demo, "Consultora de marketing");
    const nueva = await demo.crearCategoriaGasto({ nombre: "Prueba", parent_id: marketing });
    expect(nueva.parent_id).toBe(marketing);
    await expect(demo.crearCategoriaGasto({ nombre: "Cuarto nivel", parent_id: consultora })).rejects.toThrow(/3 niveles/);
  });

  it("borrar con pagos explica que se puede desactivar; desactivar saca la rama del menú y de los avisos", async () => {
    const demo = crearGastosDemo();
    const wifi = await idPorNombre(demo, "Wifi");
    const fijos = await idPorNombre(demo, "Gastos fijos");
    await expect(demo.eliminarCategoriaGasto(wifi)).rejects.toThrow(/desactivala/);
    await demo.actualizarCategoriaGasto(fijos, { activo: false });
    const { categorias, avisos } = await demo.listarCategoriasGasto();
    expect(categorias.find((c) => c.id === wifi).activo).toBe(false);
    expect(avisos).toEqual([]);
  });

  it("las categorías de la liquidación se renombran pero no se desactivan ni se borran", async () => {
    const demo = crearGastosDemo();
    const sesiones = await idPorNombre(demo, "Pago de sesiones");
    const renombrada = await demo.actualizarCategoriaGasto(sesiones, { nombre: "Sesiones de coaching" });
    expect(renombrada.nombre).toBe("Sesiones de coaching");
    await expect(demo.actualizarCategoriaGasto(sesiones, { activo: false })).rejects.toThrow(/Pagar al equipo/);
    await expect(demo.eliminarCategoriaGasto(sesiones)).rejects.toThrow(/Pagar al equipo/);
  });

  it("eliminar un pago lo quita del historial", async () => {
    const demo = crearGastosDemo();
    const wifi = await idPorNombre(demo, "Wifi");
    const { pagos } = await demo.listarPagosGasto({ categoria_id: wifi });
    await demo.eliminarPagoGasto(pagos[0].id);
    expect((await demo.listarPagosGasto({ categoria_id: wifi })).pagos).toHaveLength(0);
  });
});
