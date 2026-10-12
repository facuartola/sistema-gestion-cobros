import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { ErrorCopia, ORDEN_RESTAURACION, TABLAS, armarCopia, reunirTablas, traerTabla } from "./copia";

function tablasVacias() {
  return Object.fromEntries(TABLAS.map((t) => [t.nombre, []]));
}

// Un Supabase de mentira: select().order().range() y select(head).
function falso(tablas, { conteos = {}, maxFilas = Infinity, errorEn = null } = {}) {
  const pedidos = [];
  return {
    pedidos,
    from(nombre) {
      return {
        select(_cols, opciones) {
          if (opciones?.head) return Promise.resolve({ count: conteos[nombre] ?? tablas[nombre].length, error: null });
          const q = {
            order: () => q,
            range(a, b) {
              pedidos.push([nombre, a, b]);
              if (errorEn === nombre) return Promise.resolve({ data: null, error: { message: "boom" } });
              return Promise.resolve({ data: tablas[nombre].slice(a, Math.min(b + 1, a + maxFilas)), error: null });
            },
          };
          return q;
        },
      };
    },
  };
}

function datosDeEjemplo() {
  const t = tablasVacias();
  t.jugadores = [
    { id: "j1", nombre: 'Ana "la Zurda" Pérez', contacto: null, activo: true, created_at: "2026-09-01T12:00:00+00:00", monto_mensual: 15000.5, dia_vencimiento: 10, notas: "línea 1\nlínea 2" },
  ];
  t.cuotas_jugadores = [
    { id: "c1", jugador_id: "j1", mes: "2026-09-01", monto: 15000.5, estado: "pagado", fecha_pago: "2026-09-08", created_at: "2026-09-01T12:00:00+00:00", metodo_pago: "transferencia" },
  ];
  t.categorias_gasto = [
    { id: "g1", nombre: "Gastos fijos", parent_id: null, orden: 1, recurrencia: "ninguna", activo: true },
    { id: "g2", nombre: "Wifi", parent_id: "g1", orden: 1, recurrencia: "mensual", monto_estimado: 40, activo: true },
  ];
  t.pagos_gasto = [
    { id: "p1", categoria_id: "g2", fecha_pago: "2026-09-15", periodo: "2026-09-01", monto: 40, metodo_pago: "efectivo", comprobante_path: "p1/comprobante.pdf", created_at: "2026-09-15T12:00:00+00:00" },
    { id: "p2", categoria_id: "g2", fecha_pago: "2026-10-15", periodo: null, monto: 41, comprobante_path: null, created_at: "2026-10-15T12:00:00+00:00" },
  ];
  return t;
}

describe("traerTabla", () => {
  it("trae más de 1000 filas pidiendo de a páginas", async () => {
    const filas = Array.from({ length: 2500 }, (_, i) => ({ id: `id-${String(i).padStart(5, "0")}` }));
    const sb = falso({ jugadores: filas });
    const traidas = await traerTabla(sb, { nombre: "jugadores", titulo: "los jugadores" });
    expect(traidas).toHaveLength(2500);
    expect(sb.pedidos).toEqual([
      ["jugadores", 0, 999],
      ["jugadores", 1000, 1999],
      ["jugadores", 2000, 2999],
    ]);
  });

  it("una tabla de exactamente 1000 filas también se cuenta bien", async () => {
    const filas = Array.from({ length: 1000 }, (_, i) => ({ id: `id-${i}` }));
    expect(await traerTabla(falso({ jugadores: filas }), { nombre: "jugadores", titulo: "x" })).toHaveLength(1000);
  });

  it("falla con un mensaje claro si las filas no coinciden con el conteo de la base", async () => {
    const sb = falso({ jugadores: [{ id: "a" }, { id: "b" }] }, { conteos: { jugadores: 3 } });
    await expect(traerTabla(sb, { nombre: "jugadores", titulo: "los jugadores" })).rejects.toThrow(
      "No se pudo completar la copia: faltaron datos de los jugadores."
    );
  });

  it("falla si el servidor devuelve menos filas por página que las pedidas (límite de la base)", async () => {
    const filas = Array.from({ length: 1500 }, (_, i) => ({ id: `id-${i}` }));
    const sb = falso({ jugadores: filas }, { maxFilas: 500 });
    await expect(traerTabla(sb, { nombre: "jugadores", titulo: "los jugadores" })).rejects.toBeInstanceOf(ErrorCopia);
  });

  it("falla si hay ids repetidos (páginas que se pisan)", async () => {
    const sb = falso({ jugadores: [{ id: "a" }, { id: "a" }] });
    await expect(traerTabla(sb, { nombre: "jugadores", titulo: "los jugadores" })).rejects.toBeInstanceOf(ErrorCopia);
  });

  it("falla si la consulta da error", async () => {
    const sb = falso({ jugadores: [{ id: "a" }] }, { errorEn: "jugadores" });
    await expect(traerTabla(sb, { nombre: "jugadores", titulo: "los jugadores" })).rejects.toThrow(/faltaron datos de los jugadores/);
  });
});

