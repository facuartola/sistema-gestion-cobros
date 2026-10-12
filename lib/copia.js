import { strToU8, zipSync } from "fflate";
import { armarCSV } from "./csv";
import { fechaHoraArgentina, hoyArgentinaISO } from "./fechas";
import { ETIQUETA_METODO } from "./metodoPago";

// Copia de seguridad completa: se trae cada tabla de negocio, se verifica que
// llegó entera y se arma un .zip con una planilla por tabla (para mirar en
// Excel), datos.json (la copia fiel, para restaurar), LEEME.txt y la lista de
// comprobantes. No incluye administradores, mails permitidos, errores ni datos
// de acceso.

const VERSION_COPIA = 1;
const TAMANO_PAGINA = 1000;
// Netlify corta las respuestas de las funciones cerca de 6 MB: se avisa antes.
const AVISO_BYTES = 5 * 1024 * 1024;

// En el orden en que hay que cargarlas en una base nueva (cada tabla depende
// de las anteriores). `titulo` es como se nombra en los mensajes.
export const TABLAS = [
  { nombre: "equipo", titulo: "el equipo", archivo: "equipo.csv" },
  { nombre: "certificaciones", titulo: "las certificaciones", archivo: "certificaciones.csv" },
  { nombre: "modulos", titulo: "los módulos", archivo: "modulos.csv" },
  { nombre: "jugadores", titulo: "los jugadores", archivo: "jugadores.csv" },
  { nombre: "alumnos", titulo: "los alumnos", archivo: "alumnos.csv" },
  { nombre: "cuotas_jugadores", titulo: "las cuotas de jugadores", archivo: "cuotas-de-jugadores.csv" },
  { nombre: "cuotas_alumnos", titulo: "las cuotas de alumnos", archivo: "cuotas-de-alumnos.csv" },
  { nombre: "categorias_gasto", titulo: "los tipos de gasto", archivo: "tipos-de-gasto.csv" },
  { nombre: "pagos_gasto", titulo: "los pagos de gastos", archivo: "pagos-de-gastos.csv" },
  { nombre: "encuentros", titulo: "las clases", archivo: "clases.csv" },
  { nombre: "inscripciones", titulo: "las inscripciones", archivo: "inscripciones.csv" },
  { nombre: "sesiones", titulo: "las sesiones", archivo: "sesiones.csv" },
  { nombre: "recordatorios", titulo: "los recordatorios", archivo: "recordatorios.csv" },
];

export const ORDEN_RESTAURACION = TABLAS.map((t) => t.nombre);

// Error con un mensaje listo para mostrar tal cual.
export class ErrorCopia extends Error {
  constructor(mensaje, status = 500) {
    super(mensaje);
    this.name = "ErrorCopia";
    this.status = status;
  }
}

const faltaron = (t) => new ErrorCopia(`No se pudo completar la copia: faltaron datos de ${t.titulo}.`);

// Trae TODAS las filas de una tabla, de a `tamano`, con orden estable por id,
// y las compara contra el conteo exacto de la base. Si no coinciden, tira un
// ErrorCopia: nunca se entrega una copia parcial.
export async function traerTabla(supabase, tabla, tamano = TAMANO_PAGINA) {
  const filas = [];
  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await supabase
      .from(tabla.nombre)
      .select("*")
      .order("id", { ascending: true })
      .range(desde, desde + tamano - 1);
    if (error) throw Object.assign(faltaron(tabla), { causa: error });
    filas.push(...(data ?? []));
    if (!data || data.length < tamano) break;
  }
  const { count, error: errorConteo } = await supabase.from(tabla.nombre).select("id", { count: "exact", head: true });
  if (errorConteo || typeof count !== "number") throw Object.assign(faltaron(tabla), { causa: errorConteo });
  const sinRepetir = new Set(filas.map((f) => f.id)).size;
  if (filas.length !== count || sinRepetir !== filas.length) throw faltaron(tabla);
  return filas;
}

