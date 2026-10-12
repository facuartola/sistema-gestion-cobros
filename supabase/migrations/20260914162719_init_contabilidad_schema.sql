create extension if not exists pgcrypto;

create table jugadores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  contacto text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table cuotas_jugadores (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references jugadores(id) on delete cascade,
  mes date not null,
  monto numeric(10,2) not null,
  estado text not null default 'pendiente' check (estado in ('pagado','pendiente')),
  fecha_pago date,
  created_at timestamptz not null default now(),
  unique (jugador_id, mes)
);

create table alumnos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  contacto text,
  fecha_inicio date,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table cuotas_alumnos (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references alumnos(id) on delete cascade,
  mes date not null,
  monto numeric(10,2) not null,
  estado text not null default 'pendiente' check (estado in ('pagado','pendiente')),
  fecha_pago date,
  created_at timestamptz not null default now(),
  unique (alumno_id, mes)
);

create index on cuotas_jugadores (mes);
create index on cuotas_alumnos (mes);

alter table jugadores enable row level security;
alter table cuotas_jugadores enable row level security;
alter table alumnos enable row level security;
alter table cuotas_alumnos enable row level security;

create policy "authenticated full access" on jugadores for all to authenticated using (true) with check (true);
create policy "authenticated full access" on cuotas_jugadores for all to authenticated using (true) with check (true);
create policy "authenticated full access" on alumnos for all to authenticated using (true) with check (true);
create policy "authenticated full access" on cuotas_alumnos for all to authenticated using (true) with check (true);