describe("reunirTablas", () => {
  it("si todas las tablas vienen vacías avisa de un posible problema de permisos", async () => {
    await expect(reunirTablas(falso(tablasVacias()))).rejects.toThrow(/permisos/);
  });

  it("devuelve las 13 tablas en el orden de restauración", async () => {
    const sb = falso({ ...tablasVacias(), jugadores: [{ id: "a" }] });
    const tablas = await reunirTablas(sb);
    expect(Object.keys(tablas)).toEqual(ORDEN_RESTAURACION);
    expect(ORDEN_RESTAURACION).toHaveLength(13);
  });
});

describe("armarCopia", () => {
  const ahora = new Date("2026-10-05T23:30:00Z"); // 20:30 en Argentina
  const copia = armarCopia(datosDeEjemplo(), { ahora, separador: ";" });
  const archivos = unzipSync(copia.zip);
  const texto = (n) => strFromU8(archivos[n]);

  it("el zip trae una planilla por tabla, datos.json, LEEME.txt y comprobantes.csv", () => {
    expect(Object.keys(archivos).sort()).toEqual([...TABLAS.map((t) => t.archivo), "comprobantes.csv", "datos.json", "LEEME.txt"].sort());
    expect(copia.nombre).toBe("copia-de-datos-2026-10-05.zip");
  });

  it("datos.json es la copia fiel: mismas filas, sin transformar", () => {
    const json = JSON.parse(texto("datos.json"));
    expect(json.version).toBe(1);
    expect(json.orden_restauracion).toEqual(ORDEN_RESTAURACION);
    expect(json.tablas).toEqual(datosDeEjemplo());
    expect(json.tablas.pagos_gasto[0].periodo).toBe("2026-09-01");
  });

  it("las planillas escapan comillas, tildes y saltos de línea, y usan el separador pedido", () => {
    const csv = texto("jugadores.csv");
    expect([...archivos["jugadores.csv"].slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM de UTF-8 para Excel
    expect(csv.startsWith('"Nombre";"Contacto"')).toBe(true);
    expect(csv).toContain('"Ana ""la Zurda"" Pérez"');
    expect(csv).toContain('"línea 1\nlínea 2"');
    expect(csv).toContain('"15000,5"');
  });

  it("con coma como separador los decimales llevan punto", () => {
    const csv = strFromU8(unzipSync(armarCopia(datosDeEjemplo(), { ahora, separador: "," }).zip)["jugadores.csv"]);
    expect(csv).toContain('"Nombre","Contacto"');
    expect(csv).toContain('"15000.5"');
  });

  it("las relaciones llevan el nombre además del id", () => {
    expect(texto("cuotas-de-jugadores.csv")).toContain('"Ana ""la Zurda"" Pérez";"2026-09";"15000,5";"Pagada"');
    expect(texto("cuotas-de-jugadores.csv")).toContain('"c1";"j1"');
    expect(texto("pagos-de-gastos.csv")).toContain('"Gastos fijos › Wifi"');
    expect(texto("tipos-de-gasto.csv")).toContain('"Gastos fijos › Wifi";"Wifi";"Todos los meses"');
  });

  it("comprobantes.csv lista solo los pagos con archivo", () => {
    const csv = texto("comprobantes.csv");
    expect(csv).toContain("p1/comprobante.pdf");
    expect(csv.trim().split("\r\n")).toHaveLength(2);
  });

  it("LEEME.txt trae la hora de Argentina, los conteos y las aclaraciones", () => {
    const leeme = texto("LEEME.txt");
    expect(leeme).toContain("05/10/2026, 20:30");
    expect(leeme).toContain("Jugadores: 1");
    expect(leeme).toContain("Pagos de gastos: 2");
    expect(leeme).toContain("Sesiones: 0");
    expect(leeme).toContain("Tipos de gasto: 2");
    expect(leeme).not.toMatch(/categor/i);
    expect(leeme).toContain("NO vienen adentro");
    expect(leeme).toContain("supabase/migrations");
  });

  it("no incluye administradores, mails permitidos ni errores", () => {
    const todo = Object.keys(archivos).join(" ") + texto("datos.json");
    expect(todo).not.toMatch(/app_admins|emails_permitidos|errores_app/);
  });

  it("avisa si el zip se acerca al límite de tamaño", () => {
    expect(copia.cercaDelLimite).toBe(false);
  });
});
