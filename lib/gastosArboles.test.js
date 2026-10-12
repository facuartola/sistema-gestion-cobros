import { describe, expect, it } from "vitest";
import { estadoActual, gastosPorHacer, hojasActivas, textoRuta, indexar, carpetasPosibles, nombresDeRuta } from "./gastos";
import { gastosPorGrupo, grupoDeRuta, proximosDias } from "./panorama";
import { gastosPorPagar } from "./resumen";
import { armarCSV } from "./csv";

// Árboles de prueba. Cada tipo: id, nombre, parent_id, recurrencia, activo.
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const T = (nombre, parent_id = null, extra = {}) => ({
  id: id(),
  nombre,
  parent_id,
  orden: 1,
  recurrencia: "ninguna",
  monto_estimado: null,
  dia_vencimiento: null,
  mes_vencimiento: null,
  activo: true,
  clave: null,
  created_at: "2026-01-01T12:00:00.000Z",
  ...extra,
});

// Lo mismo que arma la vista gastos_mensuales_por_tipo: una fila por mes y tipo, con la ruta completa.
function vista(categorias, pagos) {
  const porId = indexar(categorias);
  const filas = new Map();
  for (const p of pagos) {
    const mes = `${p.fecha_pago.slice(0, 7)}-01`;
    const clave = `${mes}|${p.categoria_id}`;
    const f = filas.get(clave) || { mes, categoria_id: p.categoria_id, ruta: nombresDeRuta(p.categoria_id, porId).join(" > "), nivel: nombresDeRuta(p.categoria_id, porId).length, total: 0, cantidad: 0 };
    f.total += p.monto;
    f.cantidad += 1;
    filas.set(clave, f);
  }
  return [...filas.values()];
}
const pago = (categoria, monto, fecha = "2026-10-03") => ({ categoria_id: categoria.id, monto, fecha_pago: fecha, periodo: null });
const MESES = ["2026-10"];
const resumir = (grupos) => Object.fromEntries(grupos.map((g) => [g.nombre, g.total]));

