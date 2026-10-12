import { describe, expect, it } from "vitest";
import { generarDatosDemo } from "./demoData";
import { cuotaAtrasada } from "./fechas";

describe("generarDatosDemo", () => {
  it("genera 8 jugadores, 6 alumnos (todos activos) y 6 recordatorios", () => {
    const { jugadores, alumnos, recordatorios } = generarDatosDemo("2026-09-15");
    expect(jugadores).toHaveLength(8);
    expect(alumnos).toHaveLength(6);
    expect(recordatorios).toHaveLength(6);
    expect(jugadores.every((j) => j.activo)).toBe(true);
    expect(alumnos.every((a) => a.activo)).toBe(true);
  });

  it.each(["2026-09-15", "2026-09-28", "2026-02-05"])(
    "siempre hay al menos un atrasado y un vencimiento próximo (fecha: %s)",
    (fecha) => {
      const { jugadores, alumnos } = generarDatosDemo(fecha);
      const mesActual = fecha.slice(0, 7);
      const diaHoy = Number(fecha.slice(8, 10));
      const ahora = new Date(`${fecha}T15:00:00`);
      const personas = [...jugadores, ...alumnos];

      const atrasados = personas.filter(
        (p) => p.cuota_actual.estado === "pendiente" && cuotaAtrasada(mesActual, p.dia_vencimiento, ahora)
      );
      expect(atrasados.length).toBeGreaterThan(0);

      const proximos = personas.filter((p) => {
        if (p.cuota_actual.estado === "pagado" || !p.dia_vencimiento) return false;
        const dias = p.dia_vencimiento - diaHoy;
        return dias >= 0 && dias <= 3;
      });
      expect(proximos.length).toBeGreaterThan(0);
    }
  );

  it("los alumnos con monto_total tienen un avance entre 0 y el total", () => {
    const { alumnos } = generarDatosDemo("2026-09-15");
    const conTotal = alumnos.filter((a) => a.monto_total != null);
    expect(conTotal.length).toBeGreaterThan(0);
    for (const a of conTotal) {
      expect(a.total_abonado).toBeGreaterThanOrEqual(0);
      expect(a.total_abonado).toBeLessThanOrEqual(a.monto_total);
    }
    // Al menos uno sin monto_total, para probar el caso "pago mensual sin techo".
    expect(alumnos.some((a) => a.monto_total == null)).toBe(true);
  });

  it("las fechas de los recordatorios son relativas a la fecha dada, no fijas", () => {
    const r1 = generarDatosDemo("2026-09-15").recordatorios;
    const r2 = generarDatosDemo("2026-11-01").recordatorios;
    for (const r of [...r1, ...r2]) {
      expect(r.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(r1.map((r) => r.fecha)).not.toEqual(r2.map((r) => r.fecha));
  });

  it("incluye recordatorios vencidos, de hoy, próximos y ya hechos", () => {
    const { recordatorios } = generarDatosDemo("2026-09-15");
    const hoy = "2026-09-15";
    expect(recordatorios.some((r) => !r.hecho && r.fecha < hoy)).toBe(true);
    expect(recordatorios.some((r) => !r.hecho && r.fecha === hoy)).toBe(true);
    expect(recordatorios.some((r) => !r.hecho && r.fecha > hoy)).toBe(true);
    expect(recordatorios.some((r) => r.hecho)).toBe(true);
  });
});
