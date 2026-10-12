import { describe, expect, it } from "vitest";
import { formatoDolares } from "./moneda";
import {
  armarPendientes,
  armarSerie,
  cobradoPorFechaDePago,
  colorAvatar,
  diasEntre,
  gastosPorPagar,
  iniciales,
  mesCorto,
  mesLabelCorto,
  mesesHasta,
  nombreMes,
  porcentajeCobrado,
  progresoCertificacion,
  proximosVencimientos,
  agendaProxima,
  ultimosMovimientos,
  textoGastosPorPagar,
} from "./resumen";
import { agruparRecordatorios } from "./recordatoriosAgrupar";
import { armarResumenCertificacion } from "./certificacionResumen";

describe("meses y textos", () => {
  it("últimos 6 meses terminando en el elegido, cruzando el año", () => {
    expect(mesesHasta("2026-10")).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(mesesHasta("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("nombres de mes", () => {
    expect(nombreMes("2026-09")).toBe("septiembre");
    expect(mesLabelCorto("2026-10")).toBe("Octubre 2026");
    expect(mesCorto("2026-05")).toBe("May");
    expect(mesCorto("2026-09")).toBe("Sep");
  });

  it("diasEntre y iniciales", () => {
    expect(diasEntre("2026-09-25", "2026-10-04")).toBe(9);
    expect(diasEntre("2026-10-04", "2026-10-04")).toBe(0);
    expect(iniciales("Bruno Acosta")).toBe("BA");
    expect(iniciales("wifi")).toBe("W");
    expect(iniciales("")).toBe("?");
  });

  it("el color del avatar es estable para el mismo nombre", () => {
    expect(colorAvatar("Bruno Acosta")).toBe(colorAvatar("Bruno Acosta"));
  });
});

describe("gastosPorPagar", () => {
  const categorias = [
    { id: "wifi", nombre: "Wifi", activo: true, recurrencia: "mensual", dia_vencimiento: 10, monto_estimado: null },
    { id: "cel", nombre: "Celulares", activo: true, recurrencia: "mensual", dia_vencimiento: 10, monto_estimado: null },
    { id: "mant", nombre: "Mantenimiento", activo: true, recurrencia: "mensual", dia_vencimiento: null, monto_estimado: 100 },
    { id: "zoom", nombre: "Zoom", activo: true, recurrencia: "anual", mes_vencimiento: 7, monto_estimado: 150 },
    { id: "viejo", nombre: "Viejo", activo: false, recurrencia: "mensual" },
    { id: "padre", nombre: "Gastos fijos", activo: true, recurrencia: "ninguna" },
  ];

  it("mensuales sin pago en el mes actual", () => {
    const g = gastosPorPagar({ categorias, pagos: [], hoy: "2026-10-04" });
    expect(g.items.map((i) => i.nombre)).toEqual(["Celulares", "Wifi", "Mantenimiento"]);
    expect(g.total).toBe(100);
    expect(g.conMonto).toBe(1);
    expect(g.sinMonto).toBe(2);
  });

  it("un pago del período cubre el mes; uno de otro mes no", () => {
    const pagos = [
      { categoria_id: "wifi", periodo: "2026-10-01", fecha_pago: "2026-10-02" },
      { categoria_id: "cel", periodo: "2026-09-01", fecha_pago: "2026-10-02" },
      { categoria_id: "mant", periodo: null, fecha_pago: "2026-10-03" },
    ];
    const g = gastosPorPagar({ categorias, pagos, hoy: "2026-10-04" });
    expect(g.items.map((i) => i.nombre)).toEqual(["Celulares"]);
  });

  it("anuales solo en su mes de vencimiento y si no se pagaron en el año", () => {
    const julio = gastosPorPagar({ categorias, pagos: [], hoy: "2026-07-03" });
    expect(julio.items.map((i) => i.nombre)).toContain("Zoom");
    const pagado = gastosPorPagar({
      categorias,
      pagos: [{ categoria_id: "zoom", periodo: "2026-01-01", fecha_pago: "2026-07-01" }],
      hoy: "2026-07-03",
    });
    expect(pagado.items.map((i) => i.nombre)).not.toContain("Zoom");
    const agosto = gastosPorPagar({ categorias, pagos: [], hoy: "2026-08-03" });
    expect(agosto.items.map((i) => i.nombre)).not.toContain("Zoom");
  });

  it("textos de la tarjeta", () => {
    const sinMontos = gastosPorPagar({ categorias: categorias.slice(0, 2), pagos: [], hoy: "2026-10-04" });
    expect(textoGastosPorPagar(sinMontos)).toEqual({ valor: "Sin montos cargados", detalle: "Celulares y Wifi vencen el 10" });
    const mixto = gastosPorPagar({ categorias, pagos: [], hoy: "2026-10-04" });
    const t = textoGastosPorPagar(mixto);
    expect(t.valor).toBe(formatoDolares(100));
    expect(t.detalle).toBe("Celulares, Wifi y Mantenimiento, este mes, 2 sin monto");
    const nada = gastosPorPagar({ categorias: [], pagos: [], hoy: "2026-10-04" });
    expect(textoGastosPorPagar(nada)).toEqual({ valor: formatoDolares(0), detalle: "Nada por pagar este mes" });
    const uno = gastosPorPagar({ categorias: [categorias[0]], pagos: [], hoy: "2026-10-04" });
    expect(textoGastosPorPagar(uno).detalle).toBe("Wifi vence el 10");
  });
});

describe("certificación y resultado", () => {
  it("avance de cobro de los alumnos con monto total", () => {
    expect(progresoCertificacion([{ activo: true }, { activo: true, monto_total: null }])).toBeNull();
    const p = progresoCertificacion([
      { activo: true, monto_total: 1000, total_abonado: 800 },
      { activo: true, monto_total: 1000, total_abonado: 1200 }, // pasado: se topea
      { activo: true, monto_total: null, total_abonado: 50 },
      { activo: false, monto_total: 5000, total_abonado: 0 },
    ]);
    expect(p).toEqual({ alumnos: 2, total: 2000, abonado: 1800, pct: 90 });
  });

  it("porcentaje cobrado y serie", () => {
    expect(porcentajeCobrado(2050, 810)).toBe(72);
    expect(porcentajeCobrado(0, 0)).toBe(0);
    const serie = armarSerie(["2026-09", "2026-10"], [{ mes: "2026-10", cobrado: "5", gastado: 2 }]);
    expect(serie).toEqual([
      { mes: "2026-09", cobrado: 0, gastado: 0 },
      { mes: "2026-10", cobrado: 5, gastado: 2 },
    ]);
  });
});

describe("armarPendientes", () => {
  const hoy = "2026-10-04";
  const ahora = new Date("2026-10-04T15:00:00-03:00");
  const personas = [
    { id: "a", tipo: "jugador", nombre: "Bruno Acosta", monto_mensual: 150, dia_vencimiento: 2, meses_adeudados: 1, cuota_actual: null },
    { id: "b", tipo: "alumno", nombre: "Ana Paz", monto_mensual: 80, dia_vencimiento: 1, meses_adeudados: 3, cuota_actual: { estado: "pendiente", monto: 90 } },
    { id: "c", tipo: "jugador", nombre: "Al día", monto_mensual: 10, dia_vencimiento: 1, cuota_actual: { estado: "pagado", monto: 10 } },
    { id: "d", tipo: "jugador", nombre: "Sin día", monto_mensual: 10, dia_vencimiento: null, cuota_actual: null },
    { id: "e", tipo: "jugador", nombre: "Vence luego", monto_mensual: 10, dia_vencimiento: 20, cuota_actual: null },
  ];
  const recordatorios = [
    { id: "r1", titulo: "Llamar a Sofía", fecha: "2026-10-04", tipo: "seguimiento", nota: "Sobre la certificación\notra línea", hecho: false },
    { id: "r2", titulo: "Revisar", fecha: "2026-10-01", tipo: "general", nota: null, hecho: false },
    { id: "r3", titulo: "Futuro", fecha: "2026-10-20", tipo: "general", nota: null, hecho: false },
  ];

  it("cobros atrasados primero (más deuda arriba), luego recordatorios vencidos y de hoy", () => {
    const items = armarPendientes({
      personas,
      mes: "2026-10",
      hoy,
      grupos: agruparRecordatorios(recordatorios, hoy),
      buscarPersona: () => null,
      ahora,
    });
    expect(items.map((i) => i.clave)).toEqual(["cobro-alumno-b", "cobro-jugador-a", "recordatorio-r2", "recordatorio-r1"]);
    const ana = items[0];
    expect(ana.titulo).toBe("Cobrar a Ana Paz");
    expect(ana.monto).toBe(90);
    expect(ana.detalle).toBe("Cuota vencida el 1 de octubre, debe 3 meses");
    expect(items[1].monto).toBe(150);
    expect(items[2].etiqueta).toBe("Hace 3 días");
    expect(items[2].tono).toBe("warn");
    expect(items[3].etiqueta).toBe("Hoy");
    expect(items[3].detalle).toBe("Sobre la certificación");
    expect(items[2].detalle).toBe("Recordatorio de general");
  });
});

describe("próximos 7 días", () => {
  const hoy = "2026-10-04";
  const personas = [
    { id: "a", tipo: "jugador", nombre: "Ana", dia_vencimiento: 6, monto_mensual: 100 },
    { id: "b", tipo: "alumno", nombre: "Beto", dia_vencimiento: 6, monto_mensual: 50 },
    { id: "c", tipo: "jugador", nombre: "Hoy", dia_vencimiento: 4, monto_mensual: 10 },
    { id: "d", tipo: "jugador", nombre: "Lejos", dia_vencimiento: 20, monto_mensual: 10 },
    { id: "e", tipo: "jugador", nombre: "Sin día", dia_vencimiento: null, monto_mensual: 10 },
  ];
  const categorias = [
    { id: "w", nombre: "Wifi", activo: true, recurrencia: "mensual", dia_vencimiento: 10, monto_estimado: null },
    { id: "m", nombre: "Mant", activo: true, recurrencia: "mensual", dia_vencimiento: 8, monto_estimado: 100 },
    { id: "z", nombre: "Zoom", activo: true, recurrencia: "anual", mes_vencimiento: 10, dia_vencimiento: 9, monto_estimado: 150 },
  ];

  it("cobros y gastos que vencen de mañana a 7 días, ordenados; lo de hoy y lo pagado quedan afuera", () => {
    const items = proximosVencimientos({
      personas,
      pagadas: new Set(["alumno-b-2026-10"]),
      categorias,
      pagos: [],
      hoy,
    });
    expect(items.map((i) => i.clave)).toEqual([
      "cobro-jugador-a-2026-10-06",
      "gasto-m-2026-10-08",
      "gasto-z-2026-10-09",
      "gasto-w-2026-10-10",
    ]);
    expect(items[1].monto).toBe(100);
  });

  it("un gasto ya pagado en el período no aparece, y cruza de mes", () => {
    const items = proximosVencimientos({
      personas: [{ id: "a", tipo: "jugador", nombre: "Ana", dia_vencimiento: 2, monto_mensual: 10 }],
      pagadas: new Set(),
      categorias: [categorias[0]],
      pagos: [{ categoria_id: "w", periodo: "2026-11-01", fecha_pago: "2026-11-01" }],
      hoy: "2026-10-30",
    });
    expect(items.map((i) => i.clave)).toEqual(["cobro-jugador-a-2026-11-02"]);
  });

  it("suma los recordatorios futuros y ordena por fecha", () => {
    const venc = [{ clave: "c1", tipo: "cobro", fecha: "2026-10-06", nombre: "Ana" }];
    const agenda = agendaProxima(
      venc,
      [
        { id: "r1", titulo: "Llamar", fecha: "2026-10-05", hecho: false },
        { id: "r2", titulo: "Hecho", fecha: "2026-10-05", hecho: true },
        { id: "r3", titulo: "Hoy", fecha: "2026-10-04", hecho: false },
        { id: "r4", titulo: "Lejos", fecha: "2026-10-20", hecho: false },
      ],
      "2026-10-04"
    );
    expect(agenda.map((i) => i.clave)).toEqual(["recordatorio-r1", "c1"]);
  });
});

describe("últimos movimientos", () => {
  it("mezcla cobros y pagos, los más recientes primero, hasta el límite", () => {
    const cobros = [
      { id: 1, fecha_pago: "2026-10-03", created_at: "2026-10-03T10:00:00Z", monto: "80", metodo_pago: "efectivo", nombre: "Ana" },
      { id: 2, fecha_pago: "2026-10-01", created_at: "2026-10-01T10:00:00Z", monto: 50, metodo_pago: null, nombre: "Beto" },
    ];
    const pagos = [
      { id: 9, fecha_pago: "2026-10-03", created_at: "2026-10-03T12:00:00Z", monto: 45, metodo_pago: "transferencia", nombre: "Wifi" },
    ];
    const m = ultimosMovimientos(cobros, pagos, 2);
    expect(m.map((x) => x.clave)).toEqual(["pago-9", "cobro-1"]);
    expect(m[1]).toMatchObject({ monto: 80, metodo: "efectivo", tipo: "cobro" });
  });
});

describe("cobradoPorFechaDePago", () => {
  const meses = ["2026-08", "2026-09", "2026-10"];

  it("cuenta cada cobro en el mes de su fecha de pago, no en el de la cuota", () => {
    const cuotas = [
      { mes: "2026-09-01", fecha_pago: "2026-10-03", monto: "500.00" },
      { mes: "2026-09-01", fecha_pago: "2026-09-23", monto: 799 },
      { mes: "2026-09-01", fecha_pago: "2026-08-31", monto: 100 },
    ];
    expect(cobradoPorFechaDePago(cuotas, meses)).toEqual([100, 799, 500]);
  });

  it("si la cuota pagada no tiene fecha, cuenta por su mes", () => {
    expect(cobradoPorFechaDePago([{ mes: "2026-09-01", fecha_pago: null, monto: 50 }], meses)).toEqual([0, 50, 0]);
  });

  it("ignora lo que cae fuera de los meses pedidos", () => {
    expect(cobradoPorFechaDePago([{ mes: "2026-05-01", fecha_pago: "2026-05-01", monto: 10000 }], meses)).toEqual([0, 0, 0]);
  });
});

describe("armarPendientes con gastos", () => {
  const grupos = { vencidos: [], hoy: [], proximos: [], hechos: [] };
  const gasto = (extra) => ({
    clave: "gasto-wifi-2026-10-01",
    id: "wifi",
    nombre: "Wifi",
    ruta: "Gastos fijos › Wifi",
    periodo: "2026-10-01",
    vencimiento: "2026-10-10",
    estado: "pendiente",
    monto: 45,
    ...extra,
  });

  it("suma los gastos fijos entre los cobros y los recordatorios, con su acción y etiqueta", () => {
    const filas = armarPendientes({ personas: [], mes: "2026-10", hoy: "2026-10-04", grupos, gastos: [gasto()] });
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      tipo: "gasto",
      titulo: "Pagar Wifi",
      detalle: "Gastos fijos, vence el 10 de octubre",
      etiqueta: "En 6 días",
      monto: 45,
    });
    expect(filas[0].gasto.id).toBe("wifi");
  });

  it("un gasto vencido dice cuándo venció; el del día, que vence hoy; el de mañana, mañana", () => {
    const [vencido] = armarPendientes({
      personas: [],
      mes: "2026-10",
      hoy: "2026-10-04",
      grupos,
      gastos: [gasto({ nombre: "Zoom", ruta: "Gastos fijos › Zoom", estado: "vencido", vencimiento: "2026-07-31", monto: null })],
    });
    expect(vencido).toMatchObject({ detalle: "Gastos fijos, venció el 31 de julio", etiqueta: "Vencido", tono: "warn", monto: null });
    const [hoyFila] = armarPendientes({ personas: [], mes: "2026-10", hoy: "2026-10-10", grupos, gastos: [gasto({ estado: "hoy" })] });
    expect(hoyFila.etiqueta).toBe("Vence hoy");
    const [manana] = armarPendientes({ personas: [], mes: "2026-10", hoy: "2026-10-09", grupos, gastos: [gasto()] });
    expect(manana.etiqueta).toBe("Mañana");
  });
});

