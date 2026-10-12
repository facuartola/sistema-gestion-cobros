import { describe, expect, it } from "vitest";
import {
  COMPROBANTE,
  esRutaDeComprobante,
  parseMonto,
  puedeBorrarCategoria,
  rutaComprobante,
  tipoPorContenido,
  validarCategoriaEdicion,
  validarCategoriaNueva,
  validarComprobante,
  validarEdicionPagoLiquidacion,
  validarPago,
} from "./gastosValidacion";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const U3 = "33333333-3333-4333-8333-333333333333";
const U4 = "44444444-4444-4444-8444-444444444444";

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
  ...extra,
});

const raiz = cat(U1, "Gastos variables");
const medio = cat(U2, "Equipo de marketing", U1);
const hoja = cat(U3, "Consultora de marketing", U2);
const arbol = [raiz, medio, hoja];

describe("alta de categorías", () => {
  it("crea una raíz con recurrencia ninguna por defecto", () => {
    const { datos, error } = validarCategoriaNueva({ nombre: "  Impuestos  " }, arbol);
    expect(error).toBeUndefined();
    expect(datos).toMatchObject({ nombre: "Impuestos", parent_id: null, recurrencia: "ninguna", dia_vencimiento: null, mes_vencimiento: null });
  });

  it("acepta hasta el tercer nivel y rechaza el cuarto", () => {
    expect(validarCategoriaNueva({ nombre: "Hija", parent_id: U2 }, arbol).datos.parent_id).toBe(U2);
    const { error } = validarCategoriaNueva({ nombre: "Nieta", parent_id: U3 }, arbol);
    expect(error).toMatch(/hasta 3 niveles/);
  });

  it("rechaza un padre inexistente, mal formado o desactivado", () => {
    expect(validarCategoriaNueva({ nombre: "X", parent_id: U4 }, arbol).error).toMatch(/no existe/);
    expect(validarCategoriaNueva({ nombre: "X", parent_id: "hola" }, arbol).error).toMatch(/no existe/);
    const inactiva = [{ ...raiz, activo: false }, medio, hoja];
    expect(validarCategoriaNueva({ nombre: "X", parent_id: U1 }, inactiva).error).toMatch(/desactivada/);
  });

  it("un gasto recurrente no puede tener subcategorías", () => {
    const wifi = cat(U4, "Wifi", U1, { recurrencia: "mensual" });
    expect(validarCategoriaNueva({ nombre: "Hija", parent_id: U4 }, [...arbol, wifi]).error).toMatch(/no puede tener subtipos/);
  });

  it("valida el nombre", () => {
    expect(validarCategoriaNueva({ nombre: "   " }, arbol).error).toMatch(/nombre/);
    expect(validarCategoriaNueva({}, arbol).error).toMatch(/nombre/);
    expect(validarCategoriaNueva({ nombre: "a".repeat(81) }, arbol).error).toMatch(/80/);
  });

  it("una mensual guarda monto y día; el mes de vencimiento no aplica", () => {
    const { datos } = validarCategoriaNueva(
      { nombre: "Luz", recurrencia: "mensual", monto_estimado: "45.5", dia_vencimiento: 10, mes_vencimiento: 3 },
      arbol
    );
    expect(datos).toMatchObject({ recurrencia: "mensual", monto_estimado: 45.5, dia_vencimiento: 10, mes_vencimiento: null });
  });

  it("una anual necesita el mes de vencimiento", () => {
    expect(validarCategoriaNueva({ nombre: "Dominio", recurrencia: "anual" }, arbol).error).toMatch(/mes/);
    expect(validarCategoriaNueva({ nombre: "Dominio", recurrencia: "anual", mes_vencimiento: 13 }, arbol).error).toMatch(/mes/);
    expect(validarCategoriaNueva({ nombre: "Dominio", recurrencia: "anual", mes_vencimiento: 7 }, arbol).datos.mes_vencimiento).toBe(7);
  });

  it("rechaza día, monto o recurrencia fuera de rango", () => {
    const base = { nombre: "Luz", recurrencia: "mensual" };
    expect(validarCategoriaNueva({ ...base, dia_vencimiento: 0 }, arbol).error).toMatch(/día/);
    expect(validarCategoriaNueva({ ...base, dia_vencimiento: 32 }, arbol).error).toMatch(/día/);
    expect(validarCategoriaNueva({ ...base, dia_vencimiento: 1.5 }, arbol).error).toMatch(/día/);
    expect(validarCategoriaNueva({ ...base, monto_estimado: -5 }, arbol).error).toMatch(/monto/);
    expect(validarCategoriaNueva({ nombre: "Luz", recurrencia: "semanal" }, arbol).error).toMatch(/cada cuánto se paga/);
  });

  it("sin recurrencia se descartan día y mes de vencimiento", () => {
    const { datos } = validarCategoriaNueva({ nombre: "Varios", dia_vencimiento: 5, mes_vencimiento: 2 }, arbol);
    expect(datos).toMatchObject({ dia_vencimiento: null, mes_vencimiento: null });
  });
});

