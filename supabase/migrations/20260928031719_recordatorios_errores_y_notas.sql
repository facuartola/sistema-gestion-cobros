
-- Notas libres por persona (ej: "paga siempre los 10", "descuento por hermano")
alter table jugadores add column notas text;
alter table alumnos add column notas text;

-- Recordatorios de la clienta: manuales, opcionalmente atados a un jugador o alumno
create table recordatorios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  nota text,
  fecha date not null,
  tipo text not null default 'general' check (tipo in ('general','cobro','seguimiento')),
  hecho boolean not null default false,
  hecho_en timestamptz,
  jugador_id uuid references jugadores(id) on delete set null,
  alumno_id uuid references alumnos(id) on delete set null,
  created_at timestamptz not null default now(),
  check (not (jugador_id is not null and alumno_id is not null))
);
create index on recordatorios (fecha) where hecho = false;
create index on recordatorios (jugador_id);
create index on recordatorios (alumno_id);

alter table recordatorios enable row level security;
create policy "authenticated full access" on recordatorios
  for all to authenticated using (true) with check (true);

-- Registro de errores de la app en producción (alternativa propia a Sentry)
create table errores_app (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  mensaje text not null,
  stack text,
  ruta text,
  origen text not null default 'frontend' check (origen in ('frontend','api')),
  user_agent text,
  usuario_id uuid default auth.uid()
);
create index on errores_app (creado_en desc);

alter table errores_app enable row level security;
create policy "authenticated insert" on errores_app
  for insert to authenticated with check (true);
create policy "authenticated read" on errores_app
  for select to authenticated using (true);
