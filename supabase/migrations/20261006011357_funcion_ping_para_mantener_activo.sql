
-- Señal de actividad: no lee ni escribe ningún dato. Sirve para que un aviso
-- programado mantenga activo el proyecto gratuito de Supabase.
create or replace function public.ping()
returns text
language sql stable security invoker set search_path = '' as $$
  select 'ok'::text;
$$;
revoke execute on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