// Todas las tablas, en orden. Si todas vienen vacías, algo anda mal con los
// permisos: no se entrega una copia que parezca buena y esté vacía.
export async function reunirTablas(supabase, tamano = TAMANO_PAGINA) {
  const tablas = {};
  for (const t of TABLAS) tablas[t.nombre] = await traerTabla(supabase, t, tamano);
  if (TABLAS.every((t) => tablas[t.nombre].length === 0)) {
    throw new ErrorCopia(
      "No se pudo completar la copia: todas las tablas vinieron vacías. Puede ser un problema de permisos: cerrá sesión, volvé a entrar y probá de nuevo.",
      409
    );
  }
  return tablas;
}

// --- Planillas (CSV) ---------------------------------------------------------

const si = (v) => (v ? "Sí" : "No");
const solo = (v) => v ?? "";
const mesDe = (fecha) => (fecha ? String(fecha).slice(0, 7) : "");
const hora = (ts) => (ts ? fechaHoraArgentina(ts) : "");
const numero = (v) => (v == null ? "" : Number(v));

const ESTADO_CUOTA = { pagado: "Pagada", pendiente: "Por cobrar" };
const SE_PAGA = { ninguna: "No se repite", mensual: "Todos los meses", anual: "Una vez al año" };
const TIPO_RECORDATORIO = { general: "General", cobro: "Cobro", seguimiento: "Seguimiento" };
const TIPO_CLASE = { regular: "Clase", practica_final: "Práctica final" };
const ESTADO_CERT = { en_curso: "En curso", finalizada: "Finalizada" };

function indice(filas) {
  return new Map((filas ?? []).map((f) => [f.id, f]));
}

// "Gastos variables › Equipo de marketing" para cada tipo de gasto.
function rutasDeTipos(categorias) {
  const porId = indice(categorias);
  const cache = new Map();
  function ruta(id, vistos = new Set()) {
    if (cache.has(id)) return cache.get(id);
    const c = porId.get(id);
    if (!c) return "";
    const padre = c.parent_id && !vistos.has(c.parent_id) ? ruta(c.parent_id, new Set([...vistos, id])) : "";
    const completa = padre ? `${padre} › ${c.nombre}` : c.nombre;
    cache.set(id, completa);
    return completa;
  }
  for (const c of categorias ?? []) ruta(c.id);
  return cache;
}

