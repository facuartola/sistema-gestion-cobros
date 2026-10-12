import { normalizar } from "./navegacion";

// Pantalla "¿Cómo hago…?": tareas comunes, cada una con pocos pasos y un botón
// "Ir ahí". Los nombres de botones y pantallas van entre «» y tienen que decir
// lo mismo que la app. `ir` es la ruta a la que lleva el botón (se verifica
// contra las pantallas que existen en lib/ayuda.test.js).
export const TAREAS = [
  {
    id: "cobrar",
    titulo: "Cobrar a un cliente",
    palabras: "cobro cuota pagó pago jugador alumno efectivo transferencia",
    pasos: [
      "En Inicio tocá «Cobré a alguien».",
      "En «Quién pagó» elegí a la persona y revisá el «Mes de la cuota» y el «Monto cobrado (US$)».",
      "Poné la «Fecha del cobro» y elegí «Cómo te pagaron»: efectivo o transferencia.",
      "Tocá «Registrar cobro».",
    ],
    ir: "/",
  },
  {
    id: "cliente-nuevo",
    titulo: "Agregar un cliente nuevo",
    palabras: "alta nuevo jugador alumno persona cargar",
    pasos: [
      "Entrá a Cobros y tocá «+ Agregar cliente».",
      "Escribí el «Nombre» y elegí el «Tipo»: Jugador o Alumno de la certificación.",
      "Cargá el «Monto mensual a abonar (US$)» y, si querés, el día del mes en que debe pagar.",
      "Tocá «Agregar cliente».",
    ],
    ir: "/cobros",
  },
  {
    id: "cambiar-monto",
    titulo: "Cambiar el monto o el día de cobro de un cliente",
    palabras: "monto precio cuota dia vencimiento editar modificar datos",
    pasos: [
      "Entrá a Cobros y tocá a la persona.",
      "En «Datos» cambiá el «Monto mensual (US$)» o el «Día del mes en que debe pagar (1 a 31)».",
      "Tocá «Guardar datos». El monto nuevo vale para las cuotas nuevas; las que ya estaban cargadas conservan el suyo.",
    ],
    ir: "/cobros",
  },
  {
    id: "gasto-fijo",
    titulo: "Registrar un gasto fijo (Wifi, Zoom…)",
    palabras: "gasto fijo mensual wifi zoom celular pagué pagar",
    pasos: [
      "Entrá a Gastos y buscá el gasto en la lista (por ejemplo Wifi).",
      "Si la tarjeta tiene el botón «Pagué», tocalo: se registra con el monto del gasto, la fecha de hoy y el último método que usaste.",
      "Si dice «Registrar pago» (o el monto o la fecha son otros), tocalo y completá los datos del pago.",
    ],
    ir: "/gastos",
  },
  {
    id: "gasto-comprobante",
    titulo: "Registrar un gasto con comprobante",
    palabras: "gasto comprobante factura foto pdf recibo adjuntar",
    pasos: [
      "En Inicio tocá «Pagué un gasto».",
      "Elegí el «Tipo de gasto», el «Monto (US$)», la «Fecha del pago» y «Cómo se pagó».",
      "En «Comprobante, opcional» elegí la foto o el PDF (hasta 5 MB).",
      "Tocá «Registrar pago».",
    ],
    ir: "/gastos",
  },
  {
    id: "gasto-nuevo",
    titulo: "Agregar un gasto nuevo (Wifi, teléfono, publicidad…)",
    palabras: "agregar nuevo gasto tipo carpeta contador wifi telefono marketing publicidad se repite mis gastos crear",
    pasos: [
      "Entrá a Gastos, tocá «Mis gastos» y después «Agregar un gasto».",
      "Escribí el «Nombre» (por ejemplo, Contador) y elegí la carpeta en «Dentro de»: es solo para ordenar.",
      "En «¿Se repite?» elegí «No», «Cada mes» o «Una vez al año». Si querés, cargá el «Monto habitual (US$)» y el día de vencimiento.",
      "Tocá «Agregar gasto». Si estás registrando un pago y el gasto no está, elegí «+ Crear un tipo nuevo» al final de «Tipo de gasto».",
    ],
    ir: "/gastos/mis-gastos",
  },
  {
    id: "clase-sesion",
    titulo: "Marcar una clase dictada y una sesión",
    palabras: "clase dictada dada sesion coach profe realizada modulo certificacion",
    pasos: [
      "En Inicio tocá «Registré una clase o sesión»: se abre el módulo en curso.",
      "En «Clases», elegí quién la dio en «Profe» y marcá la columna «Dada».",
      "En «Sesiones de coaching», marcá «Realizada» en la fila del alumno.",
      "Las clases y sesiones marcadas quedan listas para pagarle al equipo.",
    ],
    ir: "/certificacion",
  },
  {
    id: "pagar-equipo",
    titulo: "Pagar al equipo al terminar un módulo",
    palabras: "pagar equipo profe coach modulo certificacion tarifa",
    pasos: [
      "Entrá a Certificación, pestaña «Módulos».",
      "Cuando un módulo está terminado aparece un aviso con el botón «Pagar al equipo»: tocalo.",
      "Revisá cuánto se le paga a cada persona, elegí la «Fecha de pago» y «Cómo vas a pagar».",
      "Tocá «Confirmar el pago».",
    ],
    ir: "/certificacion",
  },
  {
    id: "recordatorio",
    titulo: "Crear un recordatorio",
    palabras: "recordatorio recordar agenda aviso nota fecha",
    pasos: [
      "Arriba tocá «+ Nuevo» y elegí «Nuevo recordatorio».",
      "Escribí «¿Qué no te querés olvidar?» y elegí «Para el día».",
      "Si es sobre alguien, elegilo en «Sobre una persona, si querés».",
      "Tocá «Agregar». Lo ves en Recordatorios.",
    ],
    ir: "/recordatorios",
  },
  {
    id: "quien-debe",
    titulo: "Ver quién me debe",
    palabras: "deuda debe atrasado adeuda moroso cobros falta cobrar",
    pasos: [
      "En Inicio mirá la tarjeta «Quién debe»: lista a los clientes con deuda, de los más antiguos a los más nuevos.",
      "Para ver a todos con el estado de cada uno, entrá a Cobros.",
      "Si alguien ya pagó, tocá «Cobré» en su fila para registrarlo (si debe más de un mes, tocá «Ver» para elegir qué cuota).",
    ],
    ir: "/cobros",
  },
  {
    id: "copia",
    titulo: "Bajar una copia de los datos",
    palabras: "copia seguridad backup respaldo descargar datos zip",
    pasos: [
      "Entrá a Configuración.",
      "En «Copia de seguridad» tocá «Descargar copia de todos los datos».",
      "Se baja un solo archivo .zip. Guardalo en un lugar seguro, por ejemplo tu Drive o un pendrive.",
    ],
    ir: "/configuracion",
  },
  {
    id: "contrasena",
    titulo: "Qué hacer si me olvidé la contraseña",
    palabras: "contraseña clave olvide recuperar entrar login mail",
    pasos: [
      "En la pantalla de entrada tocá «Olvidé mi contraseña».",
      "Escribí tu email y tocá «Enviar link de recuperación».",
      "Abrí el mail que te llega (si no está, mirá en spam) y tocá el link para elegir una contraseña nueva.",
    ],
    ir: null,
  },
];

// Tareas que coinciden con lo escrito: cada palabra tiene que aparecer en el
// título, los pasos o las palabras clave (sin importar tildes ni mayúsculas).
export function filtrarTareas(busqueda, tareas = TAREAS) {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return tareas;
  return tareas.filter((t) => {
    const texto = normalizar(`${t.titulo} ${t.palabras} ${t.pasos.join(" ")}`);
    return palabras.every((p) => texto.includes(p));
  });
}
