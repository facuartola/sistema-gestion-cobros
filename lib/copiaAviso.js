// Aviso de copia: cuándo fue la última descarga. La fecha vive solo en este
// navegador (localStorage): no se guarda en la base. Cada lectura y escritura va
// con try/catch porque el almacenamiento puede no estar disponible (ventana
// privada, datos bloqueados).
import { CLAVES_NAVEGADOR } from "./navegador";

const DIAS_AVISO = 30;

export function leerUltimaCopia() {
  try {
    const valor = window.localStorage.getItem(CLAVES_NAVEGADOR.ultimaCopia);
    return valor && !Number.isNaN(new Date(valor).getTime()) ? valor : null;
  } catch {
    return null;
  }
}

export function guardarUltimaCopia(ahora = new Date()) {
  try {
    window.localStorage.setItem(CLAVES_NAVEGADOR.ultimaCopia, ahora.toISOString());
  } catch {
    // Sin almacenamiento, el aviso seguirá apareciendo: no es grave.
  }
}

// Días enteros desde la última copia (null si nunca se hizo).
export function diasSinCopia(ultimaISO, ahora = new Date()) {
  if (!ultimaISO) return null;
  const ms = ahora.getTime() - new Date(ultimaISO).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

// { mostrar, texto }: se avisa si nunca se hizo una copia o pasaron más de 30 días.
export function avisoDeCopia(ultimaISO, ahora = new Date()) {
  const dias = diasSinCopia(ultimaISO, ahora);
  if (dias === null) return { mostrar: true, texto: "Todavía no descargaste una copia de tus datos." };
  if (dias > DIAS_AVISO) return { mostrar: true, texto: `Hace ${dias} días que no descargás una copia.` };
  return { mostrar: false, texto: "" };
}