// Definición de cada planilla: columnas en castellano y, junto a cada id, el
// nombre de lo que apunta.
function definirPlanillas(tablas) {
  const jugadores = indice(tablas.jugadores);
  const alumnos = indice(tablas.alumnos);
  const equipo = indice(tablas.equipo);
  const certs = indice(tablas.certificaciones);
  const modulos = indice(tablas.modulos);
  const inscripciones = indice(tablas.inscripciones);
  const rutas = rutasDeTipos(tablas.categorias_gasto);
  const nombreDe = (mapa, id) => mapa.get(id)?.nombre ?? "";
  const nombreModulo = (id) => {
    const m = modulos.get(id);
    return m ? `${nombreDe(certs, m.certificacion_id)} - Módulo ${m.numero}` : "";
  };
  const personaDe = (r) => (r.jugador_id ? nombreDe(jugadores, r.jugador_id) : r.alumno_id ? nombreDe(alumnos, r.alumno_id) : "");

  const cuotas = (personas, campo, etiqueta) => [
    { label: etiqueta, value: (f) => nombreDe(personas, f[campo]) },
    { label: "Mes", value: (f) => mesDe(f.mes) },
    { label: "Monto (US$)", value: (f) => numero(f.monto) },
    { label: "Estado", value: (f) => ESTADO_CUOTA[f.estado] ?? f.estado },
    { label: "Fecha de pago", value: (f) => solo(f.fecha_pago) },
    { label: "Método de pago", value: (f) => ETIQUETA_METODO[f.metodo_pago] ?? "" },
    { label: "Cargada el", value: (f) => hora(f.created_at) },
    { label: "Id", value: (f) => f.id },
    { label: `Id de ${etiqueta.toLowerCase()}`, value: (f) => f[campo] },
  ];

  return {
    jugadores: [
      { label: "Nombre", value: (f) => f.nombre },
      { label: "Contacto", value: (f) => solo(f.contacto) },
      { label: "Activo", value: (f) => si(f.activo) },
      { label: "Monto mensual (US$)", value: (f) => numero(f.monto_mensual) },
      { label: "Día de vencimiento", value: (f) => solo(f.dia_vencimiento) },
      { label: "Notas", value: (f) => solo(f.notas) },
      { label: "Cargado el", value: (f) => hora(f.created_at) },
      { label: "Id", value: (f) => f.id },
    ],
    alumnos: [
      { label: "Nombre", value: (f) => f.nombre },
      { label: "Contacto", value: (f) => solo(f.contacto) },
      { label: "Activo", value: (f) => si(f.activo) },
      { label: "Fecha de inicio", value: (f) => solo(f.fecha_inicio) },
      { label: "Monto mensual (US$)", value: (f) => numero(f.monto_mensual) },
      { label: "Monto total (US$)", value: (f) => numero(f.monto_total) },
      { label: "Día de vencimiento", value: (f) => solo(f.dia_vencimiento) },
      { label: "Notas", value: (f) => solo(f.notas) },
      { label: "Cargado el", value: (f) => hora(f.created_at) },
      { label: "Id", value: (f) => f.id },
    ],
    cuotas_jugadores: cuotas(jugadores, "jugador_id", "Jugador"),
    cuotas_alumnos: cuotas(alumnos, "alumno_id", "Alumno"),
    categorias_gasto: [
      { label: "Tipo de gasto (ruta completa)", value: (f) => rutas.get(f.id) ?? f.nombre },
      { label: "Nombre", value: (f) => f.nombre },
      { label: "Se paga", value: (f) => SE_PAGA[f.recurrencia] ?? f.recurrencia },
      { label: "Monto estimado (US$)", value: (f) => numero(f.monto_estimado) },
      { label: "Día de vencimiento", value: (f) => solo(f.dia_vencimiento) },
      { label: "Mes de vencimiento", value: (f) => solo(f.mes_vencimiento) },
      { label: "Activo", value: (f) => si(f.activo) },
      { label: "Orden", value: (f) => solo(f.orden) },
      { label: "Id", value: (f) => f.id },
      { label: "Id del grupo", value: (f) => solo(f.parent_id) },
    ],
    pagos_gasto: [
      { label: "Fecha de pago", value: (f) => solo(f.fecha_pago) },
      { label: "Tipo de gasto", value: (f) => rutas.get(f.categoria_id) ?? "" },
      { label: "Monto (US$)", value: (f) => numero(f.monto) },
      { label: "Mes que corresponde", value: (f) => mesDe(f.periodo) },
      { label: "Método de pago", value: (f) => ETIQUETA_METODO[f.metodo_pago] ?? "" },
      { label: "Proveedor", value: (f) => solo(f.proveedor) },
      { label: "Descripción", value: (f) => solo(f.descripcion) },
      { label: "Pago a", value: (f) => nombreDe(equipo, f.equipo_id) },
      { label: "Módulo", value: (f) => (f.modulo_id ? nombreModulo(f.modulo_id) : "") },
      { label: "Tiene comprobante", value: (f) => si(f.comprobante_path) },
      { label: "Cargado el", value: (f) => hora(f.created_at) },
      { label: "Id", value: (f) => f.id },
      { label: "Id del tipo de gasto", value: (f) => f.categoria_id },
    ],
    recordatorios: [
      { label: "Título", value: (f) => f.titulo },
      { label: "Nota", value: (f) => solo(f.nota) },
      { label: "Fecha", value: (f) => solo(f.fecha) },
      { label: "Tipo", value: (f) => TIPO_RECORDATORIO[f.tipo] ?? f.tipo },
      { label: "Hecho", value: (f) => si(f.hecho) },
      { label: "Hecho el", value: (f) => hora(f.hecho_en) },
      { label: "Persona", value: personaDe },
      { label: "Cargado el", value: (f) => hora(f.created_at) },
      { label: "Id", value: (f) => f.id },
      { label: "Id de la persona", value: (f) => f.jugador_id ?? f.alumno_id ?? "" },
    ],
    certificaciones: [
      { label: "Nombre", value: (f) => f.nombre },
      { label: "Estado", value: (f) => ESTADO_CERT[f.estado] ?? f.estado },
      { label: "Fecha de inicio", value: (f) => solo(f.fecha_inicio) },
      { label: "Tarifa por sesión (US$)", value: (f) => numero(f.tarifa_sesion) },
      { label: "Tarifa por clase (US$)", value: (f) => numero(f.tarifa_encuentro) },
      { label: "Tarifa por práctica (US$)", value: (f) => numero(f.tarifa_practica) },
      { label: "Cargada el", value: (f) => hora(f.created_at) },
      { label: "Id", value: (f) => f.id },
    ],
    modulos: [
      { label: "Certificación", value: (f) => nombreDe(certs, f.certificacion_id) },
      { label: "Módulo", value: (f) => f.numero },
      { label: "Inicio", value: (f) => solo(f.fecha_inicio) },
      { label: "Fin", value: (f) => solo(f.fecha_fin) },
      { label: "Cerrado el", value: (f) => hora(f.cerrado_en) },
      { label: "Id", value: (f) => f.id },
      { label: "Id de la certificación", value: (f) => f.certificacion_id },
    ],
    encuentros: [
      { label: "Módulo", value: (f) => nombreModulo(f.modulo_id) },
      { label: "Clase", value: (f) => f.numero },
      { label: "Tipo", value: (f) => TIPO_CLASE[f.tipo] ?? f.tipo },
      { label: "Fecha", value: (f) => solo(f.fecha) },
      { label: "Profe", value: (f) => nombreDe(equipo, f.profe_id) },
      { label: "Tarifa (US$)", value: (f) => numero(f.tarifa) },
      { label: "Dictada", value: (f) => si(f.dictado) },
      { label: "Pagada", value: (f) => si(f.pago_gasto_id) },
      { label: "Id", value: (f) => f.id },
      { label: "Id del módulo", value: (f) => f.modulo_id },
      { label: "Id del pago", value: (f) => solo(f.pago_gasto_id) },
    ],
    equipo: [
      { label: "Nombre", value: (f) => f.nombre },
      { label: "Contacto", value: (f) => solo(f.contacto) },
      { label: "Notas", value: (f) => solo(f.notas) },
      { label: "Activo", value: (f) => si(f.activo) },
      { label: "Cargado el", value: (f) => hora(f.created_at) },
      { label: "Id", value: (f) => f.id },
    ],
    inscripciones: [
      { label: "Certificación", value: (f) => nombreDe(certs, f.certificacion_id) },
      { label: "Alumno", value: (f) => nombreDe(alumnos, f.alumno_id) },
      { label: "Coach", value: (f) => nombreDe(equipo, f.coach_id) },
      { label: "Inscripto el", value: (f) => hora(f.created_at) },
      { label: "Id", value: (f) => f.id },
      { label: "Id del alumno", value: (f) => f.alumno_id },
    ],
    sesiones: [
      { label: "Certificación", value: (f) => nombreDe(certs, inscripciones.get(f.inscripcion_id)?.certificacion_id) },
      { label: "Módulo", value: (f) => nombreModulo(f.modulo_id) },
      { label: "Alumno", value: (f) => nombreDe(alumnos, inscripciones.get(f.inscripcion_id)?.alumno_id) },
      { label: "Coach", value: (f) => nombreDe(equipo, f.coach_id) },
      { label: "Realizada", value: (f) => si(f.realizada) },
      { label: "Fecha realizada", value: (f) => solo(f.fecha_realizada) },
      { label: "Tarifa (US$)", value: (f) => numero(f.tarifa) },
      { label: "Pagada", value: (f) => si(f.pago_gasto_id) },
      { label: "Id", value: (f) => f.id },
      { label: "Id de la inscripción", value: (f) => f.inscripcion_id },
      { label: "Id del pago", value: (f) => solo(f.pago_gasto_id) },
    ],
  };
}

