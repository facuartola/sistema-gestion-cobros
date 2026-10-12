import { formatoDolares } from "./moneda";
import { cuotaAtrasada, diasDelMes, hoyArgentinaISO, mesArgentinaISO, partesArgentina } from "./fechas";

// Sugerencias calculadas al vuelo a partir de los datos reales de jugadores y
// alumnos (nunca se guardan en la base). Cada una trae los datos ya armados
// para precargar un recordatorio real con un click.
//
// personas: [{ id, nombre, tipo: "jugador"|"alumno", cuota_actual, monto_mensual,
//              dia_vencimiento, monto_total, total_abonado }]
export function calcularSugerencias(personas, ahora = new Date()) {
  const hoy = hoyArgentinaISO(ahora);
  const mesActual = mesArgentinaISO(ahora);
  const diaHoy = partesArgentina(ahora).dia;
  const ultimoDiaMes = diasDelMes(mesActual);

  const sugerencias = [];

  for (const p of personas) {
    const estado = p.cuota_actual?.estado || "pendiente";
    const monto = p.cuota_actual?.monto ?? p.monto_mensual;
    const pendiente = estado !== "pagado";

    if (pendiente && cuotaAtrasada(mesActual, p.dia_vencimiento, ahora)) {
      sugerencias.push({
        clave: `atraso-${p.tipo}-${p.id}`,
        texto: `Cobrar a ${p.nombre}: debe ${formatoDolares(monto)}, venció el día ${p.dia_vencimiento}.`,
        prefill: {
          titulo: `Cobrar a ${p.nombre}`,
          nota: `Debe ${formatoDolares(monto)}, venció el día ${p.dia_vencimiento}.`,
          fecha: hoy,
          tipo: "cobro",
          jugador_id: p.tipo === "jugador" ? p.id : null,
          alumno_id: p.tipo === "alumno" ? p.id : null,
        },
      });
      continue; // ya está atrasada, no tiene sentido avisar que "vence pronto"
    }

    if (pendiente && p.dia_vencimiento) {
      const diaEfectivo = Math.min(p.dia_vencimiento, ultimoDiaMes);
      const diasParaVencer = diaEfectivo - diaHoy;
      if (diasParaVencer >= 0 && diasParaVencer <= 3) {
        sugerencias.push({
          clave: `vence-${p.tipo}-${p.id}`,
          texto:
            diasParaVencer === 0
              ? `La cuota de ${p.nombre} vence hoy.`
              : `La cuota de ${p.nombre} vence en ${diasParaVencer} día${diasParaVencer === 1 ? "" : "s"} (día ${p.dia_vencimiento}).`,
          prefill: {
            titulo: `Cobrar a ${p.nombre}`,
            nota: `Vence el día ${p.dia_vencimiento} de este mes.`,
            fecha: hoy,
            tipo: "cobro",
            jugador_id: p.tipo === "jugador" ? p.id : null,
            alumno_id: p.tipo === "alumno" ? p.id : null,
          },
        });
      }
    }

    if (p.tipo === "alumno" && p.monto_total && p.total_abonado != null) {
      const proporcion = p.total_abonado / p.monto_total;
      if (proporcion >= 0.8 && proporcion < 1) {
        const falta = p.monto_total - p.total_abonado;
        sugerencias.push({
          clave: `completando-${p.id}`,
          texto: `${p.nombre} está por completar su monto total: pagó ${formatoDolares(p.total_abonado)} de ${formatoDolares(p.monto_total)}, faltan ${formatoDolares(falta)}.`,
          prefill: {
            titulo: `Seguimiento a ${p.nombre}`,
            nota: `Le faltan ${formatoDolares(falta)} para completar el monto total.`,
            fecha: hoy,
            tipo: "seguimiento",
            jugador_id: null,
            alumno_id: p.id,
          },
        });
      }
    }
  }

  // Cierre de mes: alguien sin día de vencimiento cargado nunca se marca
  // "atrasado" solo, así que sin este aviso la clienta podría no notar en meses
  // que sigue pendiente. Se dispara en los últimos días del mes.
  if (ultimoDiaMes - diaHoy <= 4) {
    for (const p of personas) {
      const estado = p.cuota_actual?.estado || "pendiente";
      if (estado !== "pagado" && !p.dia_vencimiento) {
        sugerencias.push({
          clave: `cierre-mes-${p.tipo}-${p.id}`,
          texto: `Antes de fin de mes: ${p.nombre} sigue pendiente y no tiene día de vencimiento cargado.`,
          prefill: {
            titulo: `Revisar pago de ${p.nombre} antes de fin de mes`,
            nota: "No tiene día de vencimiento cargado, no se marca atrasado solo.",
            fecha: hoy,
            tipo: "cobro",
            jugador_id: p.tipo === "jugador" ? p.id : null,
            alumno_id: p.tipo === "alumno" ? p.id : null,
          },
        });
      }
    }
  }

  return sugerencias;
}
