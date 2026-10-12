import { describe, expect, it } from "vitest";
import { NAV, NAV_MENU, entradaActiva, aplanarEnlaces, ancestrosDe, armarNav, esActivo, normalizar, nodosDeGastos, profundidad, tituloDe } from "./navegacion";

const CON_GASTOS = [
  ...NAV,
  {
    id: "gastos",
    etiqueta: "Gastos",
    seccion: true,
    items: [
      { id: "fijos", etiqueta: "Gastos fijos", hijos: [{ id: "wifi", etiqueta: "Wifi", href: "/gastos/wifi" }] },
      {
        id: "variables",
        etiqueta: "Gastos variables",
        hijos: [
          {
            id: "marketing",
            etiqueta: "Equipo de marketing",
            hijos: [{ id: "consultora", etiqueta: "Consultora", href: "/gastos/consultora" }],
          },
        ],
      },
    ],
  },
];

describe("navegacion", () => {
  it("aplana los enlaces con el rótulo de su sección", () => {
    const e = aplanarEnlaces();
    expect(e.map((x) => x.href)).toEqual([
      "/",
      "/cobros",
      "/certificacion",
      "/recordatorios",
    ]);
    expect(e.find((x) => x.href === "/cobros").grupo).toBe("Cobros");
  });

  it("'/' solo es activo en '/'; el resto también en sus subrutas", () => {
    expect(esActivo("/", "/")).toBe(true);
    expect(esActivo("/", "/cobros")).toBe(false);
    expect(esActivo("/cobros", "/cobros")).toBe(true);
    expect(esActivo("/cobros", "/cobros/x")).toBe(true);
    expect(esActivo("/cobros", "/cobrosx")).toBe(false);
  });

  it("título por ruta, con extras y valor por defecto", () => {
    expect(tituloDe("/")).toBe("Inicio");
    expect(tituloDe("/cobros")).toBe("Cobros");
    expect(tituloDe("/errores")).toBe("Errores del sistema");
    expect(tituloDe("/no-existe")).toBe("Contabilidad");
  });

  it("soporta desplegables de hasta 3 niveles y abre los ancestros del activo", () => {
    expect(profundidad(NAV)).toBe(1);
    expect(profundidad(CON_GASTOS)).toBe(3);
    expect(ancestrosDe("/gastos/consultora", CON_GASTOS)).toEqual(["variables", "marketing"]);
    expect(ancestrosDe("/gastos/wifi", CON_GASTOS)).toEqual(["fijos"]);
    expect(ancestrosDe("/cobros", CON_GASTOS)).toEqual([]);
  });

  it("un enlace exacto no está activo en las rutas que cuelgan de él", () => {
    expect(esActivo("/gastos", "/gastos/abc")).toBe(true);
    expect(esActivo("/gastos", "/gastos/abc", true)).toBe(false);
    expect(esActivo("/gastos", "/gastos", true)).toBe(true);
  });

  it("sección Certificación: título de cada pantalla, también en las fichas", () => {
    // Una sola pantalla: las direcciones viejas llevan el mismo título.
    expect(tituloDe("/certificacion")).toBe("Certificación");
    expect(tituloDe("/certificacion/modulos/abc")).toBe("Certificación");
    expect(tituloDe("/certificacion/alumnos/abc")).toBe("Certificación");
    expect(tituloDe("/certificacion/equipo")).toBe("Certificación");
  });

  it("normaliza sin tildes ni mayúsculas", () => {
    expect(normalizar("  María Ñandú ")).toBe("maria nandu");
  });
});