describe("gastosPorPagar y la creación de la categoría", () => {
  const hoy = "2026-07-15";
  const zoom = { id: "zoom", nombre: "Zoom", activo: true, recurrencia: "anual", mes_vencimiento: 7, monto_estimado: 150 };

  it("no marca como pendiente un vencimiento de antes de crear la categoría", () => {
    const nueva = { ...zoom, created_at: "2026-10-04T12:00:00-03:00" };
    expect(gastosPorPagar({ categorias: [nueva], pagos: [], hoy }).items).toEqual([]);
  });

  it("sí lo marca si la categoría ya existía", () => {
    const vieja = { ...zoom, created_at: "2026-01-02T12:00:00-03:00" };
    expect(gastosPorPagar({ categorias: [vieja], pagos: [], hoy }).items.map((i) => i.nombre)).toEqual(["Zoom"]);
    expect(gastosPorPagar({ categorias: [vieja], pagos: [], hoy: "2027-07-01" }).items.map((i) => i.nombre)).toEqual(["Zoom"]);
  });

  it("al año siguiente de crearla avisa en julio", () => {
    const nueva = { ...zoom, created_at: "2026-10-04T12:00:00-03:00" };
    expect(gastosPorPagar({ categorias: [nueva], pagos: [], hoy: "2027-07-10" }).items.map((i) => i.nombre)).toEqual(["Zoom"]);
  });
});

