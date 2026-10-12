// Hora de un puñado de ciudades usando Intl.DateTimeFormat con timeZone
// (nunca offsets fijos a mano): así el horario de verano de Miami, o
// cualquier cambio de zona horaria en el futuro, se resuelven solos sin
// tocar este archivo.
const CIUDADES = [
  { id: "argentina", nombre: "Argentina", timeZone: "America/Argentina/Buenos_Aires" },
  { id: "miami", nombre: "Miami", timeZone: "America/New_York" },
  { id: "paraguay", nombre: "Paraguay", timeZone: "America/Asuncion" },
  { id: "mexico", nombre: "México", timeZone: "America/Mexico_City" },
];

// Referencia para marcar "día distinto": Argentina, porque es la zona de la
// app (lib/fechas.js) y la que usa la clienta para pensar "hoy".
const ZONA_REFERENCIA = "America/Argentina/Buenos_Aires";

function diaISOEnZona(fecha, timeZone) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    fecha
  );
}

function horaEnZona(fecha, timeZone) {
  // hourCycle: "h23" en vez de hour12: false — algunos motores devuelven
  // "24:00" para la medianoche con hour12: false; h23 siempre da "00:00".
  return new Intl.DateTimeFormat("es-AR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(fecha);
}

// Arma { id, nombre, hora: "HH:mm", diferenciaDias } para cada ciudad, a
// partir de una fecha dada (default: ahora). diferenciaDias es null si la
// ciudad está en el mismo día calendario que Argentina, o un entero (casi
// siempre negativo, porque las cuatro ciudades están al oeste de Argentina)
// si cae un día antes o después.
export function horasMundiales(fecha = new Date()) {
  const diaReferencia = diaISOEnZona(fecha, ZONA_REFERENCIA);

  return CIUDADES.map((ciudad) => {
    const diaCiudad = diaISOEnZona(fecha, ciudad.timeZone);
    let diferenciaDias = null;
    if (diaCiudad !== diaReferencia) {
      const msDia = 24 * 60 * 60 * 1000;
      diferenciaDias = Math.round((Date.parse(diaCiudad) - Date.parse(diaReferencia)) / msDia);
    }
    return {
      id: ciudad.id,
      nombre: ciudad.nombre,
      hora: horaEnZona(fecha, ciudad.timeZone),
      diferenciaDias,
    };
  });
}