// Un archivo de comprobante por fila, con el pago al que pertenece.
function filasDeComprobantes(tablas) {
  const rutas = rutasDeTipos(tablas.categorias_gasto);
  return (tablas.pagos_gasto ?? [])
    .filter((p) => p.comprobante_path)
    .map((p) => ({ ...p, tipo_de_gasto: rutas.get(p.categoria_id) ?? "" }));
}

const COLUMNAS_COMPROBANTES = [
  { label: "Archivo (carpeta del bucket comprobantes)", value: (f) => f.comprobante_path },
  { label: "Fecha de pago", value: (f) => solo(f.fecha_pago) },
  { label: "Tipo de gasto", value: (f) => f.tipo_de_gasto },
  { label: "Monto (US$)", value: (f) => numero(f.monto) },
  { label: "Proveedor", value: (f) => solo(f.proveedor) },
  { label: "Descripción", value: (f) => solo(f.descripcion) },
  { label: "Id del pago", value: (f) => f.id },
];

// --- LEEME y zip ------------------------------------------------------------

function armarLeeme(tablas, ahora, comprobantes) {
  const lineas = [
    "COPIA DE SEGURIDAD DE LOS DATOS",
    `Generada el ${fechaHoraArgentina(ahora)} (hora de Argentina).`,
    "",
    "Filas de cada tabla:",
    ...TABLAS.map((t) => {
      const nombre = t.titulo.replace(/^(los|las|el) /, "");
      return `  - ${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}: ${tablas[t.nombre].length}`;
    }),
    `  - comprobantes (archivos listados en comprobantes.csv): ${comprobantes}`,
    "",
    "Qué hay en este zip:",
    "  - Una planilla .csv por tabla, para abrir en Excel.",
    "  - datos.json: todo el contenido de las mismas tablas, tal cual está en la base",
    "    (ids, fechas, montos y estados sin transformar). Es la copia fiel; sus tablas llevan",
    "    los nombres internos de la base.",
    "  - comprobantes.csv: la lista de comprobantes y el pago al que pertenece cada uno.",
    "",
    "IMPORTANTE:",
    "  - Los comprobantes (fotos y PDF) NO vienen adentro de este zip. Solo se listan en",
    "    comprobantes.csv. Los archivos siguen guardados en Supabase (Storage, bucket",
    "    comprobantes).",
    "  - Para restaurar esta copia hay que tener aplicadas las migraciones de",
    "    supabase/migrations en la base nueva. Ver docs/RESTAURAR.md.",
    "  - No incluye administradores, mails permitidos, errores ni datos de acceso.",
    "",
  ];
  return lineas.join("\r\n");
}

