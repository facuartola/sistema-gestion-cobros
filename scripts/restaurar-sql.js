#!/usr/bin/env node
/* eslint-disable */
// Convierte el datos.json de una copia de seguridad en un archivo .sql para
// cargar en una base NUEVA, creada antes con las migraciones de
// supabase/migrations. Uso:
//
//   node scripts/restaurar-sql.js datos.json restaurar.sql
//
// Solo lee el JSON y escribe el .sql: no se conecta a ninguna base.
const fs = require("node:fs");

// Orden de carga: cada tabla después de aquellas de las que depende.
const ORDEN = [
  "equipo",
  "certificaciones",
  "modulos",
  "jugadores",
  "alumnos",
  "cuotas_jugadores",
  "cuotas_alumnos",
  "categorias_gasto",
  "pagos_gasto",
  "encuentros",
  "inscripciones",
  "sesiones",
  "recordatorios",
];
// Tablas con automatismos (triggers de usuario) que duplicarían datos al
// insertar: una certificación crea sus 10 módulos, un módulo sus 4 clases y una
// inscripción sus 10 sesiones. Además protegen filas pagadas. En los tipos de
// gasto, el trigger proteger_categorias impide borrar los tipos con clave, y la
// restauración empieza vaciando la tabla (los tipos de ejemplo que siembra la
// migración). Se apagan durante la carga y se vuelven a prender al final. Los
// vínculos entre tablas (claves foráneas) siguen controlándose.
const CON_AUTOMATISMOS = ["categorias_gasto", "certificaciones", "modulos", "encuentros", "inscripciones", "sesiones"];
const TAMANO_LOTE = 200;

function literal(valor, contexto) {
  if (valor === null || valor === undefined) return "NULL";
  if (typeof valor === "boolean") return valor ? "TRUE" : "FALSE";
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) throw new Error(`Número no válido en ${contexto}`);
    return String(valor);
  }
  if (typeof valor === "string") {
    if (valor.includes("\u0000")) throw new Error(`Texto con carácter nulo en ${contexto}`);
    // Comillas simples duplicadas. Con standard_conforming_strings activado
    // (se fuerza abajo) la barra invertida es una barra común. Los saltos de
    // línea y las tildes van tal cual dentro de las comillas.
    return `'${valor.replace(/'/g, "''")}'`;
  }
  throw new Error(`Tipo de valor no soportado en ${contexto}: ${typeof valor}`);
}

// Padres antes que hijos (los tipos de gasto se apuntan entre sí).
function padresPrimero(filas) {
  const ids = new Set(filas.map((f) => f.id));
  const salida = [];
  const puestas = new Set();
  let pendientes = [...filas];
  while (pendientes.length) {
    const lista = pendientes.filter((f) => !f.parent_id || !ids.has(f.parent_id) || puestas.has(f.parent_id));
    if (!lista.length) throw new Error("categorias_gasto: los tipos de gasto se apuntan en círculo.");
    for (const f of lista) {
      salida.push(f);
      puestas.add(f.id);
    }
    pendientes = pendientes.filter((f) => !puestas.has(f.id));
  }
  return salida;
}

function insertar(tabla, filas) {
  if (!filas.length) return `-- ${tabla}: sin filas.\n`;
  const columnas = [];
  for (const f of filas) for (const k of Object.keys(f)) if (!columnas.includes(k)) columnas.push(k);
  const lotes = [];
  for (let i = 0; i < filas.length; i += TAMANO_LOTE) {
    const valores = filas
      .slice(i, i + TAMANO_LOTE)
      .map((f) => `  (${columnas.map((c) => literal(f[c], `${tabla}.${c}`)).join(", ")})`)
      .join(",\n");
    lotes.push(`INSERT INTO public.${tabla} (${columnas.map((c) => `"${c}"`).join(", ")}) VALUES\n${valores};\n`);
  }
  return `-- ${tabla}: ${filas.length} filas.\n${lotes.join("\n")}`;
}

function generarSql(datos) {
  if (!datos || typeof datos !== "object" || !datos.tablas) throw new Error("El archivo no parece un datos.json de una copia.");
  if (datos.version !== 1) throw new Error(`Versión de copia no soportada: ${datos.version}`);
  for (const t of ORDEN) {
    if (!Array.isArray(datos.tablas[t])) throw new Error(`Falta la tabla ${t} en datos.json.`);
  }
  const partes = [
    "-- Restauración generada por scripts/restaurar-sql.js.",
    `-- Copia generada en: ${datos.generado_en ?? "fecha desconocida"}.`,
    "-- Cargar SOLO en una base nueva, con las migraciones de supabase/migrations ya aplicadas.",
    "",
    "BEGIN;",
    "SET LOCAL standard_conforming_strings = on;",
    "",
    "-- Se apagan los automatismos para que no dupliquen módulos, clases ni sesiones.",
    ...CON_AUTOMATISMOS.map((t) => `ALTER TABLE public.${t} DISABLE TRIGGER USER;`),
    "",
    "-- La migración siembra tipos de gasto de ejemplo: se vacían antes de cargar los de la copia.",
    "DELETE FROM public.categorias_gasto;",
    "",
  ];
  for (const t of ORDEN) {
    partes.push(insertar(t, t === "categorias_gasto" ? padresPrimero(datos.tablas[t]) : datos.tablas[t]));
  }
  partes.push(
    "-- Se vuelven a prender los automatismos.",
    ...CON_AUTOMATISMOS.map((t) => `ALTER TABLE public.${t} ENABLE TRIGGER USER;`),
    "",
    "-- Control: si alguna tabla no quedó con las filas de la copia, se cancela todo.",
    "DO $control$",
    "BEGIN",
    ...ORDEN.map(
      (t) =>
        `  IF (SELECT count(*) FROM public.${t}) <> ${datos.tablas[t].length} THEN RAISE EXCEPTION 'La tabla ${t} no quedó con ${datos.tablas[t].length} filas'; END IF;`
    ),
    "END",
    "$control$;",
    "",
    "COMMIT;",
    ""
  );
  return partes.join("\n");
}

function main(argv) {
  const [entrada, salida] = argv;
  if (!entrada || !salida) {
    console.error("Uso: node scripts/restaurar-sql.js datos.json restaurar.sql");
    process.exit(1);
  }
  let datos;
  try {
    datos = JSON.parse(fs.readFileSync(entrada, "utf8").replace(/^﻿/, ""));
  } catch (err) {
    console.error(`No se pudo leer ${entrada}: ${err.message}`);
    process.exit(1);
  }
  try {
    const sql = generarSql(datos);
    fs.writeFileSync(salida, sql, "utf8");
    console.log(`Listo: ${salida} (${ORDEN.map((t) => `${t} ${datos.tablas[t].length}`).join(", ")})`);
  } catch (err) {
    console.error(`No se pudo generar el SQL: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { generarSql, literal, ORDEN, CON_AUTOMATISMOS };
if (require.main === module) main(process.argv.slice(2));
