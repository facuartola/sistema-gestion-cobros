import { describe, expect, it } from "vitest";
import { aNombreDeArchivo, armarCSV, celdaCSV, celdaSegura, descargarCSV, separadorParaLocale } from "./csv";

describe("CSV", () => {
  it("nombre de archivo sin tildes ni símbolos", () => {
    expect(aNombreDeArchivo("TEST Auditoría A")).toBe("test-auditoria-a");
    expect(aNombreDeArchivo("Producciones fotográficas y videos")).toBe("producciones-fotograficas-y-videos");
    expect(aNombreDeArchivo("¿?")).toBe("archivo");
  });

  it("un texto que Excel tomaría como fórmula queda como texto", () => {
    expect(celdaSegura('=HYPERLINK("http://x")')).toBe("'=HYPERLINK(\"http://x\")");
    expect(celdaSegura("+54 11 5555")).toBe("'+54 11 5555");
    expect(celdaSegura("@algo")).toBe("'@algo");
  });

  it("los números y los textos comunes no se tocan", () => {
    expect(celdaSegura(70)).toBe(70);
    expect(celdaSegura("TEST Banco \"Río\"")).toBe("TEST Banco \"Río\"");
    expect(celdaSegura("-5")).toBe("-5");
    expect(celdaSegura(null)).toBeNull();
  });
});

describe("separador según la configuración regional", () => {
  it("coma decimal (es-AR y casi toda Latinoamérica y Europa): punto y coma", () => {
    for (const l of ["es-AR", "es-ES", "es-UY", "es-CL", "pt-BR", "de-DE", "fr-FR", "it-IT"]) expect(separadorParaLocale(l)).toBe(";");
  });

  it("punto decimal (en-US, en-GB, ja-JP y también es-MX): coma", () => {
    for (const l of ["en-US", "en-GB", "ja-JP", "es-MX"]) expect(separadorParaLocale(l)).toBe(",");
  });

  it("es-419 (el español genérico de Latinoamérica que informan muchos Chrome argentinos): punto y coma", () => {
    expect(separadorParaLocale("es-419")).toBe(";");
  });

  it("un navegador en es-US o en inglés pero con zona horaria de Argentina: punto y coma", () => {
    expect(separadorParaLocale("es-US", "America/Argentina/Buenos_Aires")).toBe(";");
    expect(separadorParaLocale("en-US", "America/Argentina/Cordoba")).toBe(";");
    expect(separadorParaLocale("es-US", "America/Buenos_Aires")).toBe(";");
  });

  it("la misma configuración en otra zona horaria: coma", () => {
    expect(separadorParaLocale("es-US", "America/New_York")).toBe(",");
    expect(separadorParaLocale("en-US", "")).toBe(",");
  });

  it("un locale inválido o ausente no rompe", () => {
    expect(separadorParaLocale("no es un locale")).toBe(",");
    expect([",", ";"]).toContain(separadorParaLocale(undefined));
  });
});

describe("armado del CSV", () => {
  const columnas = [
    { label: "Nombre", value: (f) => f.nombre },
    { label: "Monto (US$)", value: (f) => f.monto },
    { label: "Nota", value: (f) => f.nota },
  ];
  const filas = [{ nombre: 'Ana "la Coach"', monto: 12.5, nota: "línea 1\nlínea 2" }];

  it("con coma: columnas separadas por coma, comillas duplicadas y saltos de línea entre comillas", () => {
    expect(armarCSV(filas, columnas, ",")).toBe('"Nombre","Monto (US$)","Nota"\r\n"Ana ""la Coach""","12.5","línea 1\nlínea 2"');
  });

  it("con punto y coma (es-AR): columnas separadas por ; y el número con coma decimal", () => {
    expect(armarCSV(filas, columnas, ";")).toBe('"Nombre";"Monto (US$)";"Nota"\r\n"Ana ""la Coach""";"12,5";"línea 1\nlínea 2"');
  });

  it("una coma o un punto y coma dentro del texto no parte la columna", () => {
    const csv = armarCSV([{ nombre: "Pérez, Ana; hija", monto: 1, nota: "" }], columnas, ";");
    expect(csv.split("\r\n")[1]).toBe('"Pérez, Ana; hija";"1";""');
  });

  it("lo que Excel tomaría como fórmula queda como texto", () => {
    expect(celdaCSV("=SUM(A1)", ";")).toBe(`"'=SUM(A1)"`);
  });

  it("nulos y undefined quedan vacíos; los enteros no cambian", () => {
    expect(celdaCSV(null, ";")).toBe('""');
    expect(celdaCSV(undefined, ",")).toBe('""');
    expect(celdaCSV(70, ";")).toBe('"70"');
  });

  it("sin filas, solo el encabezado", () => {
    expect(armarCSV([], columnas, ";")).toBe('"Nombre";"Monto (US$)";"Nota"');
  });
});

describe("descargarCSV", () => {
  it("el archivo lleva el BOM de UTF-8 y el separador pedido", async () => {
    let blob;
    const original = { URL: globalThis.URL, document: globalThis.document };
    const enlace = { click() {}, href: "", download: "" };
    globalThis.document = { createElement: () => enlace, body: { appendChild() {}, removeChild() {} } };
    globalThis.URL = Object.assign(function URL() {}, {
      createObjectURL: (b) => {
        blob = b;
        return "blob:x";
      },
      revokeObjectURL() {},
    });
    try {
      descargarCSV("x.csv", [{ n: "á", m: 1.5 }], [{ label: "N", value: (f) => f.n }, { label: "M", value: (f) => f.m }], ";");
    } finally {
      globalThis.URL = original.URL;
      globalThis.document = original.document;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(await blob.text()).toBe('"N";"M"\r\n"á";"1,5"');
    expect(enlace.download).toBe("x.csv");
  });
});
