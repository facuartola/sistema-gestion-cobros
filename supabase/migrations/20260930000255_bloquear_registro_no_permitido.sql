
-- Lista de mails que pueden tener cuenta. Vive en el esquema privado, que la
-- API no expone.
create table private.emails_permitidos (
  email text primary key check (email = lower(email))
);
alter table private.emails_permitidos enable row level security;

insert into private.emails_permitidos (email) values
  ('dev@ejemplo.com'),
  ('admin@ejemplo.com');

-- Rechaza la creación de cualquier usuario cuyo mail no esté en la lista.
-- Es un candado a nivel base de datos, independiente del toggle de registro
-- del panel de Supabase: cubre registro público, invitaciones y altas manuales.
create or replace function private.bloquear_registro_no_permitido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from private.emails_permitidos where email = lower(new.email)
  ) then
    raise exception 'Registro no permitido';
  end if;
  return new;
end;
$$;

revoke execute on function private.bloquear_registro_no_permitido() from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.bloquear_registro_no_permitido() to supabase_auth_admin;

create trigger bloquear_registro_no_permitido
  before insert on auth.users
  for each row execute function private.bloquear_registro_no_permitido();