describe("edición de categorías", () => {
  it("renombra y reordena", () => {
    expect(validarCategoriaEdicion({ nombre: "Nuevo" }, hoja, arbol).datos).toEqual({ nombre: "Nuevo" });
    expect(validarCategoriaEdicion({ orden: 3 }, hoja, arbol).datos).toEqual({ orden: 3 });
    expect(validarCategoriaEdicion({ orden: -1 }, hoja, arbol).error).toMatch(/orden/);
  });

  it("completa la recurrencia con lo que ya tenía la categoría", () => {
    const wifi = cat(U4, "Wifi", U1, { recurrencia: "mensual", dia_vencimiento: 10 });
    expect(validarCategoriaEdicion({ monto_estimado: 45 }, wifi, [...arbol, wifi]).datos).toMatchObject({
      recurrencia: "mensual",
      monto_estimado: 45,
      dia_vencimiento: 10,
    });
    expect(validarCategoriaEdicion({ recurrencia: "anual" }, wifi, [...arbol, wifi]).error).toMatch(/mes/);
  });

  it("un grupo con subcategorías no puede volverse recurrente", () => {
    expect(validarCategoriaEdicion({ recurrencia: "mensual" }, medio, arbol).error).toMatch(/tiene subtipos/);
    expect(validarCategoriaEdicion({ recurrencia: "mensual" }, hoja, arbol).datos.recurrencia).toBe("mensual");
  });

  it("las categorías con clave se pueden renombrar pero no desactivar", () => {
    const sesiones = cat(U4, "Pago de sesiones", U1, { clave: "pago_sesiones" });
    expect(validarCategoriaEdicion({ nombre: "Sesiones" }, sesiones, [...arbol, sesiones]).datos).toEqual({ nombre: "Sesiones" });
    expect(validarCategoriaEdicion({ activo: false }, sesiones, [...arbol, sesiones]).error).toMatch(/Pagar al equipo/);
  });

  it("sin cambiar de carpeta, el padre igual no cuenta como cambio", () => {
    expect(validarCategoriaEdicion({ parent_id: U2, nombre: "Igual" }, hoja, arbol).datos).toEqual({ nombre: "Igual" });
  });

  it("se puede mover a otra carpeta, o al principio", () => {
    const otra = cat(U4, "Otra carpeta");
    const todas = [...arbol, otra];
    expect(validarCategoriaEdicion({ parent_id: U4 }, hoja, todas).datos).toEqual({ parent_id: U4 });
    expect(validarCategoriaEdicion({ parent_id: null }, hoja, todas).datos).toEqual({ parent_id: null });
  });

  it("no se mueve adentro de sí mismo ni de lo que tiene adentro", () => {
    expect(validarCategoriaEdicion({ parent_id: U2 }, medio, arbol).error).toMatch(/sí mismo/);
    expect(validarCategoriaEdicion({ parent_id: U3 }, raiz, arbol).error).toMatch(/sí mismo/);
  });

  it("no se mueve si el árbol pasaría de 3 niveles (también con lo que tiene adentro)", () => {
    const otra = cat(U4, "Otra carpeta", U1);
    // medio (con hoja adentro: altura 2) dentro de "otra" (nivel 2) quedaría en el nivel 4.
    expect(validarCategoriaEdicion({ parent_id: U4 }, medio, [...arbol, otra]).error).toMatch(/3 niveles/);
    // una hoja suelta (altura 1) sí entra en el nivel 3.
    const suelta = cat("55555555-5555-4555-8555-555555555555", "Suelta");
    expect(validarCategoriaEdicion({ parent_id: U4 }, suelta, [...arbol, otra, suelta]).datos).toEqual({ parent_id: U4 });
  });

  it("no se mueve a una carpeta que se repite, desactivada o del sistema", () => {
    const wifi = cat(U4, "Wifi", null, { recurrencia: "mensual" });
    expect(validarCategoriaEdicion({ parent_id: U4 }, hoja, [...arbol, wifi]).error).toMatch(/se repite/);
    const apagada = cat(U4, "Apagada", null, { activo: false });
    expect(validarCategoriaEdicion({ parent_id: U4 }, hoja, [...arbol, apagada]).error).toMatch(/desactivado/);
    const sistema = cat(U4, "Pago de sesiones", null, { clave: "pago_sesiones" });
    expect(validarCategoriaEdicion({ parent_id: U4 }, hoja, [...arbol, sistema]).error).toMatch(/automático/);
  });

  it("un tipo del sistema no se mueve", () => {
    const sistema = cat(U4, "Pago de sesiones", U1, { clave: "pago_sesiones" });
    expect(validarCategoriaEdicion({ parent_id: null }, sistema, [...arbol, sistema]).error).toMatch(/Pagar al equipo/);
  });

  it("no se repite un nombre en la misma carpeta, ni al crear, ni al renombrar, ni al mover", () => {
    expect(validarCategoriaNueva({ nombre: " consultora DE marketing ", parent_id: U2 }, arbol).error).toMatch(/Ya hay un tipo/);
    expect(validarCategoriaNueva({ nombre: "Consultora de marketing", parent_id: null }, arbol).datos.nombre).toBe("Consultora de marketing");
    const hermana = cat(U4, "Otra", U2);
    expect(validarCategoriaEdicion({ nombre: "otra" }, hoja, [...arbol, hermana]).error).toMatch(/Ya hay un tipo/);
    expect(validarCategoriaEdicion({ nombre: "Consultora de marketing" }, hoja, arbol).datos).toEqual({ nombre: "Consultora de marketing" });
    const igual = cat(U4, "Consultora de marketing", U1);
    expect(validarCategoriaEdicion({ parent_id: U1 }, hoja, [...arbol, igual]).error).toMatch(/Ya hay un tipo/);
  });

  it("no se activa una hija si la madre sigue desactivada", () => {
    const todas = [{ ...medio, activo: false }, raiz, { ...hoja, activo: false }];
    expect(validarCategoriaEdicion({ activo: true }, todas[2], todas).error).toMatch(/Activá primero/);
  });

  it("rechaza un pedido vacío", () => {
    expect(validarCategoriaEdicion({}, hoja, arbol).error).toMatch(/nada para actualizar/);
  });
});

