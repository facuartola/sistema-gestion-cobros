
-- Lista explícita de usuarios autorizados a usar el sistema, en vez de
-- "cualquier usuario autenticado". Si el registro público llegara a activarse
-- por error de nuevo, un usuario nuevo NO entra automáticamente aquí: hay que
-- agregarlo a mano por SQL. Segunda capa de defensa, independiente del toggle
-- de Supabase Auth.
create table app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);
alter table app_admins enable row level security;
-- Nadie puede leer/escribir esta tabla vía API (ni con el rol authenticated);
-- solo se administra por SQL directo con la service role. No hace falta
-- ninguna policy: sin policies + RLS activado = denegado por defecto.

-- Doy de alta la única cuenta real que existe hoy (la de prueba), para que
-- nada se rompa con este cambio.
insert into app_admins (user_id, email)
select id, email from auth.users where email = 'dev@ejemplo.com';

-- Reemplazo las policies "cualquier autenticado" por "solo admins".
drop policy "authenticated full access" on jugadores;
create policy "solo admins" on jugadores for all to authenticated
  using (auth.uid() in (select user_id from app_admins))
  with check (auth.uid() in (select user_id from app_admins));

drop policy "authenticated full access" on cuotas_jugadores;
create policy "solo admins" on cuotas_jugadores for all to authenticated
  using (auth.uid() in (select user_id from app_admins))
  with check (auth.uid() in (select user_id from app_admins));

drop policy "authenticated full access" on alumnos;
create policy "solo admins" on alumnos for all to authenticated
  using (auth.uid() in (select user_id from app_admins))
  with check (auth.uid() in (select user_id from app_admins));

drop policy "authenticated full access" on cuotas_alumnos;
create policy "solo admins" on cuotas_alumnos for all to authenticated
  using (auth.uid() in (select user_id from app_admins))
  with check (auth.uid() in (select user_id from app_admins));

drop policy "authenticated full access" on recordatorios;
create policy "solo admins" on recordatorios for all to authenticated
  using (auth.uid() in (select user_id from app_admins))
  with check (auth.uid() in (select user_id from app_admins));

drop policy "authenticated insert" on errores_app;
drop policy "authenticated read" on errores_app;
create policy "solo admins insertan" on errores_app for insert to authenticated
  with check (auth.uid() in (select user_id from app_admins));
create policy "solo admins leen" on errores_app for select to authenticated
  using (auth.uid() in (select user_id from app_admins));
