import { sumarDiasISO } from "./fechas";

// Agrupa recordatorios en los mismos baldes que usa la vista completa
// (/recordatorios) y el panel lateral compacto, para no tener dos copias de
// este criterio.
export function agruparRecordatorios(recordatorios, hoy) {
  const limite7 = sumarDiasISO(hoy, 7);
  const grupos = { vencidos: [], hoy: [], proximos: [], masAdelante: [], hechos: [] };

  for (const r of recordatorios) {
    if (r.hecho) {
      grupos.hechos.push(r);
    } else if (r.fecha < hoy) {
      grupos.vencidos.push(r);
    } else if (r.fecha === hoy) {
      grupos.hoy.push(r);
    } else if (r.fecha <= limite7) {
      grupos.proximos.push(r);
    } else {
      grupos.masAdelante.push(r);
    }
  }
  grupos.hechos.sort((a, b) => (b.hecho_en || "").localeCompare(a.hecho_en || ""));
  return grupos;
}

// Los grupos que ve la administradora en /recordatorios: Hoy (lo vencido va con lo de
// hoy: es lo que hay que hacer ya), Esta semana (los próximos 7 días), Más
// adelante y Hechos.
export function gruposParaPantalla(grupos) {
  return {
    hoy: [...grupos.vencidos, ...grupos.hoy],
    semana: grupos.proximos,
    masAdelante: grupos.masAdelante,
    hechos: grupos.hechos,
  };
}
