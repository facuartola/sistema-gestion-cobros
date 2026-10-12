import { partesArgentina } from "./fechas";

// Nombre con el que se saluda a cada cuenta al iniciar sesión. Para sumar a
// alguien, agregar su email (en minúsculas) acá. La marca del sistema
// ("Coaching deportivo" en sidebar, login y metadata) no depende de esto.
const NOMBRES_POR_EMAIL = {
  "admin@ejemplo.com": "Laura",
  "dev@ejemplo.com": "Facu",
};

export function nombreParaEmail(email) {
  const clave = (email || "").trim().toLowerCase();
  return Object.hasOwn(NOMBRES_POR_EMAIL, clave) ? NOMBRES_POR_EMAIL[clave] : null;
}

// Mañana 6-12, tarde 13-19, noche 20-5 (hora Argentina, como el resto de la app).
export function saludoSegunHora(hora) {
  if (hora >= 6 && hora < 13) return "Buenos días";
  if (hora >= 13 && hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

// { titulo: "Buenas tardes, Laura", subtitulo: null } para un email con
// nombre; sin nombre: { titulo: "Buenas tardes", subtitulo: "¡Hola de nuevo!" }.
// (No se usa la parte del email antes del @: suele ser algo como
// "facu1988", que queda peor que un saludo sin nombre.)
export function textoBienvenida(email, ahora = new Date()) {
  const saludo = saludoSegunHora(partesArgentina(ahora).hora);
  const nombre = nombreParaEmail(email);
  return nombre ? { titulo: `${saludo}, ${nombre}`, subtitulo: null } : { titulo: saludo, subtitulo: "¡Hola de nuevo!" };
}