describe("Para hacer hoy con la certificación", () => {
  const grupos = { vencidos: [], hoy: [], proximos: [], hechos: [] };
  const estados = [
    { modulo_id: "m1", numero: 1, cerrado_en: "2026-09-01T12:00:00Z", listo_para_liquidar: false },
    { modulo_id: "m2", numero: 2, cerrado_en: null, listo_para_liquidar: true },
    { modulo_id: "m3", numero: 3, cerrado_en: null, listo_para_liquidar: false },
  ];
  const liquidacionM2 = [
    { equipo_id: "A", nombre: "A", concepto: "sesiones", cantidad: 1, total: 50 },
    { equipo_id: "B", nombre: "B", concepto: "encuentros", cantidad: 2, total: 80 },
    { equipo_id: "C", nombre: "C", concepto: "encuentros", cantidad: 2, total: 140 },
  ];
  const resumen = armarResumenCertificacion(
    {
      cert: { id: "c", nombre: "Cert" },
      estados,
      avance: [
        { inscripcion_id: "i1", alumno: "Ana", en_condiciones: true },
        { inscripcion_id: "i2", alumno: "Beto", en_condiciones: false },
        { inscripcion_id: "i3", alumno: "Ceci", en_condiciones: true },
      ],
      liquidaciones: { m2: liquidacionM2 },
      pendientes: [...liquidacionM2, { equipo_id: "A", nombre: "A", concepto: "sesiones", cantidad: 1, total: 50 }],
      tardios: [{ equipo_id: "A", nombre: "A", concepto: "sesiones", cantidad: 1, total: 50 }],
      ultimaSesion: { i1: "2026-10-02", i3: "2026-09-01" },
    },
    "2026-10-04"
  );

  it("arma el estado: módulo en curso, alumnos en condiciones y pendiente al equipo", () => {
    expect(resumen).toMatchObject({ moduloEnCurso: 2, liquidados: 1, alumnos: 3, enCondiciones: 2 });
    expect(resumen.pendienteEquipo).toMatchObject({ total: 320, personas: 3, faltaTarifa: false });
    expect(resumen.modulosListos).toEqual([{ modulo_id: "m2", numero: 2, total: 270, personas: 3, faltaTarifa: false }]);
    // Solo avisa de quien completó las 10 en los últimos 7 días.
    expect(resumen.listosParaCertificar).toEqual([{ inscripcion_id: "i1", alumno: "Ana" }]);
  });

  it("'Módulo N: pagar al equipo (US$ X para P personas)', pagos atrasados y listo para certificar", () => {
    const filas = armarPendientes({ personas: [], mes: "2026-10", hoy: "2026-10-04", grupos, certificaciones: [resumen] });
    expect(filas.map((f) => [f.tipo, f.titulo, f.detalle, f.accion, f.href])).toEqual([
      ["liquidacion", "Módulo 2: pagar al equipo", `${formatoDolares(270)} para 3 personas`, "Revisar y pagar", "/certificacion/modulos"],
      ["pendientes", "Pagos atrasados al equipo", "1 persona, de módulos que ya se pagaron", "Revisar y pagar", "/certificacion/modulos"],
      ["certificar", "Ana: listo para certificar", "Completó las 10 sesiones", "Ver avance", "/certificacion/alumnos/i1"],
    ]);
  });

  it("si falta una tarifa lo dice en lugar del monto", () => {
    const sinTarifa = { ...resumen, modulosListos: [{ modulo_id: "m2", numero: 2, total: null, personas: 1, faltaTarifa: true }], tardios: null, listosParaCertificar: [] };
    const [fila] = armarPendientes({ personas: [], mes: "2026-10", hoy: "2026-10-04", grupos, certificaciones: [sinTarifa] });
    expect(fila).toMatchObject({ detalle: "Falta definir la tarifa antes de pagar", monto: null, tono: "warn" });
  });
});