// Arma todos los archivos y el zip. `separador` es el que le sirve a Excel en
// la computadora de quien descarga (ver separadorParaLocale en lib/csv.js).
export function armarCopia(tablas, { ahora = new Date(), separador = "," } = {}) {
  const planillas = definirPlanillas(tablas);
  const comprobantes = filasDeComprobantes(tablas);
  // BOM de UTF-8 para que Excel respete las tildes.
  const csv = (filas, columnas) => strToU8("﻿" + armarCSV(filas, columnas, separador));

  const archivos = {};
  for (const t of TABLAS) archivos[t.archivo] = csv(tablas[t.nombre], planillas[t.nombre]);
  archivos["comprobantes.csv"] = csv(comprobantes, COLUMNAS_COMPROBANTES);
  archivos["datos.json"] = strToU8(
    JSON.stringify({ version: VERSION_COPIA, generado_en: ahora.toISOString(), orden_restauracion: ORDEN_RESTAURACION, tablas }, null, 1)
  );
  archivos["LEEME.txt"] = strToU8(armarLeeme(tablas, ahora, comprobantes.length));

  const zip = zipSync(archivos, { level: 6 });
  return {
    zip,
    archivos,
    nombre: `copia-de-datos-${hoyArgentinaISO(ahora)}.zip`,
    cercaDelLimite: zip.length >= AVISO_BYTES,
  };
}
