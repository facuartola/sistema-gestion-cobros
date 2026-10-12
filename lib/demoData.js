import { hoyArgentinaISO, sumarDiasISO, cuotaAtrasada, diasDelMes } from "./fechas";

const NOMBRES_JUGADORES = [
  "Lucas Medina",
  "Martina Sosa",
  "Bruno Ferreyra",
  "Camila Ríos",
  "Tomás Aguirre",
  "Valentina Paz",
  "Nicolás Gómez",
  "Julieta Acosta",
];

const NOMBRES_ALUMNOS = [
  "Rocío Herrera",
  "Federico Luna",
  "Agustina Varela",
  "Ezequiel Molina",
  "Lucía Campos",
  "Santiago Bravo",
];

// Genera jugadores, alumnos y recordatorios de ejemplo con fechas relativas
// a "hoy" (ahoraISO, "YYYY-MM-DD" en hora Argentina por defecto — ver
// hoyArgentinaISO en lib/fechas.js), para que /demo siempre muestre al menos
// un atrasado y un vencimiento próximo sin importar cuándo se abra.
//
// Único caso límite conocido: el día 1 de un mes nadie puede mostrar el
// badge "Atrasado" todavía (por la propia regla de cuotaAtrasada: un
// vencimiento no puede haber pasado antes de que el mes empiece) — ese día
// puntual la demo igual muestra deuda arrastrada ("debe N meses") en su
// lugar, que cumple el mismo propósito de "hay algo urgente para mostrar".
export function generarDatosDemo(ahoraISO = hoyArgentinaISO()) {
  const hoy = ahoraISO;
  const mesActual = hoy.slice(0, 7);
  const diaHoy = Number(hoy.slice(8, 10));
  const ultimoDia = diasDelMes(mesActual);
  // Las 15 hs de "hoy" en hora Argentina (UTC-3 fijo, sin horario de verano).
  const ahora = new Date(`${hoy}T15:00:00-03:00`);

  const diaVencido = Math.max(1, diaHoy - 1); // 1 día atrasado, salvo el propio día 1 del mes
  const diaProximo = Math.min(ultimoDia, diaHoy + 2); // vence en <= 2 días

  function conDeuda(estado, diaVencimiento) {
    if (estado !== "pendiente" || !diaVencimiento) return 0;
    return cuotaAtrasada(mesActual, diaVencimiento, ahora) ? 1 : 0;
  }

  const jugadores = NOMBRES_JUGADORES.map((nombre, i) => {
    const montoMensual = 120 + (i % 4) * 15;
    let diaVencimiento;
    let estado;
    let fechaPago = null;

    if (i === 0) {
      diaVencimiento = diaVencido;
      estado = "pendiente";
    } else if (i === 1) {
      diaVencimiento = diaProximo;
      estado = "pendiente";
    } else if (i === 2) {
      diaVencimiento = null; // sin día cargado: dispara la sugerencia de "antes de fin de mes"
      estado = "pendiente";
    } else {
      diaVencimiento = ((i * 7) % 27) + 1;
      estado = i % 2 === 0 ? "pagado" : "pendiente";
      if (estado === "pagado") fechaPago = sumarDiasISO(hoy, -(i % 6));
    }

    return {
      id: `demo-jugador-${i}`,
      tipo: "jugador",
      nombre,
      monto_mensual: montoMensual,
      dia_vencimiento: diaVencimiento,
      contacto: i % 2 === 0 ? `11 4${i}00 55${i}${i}` : `${nombre.split(" ")[0].toLowerCase()}@ejemplo.com`,
      notas: null,
      activo: true,
      // Dos jugadores arrastran deuda de meses anteriores (aunque este mes todavía no venza).
      meses_adeudados: conDeuda(estado, diaVencimiento) * (1 + (i % 3)) + (estado === "pendiente" ? (i === 3 ? 2 : i === 5 ? 1 : 0) : 0),
      total_anio: montoMensual * (5 + (i % 5)),
      cuota_actual: { estado, monto: montoMensual, fecha_pago: fechaPago, metodo_pago: estado === "pagado" ? (i % 2 ? "efectivo" : "transferencia") : null },
    };
  });

  const PROPORCIONES_ABONADO = [0.2, 0.5, 0.85, 0.95, 0.35, 0];

  const alumnos = NOMBRES_ALUMNOS.map((nombre, i) => {
    const montoMensual = 80 + (i % 3) * 10;
    const montoTotal = i === 5 ? null : 1000 + i * 150; // uno sin monto_total: "pago mensual sin techo"
    const totalAbonado = montoTotal ? Math.round(montoTotal * PROPORCIONES_ABONADO[i]) : 0;
    const diaVencimiento = i === 1 ? diaVencido : ((i * 9) % 27) + 1;
    const estado = i === 1 || i % 2 !== 0 ? "pendiente" : "pagado";
    const fechaPago = estado === "pagado" ? sumarDiasISO(hoy, -(i % 4)) : null;

    return {
      id: `demo-alumno-${i}`,
      tipo: "alumno",
      nombre,
      monto_mensual: montoMensual,
      monto_total: montoTotal,
      total_abonado: totalAbonado,
      dia_vencimiento: diaVencimiento,
      contacto: i % 2 === 0 ? `${nombre.split(" ")[0].toLowerCase()}@ejemplo.com` : `11 4${i}55 66${i}${i}`,
      notas: null,
      activo: true,
      meses_adeudados: conDeuda(estado, diaVencimiento) * (1 + (i % 2)),
      total_anio: montoMensual * (4 + (i % 6)),
      cuota_actual: { estado, monto: montoMensual, fecha_pago: fechaPago, metodo_pago: estado === "pagado" ? (i % 2 ? "efectivo" : "transferencia") : null },
    };
  });

  const recordatoriosBase = [
    {
      titulo: `Cobrar a ${jugadores[0].nombre}`,
      fecha: sumarDiasISO(hoy, -2),
      tipo: "cobro",
      nota: "Vencido, todavía sin respuesta.",
      jugador_id: jugadores[0].id,
      alumno_id: null,
      hecho: false,
    },
    {
      titulo: `Llamar a ${alumnos[1].nombre}`,
      fecha: hoy,
      tipo: "cobro",
      nota: null,
      jugador_id: null,
      alumno_id: alumnos[1].id,
      hecho: false,
    },
    {
      titulo: "Preparar material de la certificación",
      fecha: sumarDiasISO(hoy, 3),
      tipo: "general",
      nota: null,
      jugador_id: null,
      alumno_id: null,
      hecho: false,
    },
    {
      titulo: `Seguimiento a ${alumnos[2].nombre}`,
      fecha: sumarDiasISO(hoy, 5),
      tipo: "seguimiento",
      nota: "Está por completar el monto total.",
      jugador_id: null,
      alumno_id: alumnos[2].id,
      hecho: false,
    },
    {
      titulo: "Revisar cuentas del mes",
      fecha: sumarDiasISO(hoy, -6),
      tipo: "general",
      nota: null,
      jugador_id: null,
      alumno_id: null,
      hecho: true,
      hecho_en: `${sumarDiasISO(hoy, -5)}T10:00:00.000Z`,
    },
    {
      titulo: `Hablar con ${jugadores[3].nombre} sobre el pago`,
      fecha: sumarDiasISO(hoy, 1),
      tipo: "cobro",
      nota: null,
      jugador_id: jugadores[3].id,
      alumno_id: null,
      hecho: false,
    },
  ];

  const recordatorios = recordatoriosBase.map((r, i) => ({ id: `demo-recordatorio-${i}`, ...r }));

  return { jugadores, alumnos, recordatorios };
}