describe("borrar categorías", () => {
  it("con pagos explica que se puede desactivar", () => {
    const r = puedeBorrarCategoria(hoja, arbol, 3);
    expect(r.error).toMatch(/3 pagos registrados/);
    expect(r.error).toMatch(/desactivala/);
  });

  it("con subcategorías o con clave tampoco", () => {
    expect(puedeBorrarCategoria(raiz, arbol, 0).error).toMatch(/otros tipos adentro/);
    expect(puedeBorrarCategoria({ ...hoja, clave: "pago_encuentros" }, arbol, 0).error).toMatch(/Pagar al equipo/);
  });

  it("una hoja sin pagos ni clave se puede borrar", () => {
    expect(puedeBorrarCategoria(hoja, arbol, 0)).toEqual({ ok: true });
  });
});

describe("pagos", () => {
  const wifi = cat(U4, "Wifi", U1, { recurrencia: "mensual", dia_vencimiento: 10 });
  const zoom = cat(U4, "Zoom", U1, { recurrencia: "anual", mes_vencimiento: 7 });
  const hoy = "2026-10-04";
  const base = { monto: "45.50", metodo_pago: "transferencia" };

  it("arma el pago: fecha de hoy y período del mes si no vienen", () => {
    const { datos, error } = validarPago(base, wifi, hoy);
    expect(error).toBeUndefined();
    expect(datos).toEqual({
      categoria_id: U4,
      fecha_pago: "2026-10-04",
      periodo: "2026-10-01",
      monto: 45.5,
      metodo_pago: "transferencia",
      proveedor: null,
      descripcion: null,
    });
  });

  it("el período de una anual es el primero de enero del año", () => {
    expect(validarPago({ ...base, fecha_pago: "2026-07-05" }, zoom, hoy).datos.periodo).toBe("2026-01-01");
    expect(validarPago({ ...base, periodo: "2025-07" }, zoom, hoy).datos.periodo).toBe("2025-01-01");
  });

  it("acepta un período elegido de un mes anterior, en los dos formatos", () => {
    expect(validarPago({ ...base, periodo: "2026-09" }, wifi, hoy).datos.periodo).toBe("2026-09-01");
    expect(validarPago({ ...base, periodo: "2026-09-01" }, wifi, hoy).datos.periodo).toBe("2026-09-01");
    expect(validarPago({ ...base, periodo: "2026-09-15" }, wifi, hoy).error).toMatch(/mes del pago/);
    expect(validarPago({ ...base, periodo: "2026-13" }, wifi, hoy).error).toMatch(/mes del pago/);
  });

  it("un pago suelto no lleva período", () => {
    expect(validarPago({ ...base, periodo: "2026-09" }, cat(U3, "Consultora", U2), hoy).datos.periodo).toBeNull();
  });

  it("valida el monto", () => {
    for (const monto of [undefined, "", "abc", 0, -3, 1_000_000, true]) {
      expect(validarPago({ ...base, monto }, wifi, hoy).error).toMatch(/monto/);
    }
    expect(validarPago({ ...base, monto: 10.456 }, wifi, hoy).datos.monto).toBe(10.46);
  });

  it("valida método y fecha", () => {
    expect(validarPago({ ...base, metodo_pago: undefined }, wifi, hoy).error).toMatch(/efectivo o transferencia/);
    expect(validarPago({ ...base, metodo_pago: "cheque" }, wifi, hoy).error).toMatch(/efectivo o transferencia/);
    expect(validarPago({ ...base, fecha_pago: "2026-02-30" }, wifi, hoy).error).toMatch(/fecha/);
  });

  it("recorta proveedor y descripción y rechaza los muy largos", () => {
    const { datos } = validarPago({ ...base, proveedor: "  Telecentro ", descripcion: "   " }, wifi, hoy);
    expect(datos.proveedor).toBe("Telecentro");
    expect(datos.descripcion).toBeNull();
    expect(validarPago({ ...base, proveedor: "x".repeat(121) }, wifi, hoy).error).toMatch(/120/);
    expect(validarPago({ ...base, descripcion: "x".repeat(301) }, wifi, hoy).error).toMatch(/300/);
    expect(validarPago({ ...base, proveedor: 5 }, wifi, hoy).error).toMatch(/proveedor/);
  });

  it("exige una categoría activa", () => {
    expect(validarPago(base, null, hoy).error).toMatch(/tipo de gasto/);
    expect(validarPago(base, { ...wifi, activo: false }, hoy).error).toMatch(/desactivada/);
  });
});