describe("Gastos por tipo: regla de agrupamiento (la carpeta que contiene el tipo)", () => {
  it("árbol 1: tres niveles (carpeta > carpeta > tipo) y dos (carpeta > tipo)", () => {
    const fijos = T("Gastos fijos");
    const wifi = T("Wifi", fijos.id, { recurrencia: "mensual" });
    const tel = T("Teléfono", fijos.id, { recurrencia: "mensual" });
    const variables = T("Gastos variables");
    const mkt = T("Equipo de marketing", variables.id);
    const consultora = T("Consultora", mkt.id);
    const fotos = T("Fotos", mkt.id);
    const app = T("Mantenimiento app", variables.id, { recurrencia: "mensual" });
    const cats = [fijos, wifi, tel, variables, mkt, consultora, fotos, app];
    const pagos = [pago(wifi, 40), pago(tel, 20), pago(consultora, 300), pago(fotos, 100), pago(app, 80)];
    const filas = vista(cats, pagos);
    const esperado = { "Gastos fijos": 60, "Equipo de marketing": 400, "Gastos variables": 80 };
    expect(resumir(gastosPorGrupo(filas, MESES, 5, cats))).toEqual(esperado);
    // sin el árbol, solo con el texto de la ruta de la vista, da lo mismo
    expect(resumir(gastosPorGrupo(filas, MESES))).toEqual(esperado);
    const mktGrupo = gastosPorGrupo(filas, MESES, 5, cats).find((g) => g.nombre === "Equipo de marketing");
    expect(mktGrupo.detalle.map((d) => d.nombre)).toEqual(["Consultora", "Fotos"]);
  });

  it("árbol 2: todo en el primer nivel (profundidad 1), cada tipo suelto cuenta por su nombre", () => {
    const wifi = T("Wifi", null, { recurrencia: "mensual" });
    const tel = T("Teléfono", null, { recurrencia: "mensual" });
    const mkt = T("Marketing");
    const cats = [wifi, tel, mkt];
    const filas = vista(cats, [pago(wifi, 40), pago(tel, 20), pago(mkt, 500)]);
    const grupos = gastosPorGrupo(filas, MESES, 5, cats);
    expect(resumir(grupos)).toEqual({ Wifi: 40, "Teléfono": 20, Marketing: 500 });
    expect(grupos.map((g) => g.nombre)).toEqual(["Marketing", "Wifi", "Teléfono"]);
    expect(resumir(gastosPorGrupo(filas, MESES))).toEqual({ Wifi: 40, "Teléfono": 20, Marketing: 500 });
  });

  it("árbol 3: carpetas vacías, tipos desactivados con historial, carpetas con el mismo nombre y más de 5 grupos", () => {
    const fijos = T("Gastos fijos");
    const vacia = T("Carpeta vacía");
    const viejo = T("Servicio viejo", fijos.id, { recurrencia: "mensual", activo: false });
    const mktA = T("Marketing", fijos.id);
    const adsA = T("Anuncios", mktA.id);
    const variables = T("Gastos variables");
    const mktB = T("Marketing", variables.id);
    const adsB = T("Fotos", mktB.id);
    const sueltos = ["A", "B", "C", "D"].map((x) => T(`Suelto ${x}`));
    const cats = [fijos, vacia, viejo, mktA, adsA, variables, mktB, adsB, ...sueltos];
    const pagos = [pago(viejo, 25), pago(adsA, 100), pago(adsB, 200), ...sueltos.map((s, i) => pago(s, 10 + i))];
    const filas = vista(cats, pagos);
    const grupos = gastosPorGrupo(filas, MESES, 5, cats);
    // La carpeta vacía no aparece; el desactivado con historial suma en su carpeta.
    expect(grupos.some((g) => g.nombre === "Carpeta vacía")).toBe(false);
    const total = grupos.reduce((a, g) => a + g.total, 0);
    expect(total).toBe(25 + 100 + 200 + 10 + 11 + 12 + 13);
    // máximo 5 segmentos: el resto se junta en "Otros"
    expect(grupos).toHaveLength(5);
    expect(grupos.at(-1).nombre).toBe("Otros");
    // Con más lugar, las dos carpetas "Marketing" se distinguen por la carpeta de arriba.
    const todos = gastosPorGrupo(filas, MESES, 20, cats);
    const nombres = todos.map((g) => g.nombre);
    expect(nombres).toContain("Marketing (Gastos fijos)");
    expect(nombres).toContain("Marketing (Gastos variables)");
    expect(todos.find((g) => g.nombre === "Gastos fijos").total).toBe(25);
    expect(todos.find((g) => g.nombre === "Gastos fijos").detalle[0].nombre).toBe("Servicio viejo");
    // y no se pisan sus totales
    expect(todos.find((g) => g.nombre === "Marketing (Gastos fijos)").total).toBe(100);
    expect(todos.find((g) => g.nombre === "Marketing (Gastos variables)").total).toBe(200);
  });

  it("renombrar o mover un tipo con historial no pierde nada: todo su historial pasa al grupo nuevo", () => {
    const a = T("Carpeta A");
    const b = T("Carpeta B");
    const t = T("Tipo");
    const pagos = [pago(t, 10, "2026-09-05"), pago(t, 20, "2026-10-05")];
    const antes = [{ ...t, parent_id: a.id }, a, b];
    const despues = [{ ...t, nombre: "Tipo renombrado", parent_id: b.id }, a, b];
    const meses = ["2026-09", "2026-10"];
    expect(resumir(gastosPorGrupo(vista(antes, pagos), meses, 5, antes))).toEqual({ "Carpeta A": 30 });
    expect(resumir(gastosPorGrupo(vista(despues, pagos), meses, 5, despues))).toEqual({ "Carpeta B": 30 });
  });

  it("filas de un tipo que ya no está en el árbol caen al texto de la ruta; sin datos, lista vacía", () => {
    const filas = [{ mes: "2026-10-01", categoria_id: "x", ruta: "Gastos fijos > Wifi", nivel: 2, total: 5, cantidad: 1 }];
    expect(resumir(gastosPorGrupo(filas, MESES, 5, [T("Otro")]))).toEqual({ "Gastos fijos": 5 });
    expect(gastosPorGrupo(undefined, MESES, 5, undefined)).toEqual([]);
    expect(gastosPorGrupo([{ mes: "2026-10-01", total: "x" }], MESES)).toEqual([]);
  });

  it("grupoDeRuta con nombres que no tienen el separador", () => {
    expect(grupoDeRuta("A")).toBe("A");
    expect(grupoDeRuta("A > B")).toBe("A");
    expect(grupoDeRuta("A > B > C")).toBe("B");
    expect(grupoDeRuta("A > B > C > D")).toBe("C");
  });
});

