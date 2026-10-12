// Datos del panel de Inicio para /demo: 12 meses de historia coherente, con
// tendencia creciente, hechos con la misma forma que las vistas de la base
// (cobros_mensuales y gastos_mensuales_por_tipo). El mes actual sale de lo que
// hay en memoria (cuotas pagadas y pagos de gasto), así que lo que se cargue en
// la demo se ve en los gráficos; los meses anteriores son un historial
// inventado, estable y repetible. Nunca llama a la API.
import { sumarMesesISO } from "./fechas";
import { SEPARADOR_VISTA, agruparPorDia } from "./panorama";

const MESES_HISTORIA = 12;

// Número pseudoaleatorio estable (misma demo, mismos gráficos): 0 a 1.
function ruido(k, salto = 1) {
  const x = Math.sin((k + 1) * 12.9898 * salto) * 43758.5453;
  return x - Math.floor(x);
}

const redondear = (n, paso = 5) => Math.round(n / paso) * paso;

function rutaDe(id, porId) {
  const partes = [];
  const vistos = new Set();
  let actual = porId.get(id);
  while (actual && !vistos.has(actual.id)) {
    vistos.add(actual.id);
    partes.unshift(actual.nombre);
    actual = actual.parent_id ? porId.get(actual.parent_id) : null;
  }
  return partes;
}

// Cuánto se paga cada mes en cada tipo de gasto final, según su nombre: un fijo
// pesa lo mismo todos los meses, lo variable sube y baja, y el equipo de
// coaches arranca hace poco (la certificación empezó hace unos 70 días).
function gastoDelMes(categoria, k) {
  const crecimiento = 1 + k * 0.035;
  switch (categoria.nombre) {
    case "Wifi":
      return 45;
    case "Celulares":
      return 60;
    case "Mantenimiento":
      return 100;
    case "Consultora de marketing":
      return redondear((90 + ruido(k, 2) * 90) * crecimiento);
    case "Producciones fotográficas y videos":
      return ruido(k, 3) > 0.6 ? redondear((220 + ruido(k, 4) * 200) * crecimiento) : 0;
    case "Desarrollo":
      return k % 4 === 1 ? redondear(420 * crecimiento) : 0;
    case "Pago de sesiones":
      return k >= MESES_HISTORIA - 3 ? redondear(90 + (k - (MESES_HISTORIA - 3)) * 60 + ruido(k, 5) * 30) : 0;
    case "Pago de encuentros":
      return k >= MESES_HISTORIA - 3 ? redondear(60 + (k - (MESES_HISTORIA - 3)) * 45 + ruido(k, 6) * 20) : 0;
    default:
      return 0;
  }
}

