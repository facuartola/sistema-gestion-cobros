import {
  cobradoPorMetodo,
  distribucionSesiones,
  estadoDeCobrosDelMes,
  gastosPorGrupo,
  indicadoresDelMes,
  mesesDeTendencia,
  mesesDelPeriodo,
  proximosDias,
  proyeccionDelMes,
  quienDebe,
  serieMensual,
  tasaDeCobranza,
} from "./panorama";

// Valores por defecto seguros para lo que Inicio recibe de /api/resumen y
// /api/panorama. Una respuesta vieja, vacía o con campos faltantes (o con un
// campo de otra forma) nunca debe romper el dibujo de la pantalla: las listas
// faltantes son listas vacías y los números faltantes son ceros.
// Falla real que motivó esto: "e is not iterable" al dibujar Inicio (se
// esparcía `resumen.proximos` cuando no venía como lista).

export const lista = (x) => (Array.isArray(x) ? x : []);

const aNumero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const esObjeto = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

function normalizarGastosPorPagar(g) {
  if (!esObjeto(g)) return { items: [], total: 0, conMonto: 0, sinMonto: 0 };
  const items = lista(g.items);
  return { ...g, items, total: aNumero(g.total), conMonto: aNumero(g.conMonto), sinMonto: aNumero(g.sinMonto) };
}

function normalizarCertificaciones(certs) {
  if (!Array.isArray(certs)) return null;
  return certs.filter(esObjeto).map((c) => ({
    ...c,
    modulosListos: lista(c.modulosListos),
    listosParaCertificar: lista(c.listosParaCertificar),
  }));
}

// Devuelve null si no hay nada utilizable.
export function normalizarResumen(r) {
  if (!esObjeto(r)) return null;
  return {
    ...r,
    serie: lista(r.serie),
    gastosPorPagar: normalizarGastosPorPagar(r.gastosPorPagar),
    gastos: lista(r.gastos),
    proximos: lista(r.proximos),
    movimientos: lista(r.movimientos),
    certificaciones: normalizarCertificaciones(r.certificaciones),
  };
}

export function normalizarPanorama(p) {
  if (!esObjeto(p)) return null;
  const diarios = esObjeto(p.diarios) ? { cobros: lista(p.diarios.cobros), gastos: lista(p.diarios.gastos) } : null;
  return {
    ...p,
    cobros: lista(p.cobros),
    gastos: lista(p.gastos),
    pagos: lista(p.pagos),
    diarios,
  };
}

// --- Todo lo que Inicio calcula, con respaldo -------------------------------------------------------

const aviso = (nombre, error) => {
  if (typeof console !== "undefined") console.error(`[inicio] ${nombre}:`, error);
};

// Corre `fn`; si falla (un dato con una forma que nadie previó), devuelve el
// valor por defecto en vez de tumbar la pantalla.
export function conRespaldo(nombre, fn, porDefecto) {
  try {
    return fn();
  } catch (error) {
    aviso(nombre, error);
    return typeof porDefecto === "function" ? porDefecto() : porDefecto;
  }
}

// Calcula todos los números y series del panel. Cualquier entrada vacía,
// ausente o rara da listas vacías y ceros.
export function calcularInicio({ personas, panorama, resumen, categorias, periodo, mesActual, hoy, ahora, avance }) {
  const ps = lista(personas);
  const cobros = lista(panorama?.cobros);
  const gastosVista = lista(panorama?.gastos);
  const diarios = panorama?.diarios ?? null;
  const mesesTendencia = mesesDeTendencia(periodo, mesActual);
  const mesesReparto = mesesDelPeriodo(periodo, mesActual);
  const gp = resumen?.gastosPorPagar;

  const ind = conRespaldo("indicadores", () => indicadoresDelMes(cobros, gastosVista, mesActual, 6, diarios ? { hoy, cobros: diarios.cobros, gastos: diarios.gastos } : null), () =>
    indicadoresDelMes([], [], mesActual, 6, null)
  );
  const estado = conRespaldo("estado de cobros", () => estadoDeCobrosDelMes(ps, mesActual, ahora), () => estadoDeCobrosDelMes([], mesActual, ahora));
  return {
    ind,
    estado,
    tasa: tasaDeCobranza(estado),
    serie: conRespaldo("serie mensual", () => serieMensual(cobros, gastosVista, mesesTendencia), () => serieMensual([], [], mesesTendencia)),
    porMetodo: conRespaldo("cobros por método", () => cobradoPorMetodo(cobros, mesesReparto), []),
    porGrupo: conRespaldo("gastos por tipo", () => gastosPorGrupo(gastosVista, mesesReparto, 5, lista(categorias)), []),
    debe: conRespaldo("quién debe", () => quienDebe(ps, mesActual, hoy, ahora), { total: 0, items: [] }),
    prox: conRespaldo("próximos 30 días", () => proximosDias({ personas: ps, categorias: lista(categorias).filter((c) => c?.activo), pagos: lista(panorama?.pagos), hoy }), () =>
      proximosDias({ personas: [], categorias: [], pagos: [], hoy })
    ),
    proy: proyeccionDelMes({
      cobrado: ind.cobrado.valor,
      porCobrar: estado.porCobrar,
      gastado: ind.gastado.valor,
      gastosPorPagar: gp?.total ?? 0,
      gastosSinMonto: gp?.sinMonto ?? 0,
    }),
    distSesiones: conRespaldo("alumnos por sesiones", () => distribucionSesiones(lista(avance)), () => distribucionSesiones([])),
  };
}