describe("monto", () => {
  it("el estimado puede quedar vacío", () => {
    expect(parseMonto("", { opcional: true })).toEqual({ valor: null });
    expect(parseMonto(null, { opcional: true })).toEqual({ valor: null });
    expect(parseMonto("", {}).error).toBeDefined();
  });
});

describe("comprobantes", () => {
  it("acepta JPG, PNG, WebP y PDF de hasta 5 MB", () => {
    expect(validarComprobante({ type: "image/jpeg", size: 1000 })).toEqual({ extension: "jpg" });
    expect(validarComprobante({ type: "image/png", size: 1000 })).toEqual({ extension: "png" });
    expect(validarComprobante({ type: "image/webp", size: 1000 })).toEqual({ extension: "webp" });
    expect(validarComprobante({ type: "application/pdf", size: COMPROBANTE.maxBytes })).toEqual({ extension: "pdf" });
  });

  it("rechaza otros tipos con un mensaje claro", () => {
    expect(validarComprobante({ type: "application/zip", size: 1000 }).error).toMatch(/JPG, PNG o WebP/);
    expect(validarComprobante({ type: "", size: 1000 }).error).toMatch(/JPG, PNG o WebP/);
  });

  it("rechaza lo vacío y lo que pasa de 5 MB, diciendo cuánto pesa", () => {
    expect(validarComprobante({ type: "image/png", size: 0 }).error).toMatch(/vacío/);
    const r = validarComprobante({ type: "image/png", size: 6.5 * 1024 * 1024 });
    expect(r.error).toMatch(/6,5 MB/);
    expect(r.error).toMatch(/5 MB/);
    expect(validarComprobante({ type: "image/png", size: COMPROBANTE.maxBytes + 1 }).error).toMatch(/máximo/);
    expect(validarComprobante(null).error).toBeDefined();
  });

  it("reconoce el tipo real por los primeros bytes", () => {
    expect(tipoPorContenido(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(tipoPorContenido(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(tipoPorContenido(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))).toBe("application/pdf");
    expect(tipoPorContenido(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
    expect(tipoPorContenido(Uint8Array.from([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
    expect(tipoPorContenido(new Uint8Array(0))).toBeNull();
  });

  it("la ruta en el bucket pertenece al pago", () => {
    const ruta = rutaComprobante(U1, "pdf", 1760000000000);
    expect(ruta).toBe(`${U1}/1760000000000.pdf`);
    expect(esRutaDeComprobante(ruta, U1)).toBe(true);
    expect(esRutaDeComprobante(ruta, U2)).toBe(false);
    expect(esRutaDeComprobante(`${U1}/../otro.pdf`, U1)).toBe(false);
    expect(esRutaDeComprobante(null, U1)).toBe(false);
  });
});

describe("edición de un pago de liquidación", () => {
  const actual = {
    monto: 140,
    categoria_id: U1,
    equipo_id: U2,
    modulo_id: U3,
    periodo: null,
    fecha_pago: "2026-10-04",
    metodo_pago: "transferencia",
  };

  it("permite cambiar fecha, método, proveedor y descripción", () => {
    expect(
      validarEdicionPagoLiquidacion({ fecha_pago: "2026-10-03", metodo_pago: "efectivo", proveedor: " Banco ", descripcion: "" }, actual).datos
    ).toEqual({ fecha_pago: "2026-10-03", metodo_pago: "efectivo", proveedor: "Banco", descripcion: null });
  });

  it("rechaza con un mensaje claro cambiar monto, categoría, persona, módulo o período", () => {
    for (const cambio of [{ monto: 100 }, { monto: "141" }, { categoria_id: U2 }, { equipo_id: U1 }, { modulo_id: null }, { periodo: "2026-10-01" }]) {
      expect(validarEdicionPagoLiquidacion({ ...cambio, metodo_pago: "efectivo" }, actual).error).toMatch(/solo se pueden cambiar la fecha/);
    }
  });

  it("si el pedido repite los valores actuales, no es un cambio", () => {
    expect(validarEdicionPagoLiquidacion({ monto: "140.00", categoria_id: U1, equipo_id: U2, modulo_id: U3, metodo_pago: "efectivo" }, actual).datos).toEqual({
      metodo_pago: "efectivo",
    });
  });

  it("valida fecha y método y rechaza un pedido vacío", () => {
    expect(validarEdicionPagoLiquidacion({ fecha_pago: "2026-02-30" }, actual).error).toMatch(/fecha/);
    expect(validarEdicionPagoLiquidacion({ metodo_pago: "cheque" }, actual).error).toMatch(/efectivo o transferencia/);
    expect(validarEdicionPagoLiquidacion({}, actual).error).toMatch(/nada/);
  });
});
