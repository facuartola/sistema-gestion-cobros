import { describe, expect, it } from "vitest";
import { armarGrupos, contarTarjetas, filtrarGrupos, tarjetaDe } from "./gastosTarjetas";

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
  clave: null,
  created_at: null,
  ...extra,
});
const sinEspacios = (t) => t.replace(/ /g, " ");

const HOY = "2026-10-05";

describe("tarjetaDe", () => {
  it("mensual con monto: vence el N, monto y botón Pagué", () => {
    const t = tarjetaDe(cat("w", "Wifi", "f", { recurrencia: "mensual", dia_vencimiento: 10, monto_estimado: 45 }), [], HOY);
    expect(sinEspacios(t.texto)).toBe("Vence el 10 · US$ 45");
    expect(t).toMatchObject({ accion: "pagar", etiqueta: "Pagué", rango: 1, periodo: "2026-10-01" });
  });

  it("mensual sin monto: abre la ventana", () => {
    const t = tarjetaDe(cat("c", "Celulares", "f", { recurrencia: "mensual", dia_vencimiento: 10 }), [], HOY);
    expect(t).toMatchObject({ texto: "Vence el 10", accion: "registrar", etiqueta: "Registrar pago" });
  });

  it("mensual vencido y pagado", () => {
    const c = cat("w", "Wifi", "f", { recurrencia: "mensual", dia_vencimiento: 3, monto_estimado: 45 });
    expect(tarjetaDe(c, [], HOY)).toMatchObject({ rango: 0, tono: "warn" });
    expect(tarjetaDe(c, [], HOY).texto).toMatch(/^Venció el 3/);
    const pagada = tarjetaDe(c, [{ categoria_id: "w", fecha_pago: "2026-10-02", periodo: "2026-10-01", monto: 45 }], HOY);
    expect(pagada).toMatchObject({ texto: "Al día este mes", accion: null });
  });

  it("un vencimiento anterior a la creación del tipo no cuenta como vencido", () => {
    const c = cat("w", "Wifi", "f", { recurrencia: "mensual", dia_vencimiento: 3, created_at: "2026-10-04T12:00:00Z" });
    const t = tarjetaDe(c, [], HOY);
    expect(t.rango).toBe(2);
    expect(t.texto).toMatch(/^Próximo vencimiento: 3 de noviembre/);
  });

  it("anual: se renueva en el mes, o al día", () => {
    const c = cat("z", "Zoom", "f", { recurrencia: "anual", mes_vencimiento: 7, dia_vencimiento: 15 });
    expect(tarjetaDe(c, [], "2026-03-01").texto).toBe("Se renueva en julio");
    const pagada = tarjetaDe(c, [{ categoria_id: "z", fecha_pago: "2026-02-01", periodo: "2026-01-01", monto: 100 }], "2026-03-01");
    expect(pagada.texto).toBe("Al día");
  });

  it("anual creado después de su vencimiento avisa recién el año que viene", () => {
    const c = cat("z", "Zoom", "f", { recurrencia: "anual", mes_vencimiento: 7, dia_vencimiento: 15, created_at: "2026-09-01T00:00:00Z" });
    const t = tarjetaDe(c, [], HOY);
    expect(t.texto).toBe("Se renueva en julio de 2027");
    expect(t.rango).toBe(2);
  });

  it("sin repetición: último pago o sin pagos", () => {
    const c = cat("m", "Mantenimiento", "a");
    expect(tarjetaDe(c, [], HOY)).toMatchObject({ texto: "Sin pagos todavía", accion: "registrar", etiqueta: "Registrar pago" });
    const t = tarjetaDe(c, [{ categoria_id: "m", fecha_pago: "2026-09-20", monto: 100 }], HOY);
    expect(sinEspacios(t.texto)).toBe("Último pago: 20/09/2026 · US$ 100");
  });
});

describe("armarGrupos", () => {
  const categorias = [
    cat("fijos", "Gastos fijos"),
    cat("wifi", "Wifi", "fijos", { recurrencia: "mensual", dia_vencimiento: 20, monto_estimado: 45, orden: 1 }),
    cat("cel", "Celulares", "fijos", { recurrencia: "mensual", dia_vencimiento: 3, orden: 2 }),
    cat("var", "Gastos variables", null, { orden: 1 }),
    cat("mkt", "Equipo de marketing", "var"),
    cat("cons", "Consultora", "mkt"),
    cat("coach", "Equipo de coaches", "var", { orden: 2 }),
    cat("ses", "Pago de sesiones", "coach", { clave: "pago_sesiones" }),
    cat("enc", "Pago de encuentros", "coach", { clave: "pago_encuentros" }),
    cat("vieja", "Vieja", "var", { activo: false }),
  ];
  const grupos = armarGrupos({ categorias, pagos: [], hoy: HOY });

  it("lo vencido va primero, dentro del grupo", () => {
    const fijos = grupos.find((g) => g.id === "fijos");
    expect(fijos.items.map((i) => i.id)).toEqual(["cel", "wifi"]);
    expect(fijos.rango).toBe(0);
  });

  it("el grupo con algo vencido va antes que los demás", () => {
    expect(grupos[0].id).toBe("fijos");
  });

  it("respeta hasta 3 niveles y deja afuera lo inactivo", () => {
    const variables = grupos.find((g) => g.id === "var");
    const marketing = variables.items.find((i) => i.id === "mkt");
    expect(marketing.tipo).toBe("grupo");
    expect(marketing.items.map((i) => i.id)).toEqual(["cons"]);
    expect(JSON.stringify(grupos)).not.toContain("vieja");
  });

  it("el equipo de coaches es una sola tarjeta, detectada por la clave", () => {
    const variables = grupos.find((g) => g.id === "var");
    const coaches = variables.items.find((i) => i.id === "coach");
    expect(coaches.items).toHaveLength(1);
    expect(coaches.items[0]).toMatchObject({ tipo: "equipo", nombre: "Pagos al equipo", historialId: "coach" });
    expect(contarTarjetas(coaches)).toBe(1);
  });

  it("un tipo suelto en la raíz queda en un grupo sin título", () => {
    const g = armarGrupos({ categorias: [cat("x", "Suelto")], pagos: [], hoy: HOY });
    expect(g[0]).toMatchObject({ sinTitulo: true });
    expect(g[0].items[0].id).toBe("x");
  });
});

describe("filtrarGrupos", () => {
  const categorias = [
    cat("fijos", "Gastos fijos"),
    cat("wifi", "Wifi", "fijos", { recurrencia: "mensual" }),
    cat("zoom", "Zoom", "fijos", { recurrencia: "anual", mes_vencimiento: 7 }),
    cat("var", "Gastos variables"),
    cat("mant", "Mantenimiento", "var"),
  ];
  const grupos = armarGrupos({ categorias, pagos: [], hoy: HOY });

  it("sin texto devuelve todo", () => {
    expect(filtrarGrupos(grupos, "  ")).toBe(grupos);
  });
  it("busca por nombre sin tildes ni mayúsculas", () => {
    const r = filtrarGrupos(grupos, "MANTENIMIENTO");
    expect(r).toHaveLength(1);
    expect(r[0].items.map((i) => i.id)).toEqual(["mant"]);
  });
  it("el nombre de un grupo trae todo lo suyo", () => {
    const r = filtrarGrupos(grupos, "fijos");
    expect(contarTarjetas(r[0])).toBe(2);
  });
  it("sin coincidencias, vacío", () => {
    expect(filtrarGrupos(grupos, "xyz")).toEqual([]);
  });
});
