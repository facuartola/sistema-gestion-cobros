// Prueba de la restauración con una base Postgres en memoria (PGlite): aplica las
// migraciones reales, arma datos con los automatismos activos, genera el .sql con
// scripts/restaurar-sql.js, lo carga en una base nueva y compara tabla por tabla.
// No es parte de `npm test` para no sumar una dependencia pesada. Para correrla:
//   npm install --no-save @electric-sql/pglite && node scripts/verificar-restauracion.mjs
// (Los esquemas auth y storage de Supabase se reemplazan por equivalentes mínimos.)
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import os from "node:os";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { generarSql, ORDEN } = createRequire(import.meta.url)(path.join(REPO, "scripts/restaurar-sql.js"));

async function base() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon; create role authenticated; create role supabase_auth_admin;
    create schema auth; create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;`);
  for (const m of fs.readdirSync(path.join(REPO, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()) await db.exec(fs.readFileSync(path.join(REPO, "supabase/migrations", m), "utf8"));
  return db;
}

// 1) Base "vieja" con datos realistas armados con los automatismos activos.
const a = await base();
await a.exec(`
  insert into equipo (id, nombre, contacto, notas) values
   ('00000000-0000-4000-8000-0000000000e1','Profe D''Ángelo','11 4444-5555','Dicta "los sábados"
Cobra por clase.'),
   ('00000000-0000-4000-8000-0000000000e2','Coach Ñandú',null,null);
  insert into certificaciones (id, nombre, fecha_inicio, tarifa_sesion, tarifa_encuentro, tarifa_practica) values
   ('00000000-0000-4000-8000-0000000000c1','Certificación 2026','2026-10-01',20,35.5,50);
  insert into alumnos (id, nombre, monto_mensual, monto_total, dia_vencimiento) values
   ('00000000-0000-4000-8000-0000000000a1','Alumna Uno',799,10900,10),('00000000-0000-4000-8000-0000000000a2','Alumno Dos',500,null,null),('00000000-0000-4000-8000-0000000000a3','Alumna Tres',650.5,6000,3);
  insert into inscripciones (id, certificacion_id, alumno_id, coach_id)
   select ('00000000-0000-4000-8000-0000000001' || lpad(row_number() over ()::text, 2, '0'))::uuid, '00000000-0000-4000-8000-0000000000c1', id, '00000000-0000-4000-8000-0000000000e2' from alumnos order by nombre;
  insert into jugadores (nombre, monto_mensual, dia_vencimiento) values ('Jugador Ñ', 15000, 10), ('Jugador "B"', 12000.75, null);
  insert into cuotas_jugadores (jugador_id, mes, monto, estado, fecha_pago, metodo_pago) select id, '2026-09-01', monto_mensual, 'pagado', '2026-09-08', 'transferencia' from jugadores;
  insert into cuotas_alumnos (alumno_id, mes, monto, estado, fecha_pago) select id, '2026-10-01', monto_mensual, 'pendiente', null from alumnos;
  insert into recordatorios (titulo, nota, fecha, tipo, alumno_id) values ('Llamar a Alumna Uno','Preguntar por la cuota' || chr(10) || 'y el pago','2026-10-08','cobro','00000000-0000-4000-8000-0000000000a1');
  -- una clase dictada y una sesión hecha, con su pago al equipo
  update encuentros set profe_id='00000000-0000-4000-8000-0000000000e1', dictado=true, fecha='2026-10-02' where id = (select e.id from encuentros e join modulos m on m.id=e.modulo_id where m.numero=1 and e.numero=1);
  update sesiones set realizada=true, fecha_realizada='2026-10-03', tarifa=40 where id = (select s.id from sesiones s join modulos m on m.id=s.modulo_id where m.numero=1 limit 1);
  insert into modulos (certificacion_id, numero) select '00000000-0000-4000-8000-0000000000c1', 11 where false;
  insert into pagos_gasto (id, categoria_id, fecha_pago, monto, metodo_pago, descripcion, equipo_id, modulo_id, comprobante_path)
   select '00000000-0000-4000-8000-0000000000b1', (select id from categorias_gasto where clave='pago_encuentros'), '2026-10-05', 35.5, 'efectivo', 'Cert · Módulo 1 · 1 encuentro', '00000000-0000-4000-8000-0000000000e1', (select id from modulos where numero=1), 'x/y.png';
  update encuentros set pago_gasto_id='00000000-0000-4000-8000-0000000000b1' where dictado;
`);
const antes = {};
for (const t of ORDEN) antes[t] = (await a.query(`select to_jsonb(t) j from public.${t} t order by id`)).rows.map((r) => r.j);
const cuentas = Object.fromEntries(ORDEN.map((t) => [t, antes[t].length]));
console.log("base origen:", JSON.stringify(cuentas));

// 2) Se genera el SQL de restauración y se carga en una base NUEVA.
const sql = generarSql({ version: 1, generado_en: new Date().toISOString(), tablas: antes });
fs.writeFileSync(path.join(os.tmpdir(), "roundtrip.sql"), sql);
const b = await base();
await b.exec(sql);
let difs = 0;
for (const t of ORDEN) {
  const despues = (await b.query(`select to_jsonb(t) j from public.${t} t order by id`)).rows.map((r) => r.j);
  const igual = JSON.stringify(despues) === JSON.stringify(antes[t]);
  if (!igual) { difs++; console.log("DIFIERE", t, despues.length, antes[t].length); }
}
console.log(difs === 0 ? "ROUNDTRIP: todas las tablas idénticas fila por fila" : `ROUNDTRIP: ${difs} tablas difieren`);
const trg = (await b.query(`select count(*) filter (where tgenabled='O')::int on_, count(*)::int total from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal`)).rows[0];
console.log("triggers de usuario activos:", JSON.stringify(trg));

// 3) Control negativo: sin apagar los automatismos, la carga duplica o falla.
const c = await base();
const sinApagar = sql.replace(/ALTER TABLE public\.\w+ (DISABLE|ENABLE) TRIGGER USER;\n/g, "");
try { await c.exec(sinApagar); console.log("NEGATIVO: cargó sin apagar (inesperado)"); } catch (e) { console.log("NEGATIVO (sin apagar triggers) falla como se esperaba:", e.message.slice(0, 120)); }
// 4) Cargar sobre una base que ya tiene datos de ejemplo de categorías (la migración las siembra)
const d = await base();
console.log("categorías sembradas por la migración:", (await d.query("select count(*)::int n from categorias_gasto")).rows[0].n);
// 5) Un fallo a mitad de la carga deja todo como estaba (transacción)
const e = await base();
const roto = sql.replace("-- recordatorios:", "INSERT INTO public.recordatorios (\"id\") VALUES ('no-es-uuid');\n-- recordatorios:");
try { await e.exec(roto); } catch (err) { /* esperado */ }
await e.exec("rollback").catch(() => {});
console.log("tras fallo, filas en jugadores:", (await e.query("select count(*)::int n from jugadores")).rows[0].n, "| categorías:", (await e.query("select count(*)::int n from categorias_gasto")).rows[0].n);