describe('"¿Se repite?" decide, la carpeta solo ordena', () => {
  const hoy = "2026-10-06";
  it("un tipo mensual dentro de Gastos variables se comporta como fijo", () => {
    const variables = T("Gastos variables");
    const fijos = T("Gastos fijos");
    const contador = T("Contador", variables.id, { recurrencia: "mensual", dia_vencimiento: 10, monto_estimado: 100 });
    const cats = [variables, fijos, contador];
    // vence el 10: a 4 días, está en la lista de lo que hay que atender
    const hacer = gastosPorHacer({ categorias: cats, pagos: [], hoy });
    expect(hacer.map((g) => g.nombre)).toEqual(["Contador"]);
    expect(estadoActual(contador, [], hoy).estado).toBe("pendiente");
    expect(gastosPorPagar({ categorias: cats, pagos: [], hoy })).toMatchObject({ conMonto: 1, total: 100 });
    expect(proximosDias({ personas: [], categorias: cats, pagos: [], hoy }).totalGastos).toBe(100);
    // pagado: deja de aparecer
    const pagado = [{ categoria_id: contador.id, fecha_pago: "2026-10-05", periodo: "2026-10-01" }];
    expect(gastosPorHacer({ categorias: cats, pagos: pagado, hoy })).toEqual([]);
    expect(gastosPorPagar({ categorias: cats, pagos: pagado, hoy }).items).toEqual([]);
  });

  it("un tipo sin repetición dentro de Gastos fijos no vence", () => {
    const fijos = T("Gastos fijos");
    const reparacion = T("Reparaciones", fijos.id, { recurrencia: "ninguna", dia_vencimiento: 10 });
    const cats = [fijos, reparacion];
    expect(estadoActual(reparacion, [], hoy)).toBeNull();
    expect(gastosPorHacer({ categorias: cats, pagos: [], hoy })).toEqual([]);
    expect(gastosPorPagar({ categorias: cats, pagos: [], hoy }).items).toEqual([]);
    expect(proximosDias({ personas: [], categorias: cats, pagos: [], hoy }).hayAlgo).toBe(false);
  });

  it("el nombre de la carpeta no cambia nada: el mismo tipo da lo mismo en cualquier carpeta", () => {
    const cuenta = (padreNombre) => {
      const carpeta = T(padreNombre);
      const tipo = T("Alquiler", carpeta.id, { recurrencia: "mensual", dia_vencimiento: 8 });
      return gastosPorHacer({ categorias: [carpeta, tipo], pagos: [], hoy }).map((g) => [g.nombre, g.vencimiento, g.estado]);
    };
    expect(cuenta("Gastos fijos")).toEqual(cuenta("Gastos variables"));
    expect(cuenta("Cualquier cosa")).toEqual(cuenta("Gastos fijos"));
  });
});

describe("tipos desactivados", () => {
  const hoy = "2026-10-06";
  it("desaparecen de selectores, avisos y por pagar; su historial sigue en los totales", () => {
    const carpeta = T("Fijos");
    const activo = T("Wifi", carpeta.id, { recurrencia: "mensual", dia_vencimiento: 9 });
    const apagado = T("Zoom viejo", carpeta.id, { recurrencia: "mensual", dia_vencimiento: 9, activo: false });
    const cats = [carpeta, activo, apagado];
    expect(hojasActivas(cats).map((c) => c.nombre)).toEqual(["Wifi"]);
    expect(gastosPorHacer({ categorias: cats, pagos: [], hoy }).map((g) => g.nombre)).toEqual(["Wifi"]);
    expect(gastosPorPagar({ categorias: cats, pagos: [], hoy }).items.map((i) => i.nombre)).toEqual(["Wifi"]);
    expect(proximosDias({ personas: [], categorias: cats.filter((c) => c.activo), pagos: [], hoy }).semanas.reduce((a, s) => a + s.nGastos, 0)).toBe(1);
    const filas = vista(cats, [pago(apagado, 70, "2026-09-02")]);
    expect(gastosPorGrupo(filas, ["2026-09"], 5, cats)[0]).toMatchObject({ nombre: "Fijos", total: 70 });
  });

  it("los pagos de un tipo desactivado siguen saliendo en el CSV", () => {
    const t = T("Zoom viejo", null, { activo: false });
    const porId = indexar([t]);
    const csv = armarCSV(
      [{ categoria_nombre: t.nombre, ruta: textoRuta(t.id, porId), fecha_pago: "2026-09-02", monto: 70 }],
      [
        { label: "Tipo", value: (f) => f.ruta },
        { label: "Monto", value: (f) => f.monto },
      ]
    );
    expect(csv).toContain("Zoom viejo");
    expect(csv).toContain("70");
  });
});

describe("carpetas donde se puede dejar un tipo", () => {
  it("excluye los que se repiten, los desactivados, los del sistema, a sí mismo y a lo que tiene adentro; respeta los 3 niveles", () => {
    const a = T("A");
    const b = T("B", a.id);
    const c = T("C", b.id); // nivel 3: no admite nada adentro
    const otra = T("Otra");
    const wifi = T("Wifi", null, { recurrencia: "mensual" });
    const apagada = T("Apagada", null, { activo: false });
    const sistema = T("Pago de sesiones", null, { clave: "pago_sesiones" });
    const cats = [a, b, c, otra, wifi, apagada, sistema];
    // un tipo nuevo (altura 1): puede ir en A, B, Otra (no en C: quedaría en el nivel 4)
    expect(carpetasPosibles(null, cats).map((x) => x.texto)).toEqual(["A", "A › B", "Otra"]);
    // B (con C adentro, altura 2): puede quedar en A (donde ya está) o en Otra; no en sí misma ni en C
    expect(carpetasPosibles(b, cats).map((x) => x.texto)).toEqual(["A", "Otra"]);
    // Otra (altura 1): puede ir en A o en B
    expect(carpetasPosibles(otra, cats).map((x) => x.texto)).toEqual(["A", "A › B"]);
  });
});
