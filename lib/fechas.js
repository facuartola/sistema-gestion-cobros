// Helpers de fecha. Regla de toda la app: "hoy", "este mes", "atrasado" y la
// hora del saludo se calculan SIEMPRE en hora Argentina, sin importar el huso
// del navegador (la clienta puede abrir la app de viaje, o con el celular en otra
// zona) ni el del servidor (Netlify/Vercel corren en UTC).
//
// Por qué no usar toISOString() ni getDate(): el primero convierte a UTC y el
// segundo usa el huso de la máquina. Argentina es UTC-3, así que entre las
// 21:00 y las 23:59 la fecha UTC ya es la del día siguiente: el último día del
// mes a las 22:00 daría el mes SIGUIENTE. Acá se piden los componentes de
// fecha a Intl con timeZone fijo.
//
// Las fechas "de calendario" ("YYYY-MM-DD" / "YYYY-MM" ya calculados) se
// operan en UTC puro: no representan un instante, así que no deben pasar por
// ningún huso.

export const ZONA_ARGENTINA = "America/Argentina/Buenos_Aires";

const dos = (n) => String(n).padStart(2, "0");

const formatoPartes = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_ARGENTINA,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  hourCycle: "h23",
});

// { anio, mes (1-12), dia, hora (0-23) } del instante dado, en hora Argentina.
export function partesArgentina(fecha = new Date()) {
  const partes = {};
  for (const { type, value } of formatoPartes.formatToParts(fecha)) partes[type] = value;
  return {
    anio: Number(partes.year),
    mes: Number(partes.month),
    dia: Number(partes.day),
    hora: Number(partes.hour),
  };
}

// "YYYY-MM-DD" en hora Argentina del instante dado (default: ahora).
export function hoyArgentinaISO(fecha = new Date()) {
  const { anio, mes, dia } = partesArgentina(fecha);
  return `${anio}-${dos(mes)}-${dos(dia)}`;
}

// "YYYY-MM" en hora Argentina del instante dado (default: ahora).
export function mesArgentinaISO(fecha = new Date()) {
  return hoyArgentinaISO(fecha).slice(0, 7);
}

// "YYYY-MM" en hora Argentina de un timestamp cualquiera (ej. un created_at
// que viene de la base en UTC).
export function mesArgentinaDe(fechaConTZ) {
  return mesArgentinaISO(new Date(fechaConTZ));
}

// "YYYY-MM-DD" en hora Argentina de un timestamp (ej. hecho_en). No sirve
// cortar el string ISO: está en UTC, y después de las 21 hs de Argentina ya
// es el día siguiente.
export function diaArgentinaDe(fechaConTZ) {
  return hoyArgentinaISO(new Date(fechaConTZ));
}

// Cantidad de días del mes "YYYY-MM".
export function diasDelMes(mesISO) {
  const [anio, mes] = mesISO.split("-").map(Number);
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

// ¿Una cuota pendiente del mes "YYYY-MM" ya está atrasada?
// - Sin dia_vencimiento: nunca (se mantiene "pendiente" a secas).
// - Mes anterior al actual: sí, el vencimiento ya pasó.
// - Mes actual: sí si hoy es posterior al día de vencimiento (el propio día de
//   vencimiento todavía está en fecha). Un día 31 en un mes de 30 días vence el 30.
// - Mes futuro: no.
// "Actual" y "hoy" son en hora Argentina, también cuando corre en el servidor.
export function cuotaAtrasada(mes, diaVencimiento, ahora = new Date()) {
  if (!diaVencimiento) return false;
  const mesActual = mesArgentinaISO(ahora);
  if (mes < mesActual) return true;
  if (mes > mesActual) return false;
  return partesArgentina(ahora).dia > Math.min(diaVencimiento, diasDelMes(mes));
}

// Suma (o resta, con negativo) días a una fecha "YYYY-MM-DD" y devuelve el
// resultado en el mismo formato. Aritmética de calendario pura (UTC).
export function sumarDiasISO(fechaISO, dias) {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return fecha.toISOString().slice(0, 10);
}

// Suma (o resta) meses a "YYYY-MM".
export function sumarMesesISO(mesISO, meses) {
  const [anio, mes] = mesISO.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1 + meses, 1)).toISOString().slice(0, 7);
}

// "Septiembre de 2026" a partir de "YYYY-MM".
export function mesLabel(mesISO) {
  const [anio, mes] = mesISO.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, 1));
  const label = d.toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// "04/10/2026" a partir de "2026-10-04" (para tablas y exportaciones).
export function fechaDMA(fechaISO) {
  const [anio, mes, dia] = String(fechaISO).split("-");
  return `${dia}/${mes}/${anio}`;
}

// Fecha y hora legibles de un timestamp, en hora Argentina (ej. para el
// listado de errores).
// Siempre en 24 horas: algunos navegadores usan 12 horas sin "a. m./p. m." y
// "08:53" terminaba siendo las 20:53.
export function fechaHoraArgentina(fechaConTZ) {
  return new Date(fechaConTZ).toLocaleString("es-AR", {
    timeZone: ZONA_ARGENTINA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

// Lista de meses "YYYY-MM" entre mesInicio y mesFin, ambos incluidos y en
// orden ascendente. Si mesInicio es posterior a mesFin, devuelve [].
export function mesesEntre(mesInicio, mesFin) {
  if (mesInicio > mesFin) return [];
  const meses = [];
  let [anio, mes] = mesInicio.split("-").map(Number);
  const [anioFin, mesFinNum] = mesFin.split("-").map(Number);
  // Tope de seguridad: nunca hace falta iterar más de unas décadas de meses.
  for (let i = 0; i < 1200; i++) {
    meses.push(`${anio}-${dos(mes)}`);
    if (anio === anioFin && mes === mesFinNum) break;
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }
  return meses;
}