// personas: jugadores y alumnos de la demo (con cuota_actual); categorias y
// pagos: lo de lib/gastosDemo.js; hoy: "YYYY-MM-DD".
export function generarPanoramaDemo({ personas, categorias, pagos, hoy }) {
  const mesActual = hoy.slice(0, 7);
  const desde = `${sumarMesesISO(mesActual, -12)}-01`;
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const hijos = new Set(categorias.filter((c) => c.parent_id).map((c) => c.parent_id));
  const hojas = categorias.filter((c) => c.activo && !hijos.has(c.id));

  // --- Cobros ---------------------------------------------------------------
  const esperado = personas.reduce((acc, p) => acc + Number(p.monto_mensual || 0), 0) || 1500;
  const cobros = [];
  for (let k = 0; k < MESES_HISTORIA; k++) {
    const mes = `${sumarMesesISO(mesActual, k - MESES_HISTORIA)}-01`;
    // De ~45 % de lo esperado hace un año a ~95 % el mes pasado, con altibajos.
    const total = redondear(esperado * (0.45 + k * 0.045 + (ruido(k, 7) - 0.5) * 0.08));
    const jugadores = redondear(total * (0.58 + ruido(k, 8) * 0.06));
    const alumnos = total - jugadores;
    // Los cobros más viejos no tenían método: es lo que muestra la demo.
    const antiguo = k < 3;
    for (const [origen, monto] of [["jugadores", jugadores], ["alumnos", alumnos]]) {
      const partes = antiguo ? { sin_metodo: 0.4, efectivo: 0.25, transferencia: 0.35 } : { efectivo: 0.3, transferencia: 0.7 };
      for (const [metodo, parte] of Object.entries(partes)) {
        const t = redondear(monto * parte);
        if (t > 0) cobros.push({ mes, origen, metodo, total: t, cantidad: Math.max(1, Math.round(t / (origen === "jugadores" ? 135 : 90))) });
      }
    }
  }
  // Mes actual: las cuotas pagadas que hay en memoria, por mes de su fecha de pago.
  const actuales = new Map();
  for (const p of personas) {
    const c = p.cuota_actual;
    if (c?.estado !== "pagado" || !c.fecha_pago) continue;
    const clave = `${c.fecha_pago.slice(0, 7)}-01|${p.tipo === "alumno" ? "alumnos" : "jugadores"}|${c.metodo_pago || "sin_metodo"}`;
    const fila = actuales.get(clave) || { total: 0, cantidad: 0 };
    fila.total += Number(c.monto);
    fila.cantidad += 1;
    actuales.set(clave, fila);
  }
  for (const [clave, f] of actuales) {
    const [mes, origen, metodo] = clave.split("|");
    cobros.push({ mes, origen, metodo, total: f.total, cantidad: f.cantidad });
  }

  // --- Gastos ---------------------------------------------------------------
  const gastos = [];
  for (let k = 0; k < MESES_HISTORIA; k++) {
    const mes = `${sumarMesesISO(mesActual, k - MESES_HISTORIA)}-01`;
    for (const c of hojas) {
      const total = gastoDelMes(c, k);
      if (total <= 0) continue;
      const partes = rutaDe(c.id, porId);
      gastos.push({ mes, categoria_id: c.id, ruta: partes.join(SEPARADOR_VISTA), nivel: partes.length, total, cantidad: 1 });
    }
  }
  const delMes = new Map();
  for (const p of pagos) {
    const clave = `${p.fecha_pago.slice(0, 7)}-01|${p.categoria_id}`;
    const fila = delMes.get(clave) || { total: 0, cantidad: 0 };
    fila.total += Number(p.monto);
    fila.cantidad += 1;
    delMes.set(clave, fila);
  }
  for (const [clave, f] of delMes) {
    const [mes, categoriaId] = clave.split("|");
    if (mes.slice(0, 7) < mesActual) continue; // los meses pasados ya están arriba
    const partes = rutaDe(categoriaId, porId);
    gastos.push({ mes, categoria_id: categoriaId, ruta: partes.join(SEPARADOR_VISTA), nivel: partes.length, total: f.total, cantidad: f.cantidad });
  }

  // --- Movimientos por día (para comparar contra el mismo tramo del mes anterior) ---
  // El mes anterior se reparte en seis días a lo largo del mes (es historia
  // inventada); el actual sale de lo que hay en memoria.
  const anterior = sumarMesesISO(mesActual, -1);
  const repartir = (total) => {
    const dias = [3, 7, 12, 16, 21, 26];
    const parte = Math.floor(total / dias.length);
    return dias.map((d, i) => ({ fecha_pago: `${anterior}-${String(d).padStart(2, "0")}`, monto: i === dias.length - 1 ? total - parte * (dias.length - 1) : parte }));
  };
  const totalDe = (filas, mes) => filas.filter((f) => String(f.mes).slice(0, 7) === mes).reduce((acc, f) => acc + Number(f.total), 0);
  const cobrosDiarios = [
    ...repartir(totalDe(cobros, anterior)),
    ...personas
      .filter((p) => p.cuota_actual?.estado === "pagado" && p.cuota_actual.fecha_pago?.slice(0, 7) === mesActual && p.cuota_actual.fecha_pago <= hoy)
      .map((p) => ({ fecha_pago: p.cuota_actual.fecha_pago, monto: p.cuota_actual.monto })),
  ];
  const gastosDiarios = [
    ...repartir(totalDe(gastos, anterior)),
    ...pagos.filter((p) => p.fecha_pago.slice(0, 7) === mesActual && p.fecha_pago <= hoy).map((p) => ({ fecha_pago: p.fecha_pago, monto: p.monto })),
  ];

  return {
    mes: mesActual,
    desde,
    cobros,
    gastos,
    pagos: pagos.map((p) => ({ categoria_id: p.categoria_id, fecha_pago: p.fecha_pago, periodo: p.periodo })),
    diarios: { cobros: agruparPorDia(cobrosDiarios), gastos: agruparPorDia(gastosDiarios) },
  };
}
