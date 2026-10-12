const TAMANO_PAGINA = 1000;

// Trae TODAS las cuotas de una tabla (jugadores o alumnos), paginando de a
// 1000 filas: PostgREST corta ahí, y un historial truncado daría totales o
// "meses adeudados" silenciosamente incorrectos.
async function obtenerTodasLasCuotas(supabase, tabla, columnaPersona) {
  let filas = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await supabase
      .from(tabla)
      .select(`${columnaPersona}, mes, monto, estado`)
      .order(columnaPersona)
      .order("mes")
      .range(desde, desde + TAMANO_PAGINA - 1);
    if (error) return { error };
    filas = filas.concat(data || []);
    if (!data || data.length < TAMANO_PAGINA) break;
  }
  return { filas };
}

// Arma, por persona, el conjunto de meses "YYYY-MM" pagados, el total
// histórico abonado y el total abonado en el año dado.
export async function resumenHistoricoPorPersona(supabase, tabla, columnaPersona, anio) {
  const { filas, error } = await obtenerTodasLasCuotas(supabase, tabla, columnaPersona);
  if (error) return { error };

  const mesesPagadosPorPersona = {};
  const totalAbonadoPorPersona = {};
  const totalAnioPorPersona = {};

  for (const c of filas) {
    if (c.estado !== "pagado") continue;
    const id = c[columnaPersona];
    const mes = c.mes.slice(0, 7); // "YYYY-MM-DD" -> "YYYY-MM"
    const monto = Number(c.monto);

    if (!mesesPagadosPorPersona[id]) mesesPagadosPorPersona[id] = new Set();
    mesesPagadosPorPersona[id].add(mes);

    totalAbonadoPorPersona[id] = (totalAbonadoPorPersona[id] || 0) + monto;
    if (mes.slice(0, 4) === String(anio)) {
      totalAnioPorPersona[id] = (totalAnioPorPersona[id] || 0) + monto;
    }
  }

  return { mesesPagadosPorPersona, totalAbonadoPorPersona, totalAnioPorPersona };
}