describe("sección Gastos desde la base", () => {
  const cat = (id, nombre, parent_id = null, extra = {}) => ({
    id,
    nombre,
    parent_id,
    orden: 0,
    recurrencia: "ninguna",
    activo: true,
    ...extra,
  });
  const categorias = [
    cat("fijos", "Gastos fijos"),
    cat("wifi", "Wifi", "fijos", { orden: 1 }),
    cat("zoom", "Zoom", "fijos", { orden: 2 }),
    cat("variables", "Gastos variables", null, { orden: 1 }),
    cat("mkt", "Equipo de marketing", "variables"),
    cat("consultora", "Consultora de marketing", "mkt"),
    cat("viejo", "Viejo", "fijos", { orden: 3, activo: false }),
  ];
  const avisos = [
    { id: "wifi", nombre: "Wifi", estado: "pendiente", vencimiento: "2026-10-10" },
    { id: "zoom", nombre: "Zoom", estado: "vencido", vencimiento: "2026-07-31" },
  ];

  it("arma el árbol con grupos que también son enlaces y deja afuera lo desactivado", () => {
    const nodos = nodosDeGastos(categorias, []);
    expect(nodos.map((n) => n.etiqueta)).toEqual(["Gastos fijos", "Gastos variables"]);
    expect(nodos[0].href).toBe("/gastos/fijos");
    expect(nodos[0].hijos.map((n) => n.etiqueta)).toEqual(["Wifi", "Zoom"]);
    expect(nodos[1].hijos[0].hijos[0].href).toBe("/gastos/consultora");
  });

  it("el indicador sube de la subcategoría al grupo, con el tono más urgente", () => {
    const [fijos] = nodosDeGastos(categorias, avisos);
    expect(fijos.aviso.tono).toBe("vencido");
    expect(fijos.aviso.texto).toBe("Wifi vence el 10 de octubre. Zoom venció el 31 de julio");
    expect(fijos.hijos[0].aviso).toEqual({ tono: "proximo", texto: "Wifi vence el 10 de octubre" });
    expect(nodosDeGastos(categorias, [])[0].aviso).toBeNull();
  });

  it("la sección va después de Cobros, con 'Todos los pagos' y 'Mis gastos'", () => {
    const nav = armarNav(categorias, avisos);
    expect(nav.map((n) => n.id)).toEqual(["inicio", "cobros", "gastos", "certificacion", "agenda"]);
    const enlaces = aplanarEnlaces(nav);
    expect(enlaces.find((e) => e.id === "gasto-consultora").camino).toBe("Gastos variables › Equipo de marketing");
    expect(profundidad(nav)).toBe(3);
  });

  it("título y ancestros de una categoría; 'Todos los pagos' no se activa en una categoría", () => {
    const nav = armarNav(categorias, avisos);
    expect(tituloDe("/gastos/consultora", nav)).toBe("Consultora de marketing");
    expect(tituloDe("/gastos/fijos", nav)).toBe("Gastos fijos");
    expect(tituloDe("/gastos", nav)).toBe("Gastos");
    expect(tituloDe("/gastos/pagos", nav)).toBe("Todos los pagos");
    expect(tituloDe("/gastos/mis-gastos", nav)).toBe("Mis gastos");
    // la dirección vieja sigue respondiendo y se llama igual
    expect(tituloDe("/gastos/categorias", nav)).toBe("Mis gastos");
    expect(ancestrosDe("/gastos/consultora", nav)).toEqual(["gasto-variables", "gasto-mkt"]);
    expect(ancestrosDe("/gastos", nav)).toEqual([]);
  });
});

describe("menú de cinco entradas", () => {
  const activa = (ruta) => NAV_MENU.filter((e) => entradaActiva(e, ruta)).map((e) => e.id);

  it("tiene Inicio, Cobros, Gastos, Certificación y Recordatorios", () => {
    expect(NAV_MENU.map((e) => e.etiqueta)).toEqual(["Inicio", "Cobros", "Gastos", "Certificación", "Recordatorios"]);
  });

  it("marca una sola entrada y las subpantallas marcan a su entrada madre", () => {
    expect(activa("/")).toEqual(["inicio"]);
    expect(activa("/cobros")).toEqual(["cobros"]);
    expect(activa("/jugadores")).toEqual(["cobros"]);
    expect(activa("/alumnos")).toEqual(["cobros"]);
    expect(activa("/gastos")).toEqual(["gastos"]);
    expect(activa("/gastos/categorias")).toEqual(["gastos"]);
    expect(activa("/gastos/abc-123")).toEqual(["gastos"]);
    expect(activa("/certificacion/modulos/x")).toEqual(["certificacion"]);
    expect(activa("/certificacion/equipo")).toEqual(["certificacion"]);
    expect(activa("/recordatorios")).toEqual(["recordatorios"]);
    expect(activa("/configuracion")).toEqual([]);
  });
});
