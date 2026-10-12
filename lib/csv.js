// "Certificación 2026" -> "certificacion-2026": para nombres de archivo.
export function aNombreDeArchivo(texto) {
  return (
    String(texto ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "archivo"
  );
}

// Un texto que empieza con =, +, @ o un tabulador Excel lo toma como fórmula
// (inyección de fórmulas en CSV). Se le antepone un apóstrofo, que Excel no
// muestra. Los números quedan como están, así se pueden sumar.
export function celdaSegura(valor) {
  if (typeof valor !== "string") return valor;
  return /^[=+@\t\r]/.test(valor) ? `'${valor}` : valor;
}

// Con la configuración regional de Argentina (y de casi toda Latinoamérica y
// Europa) Excel usa la coma como separador decimal y espera el punto y coma
// entre columnas: un CSV con comas se abre todo en una sola columna. Se elige
// según cómo escribe los decimales el navegador: coma decimal (por ejemplo
// es-AR) -> ";", punto decimal (por ejemplo en-US) -> ",".
//
// Dos casos no los resuelve el idioma del navegador y se tratan como coma decimal
// porque la app se usa en Argentina, donde Excel espera ";" y un CSV con comas
// se abre en una sola columna:
//  - "es-419" (español de Latinoamérica, sin país): ICU usa punto decimal.
//  - Un navegador en "es-US" (así informa el Chrome de esta instalación) o en
//    inglés, pero con la zona horaria de Argentina (America/Argentina/... o el
//    nombre viejo America/Buenos_Aires, que es el que informa Chrome en Windows).
export function separadorParaLocale(locale, zonaHoraria = "") {
  if (/^es-419$/i.test(String(locale ?? "")) || /^America\/(Argentina\/|Buenos_Aires$)/.test(String(zonaHoraria))) return ";";
  try {
    const decimal = new Intl.NumberFormat(locale || undefined).formatToParts(1.1).find((p) => p.type === "decimal")?.value;
    return decimal === "," ? ";" : ",";
  } catch {
    return ",";
  }
}

export function separadorDelNavegador() {
  let zona = "";
  try {
    zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Sin zona horaria, decide solo el idioma.
  }
  return separadorParaLocale(typeof navigator !== "undefined" ? navigator.language : undefined, zona);
}

// Una celda: siempre entre comillas, con las comillas internas duplicadas (los
// saltos de línea quedan dentro de las comillas, que es como los entiende
// Excel). Con ";" los números llevan coma decimal para que Excel los tome como
// número y no como texto.
export function celdaCSV(valor, separador = ",") {
  const seguro = celdaSegura(valor);
  const texto = typeof seguro === "number" && separador === ";" ? String(seguro).replace(".", ",") : String(seguro ?? "");
  return `"${texto.replace(/"/g, '""')}"`;
}

// El contenido del CSV (sin el BOM): encabezado y una línea por fila, con
// finales de línea CRLF.
export function armarCSV(filas, columnas, separador = ",") {
  const encabezado = columnas.map((c) => celdaCSV(c.label, separador)).join(separador);
  const cuerpo = filas.map((fila) => columnas.map((c) => celdaCSV(c.value(fila), separador)).join(separador));
  return [encabezado, ...cuerpo].join("\r\n");
}

// Genera y dispara la descarga de un CSV a partir de filas de objetos. Lleva el
// BOM de UTF-8 (para que Excel respete las tildes) y el separador que le sirve
// a la configuración regional del navegador.
export function descargarCSV(nombreArchivo, filas, columnas, separador = separadorDelNavegador()) {
  const csv = armarCSV(filas, columnas, separador);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
