
-- Las policies consultaban app_admins con los permisos del usuario, y como
-- app_admins no tiene policies de lectura, la subconsulta devolvía vacío y
-- bloqueaba todo. Una función SECURITY DEFINER consulta la tabla con permisos
-- del dueño, sin exponer la lista de admins a nadie.
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_admins where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

drop policy "solo admins" on public.jugadores;
create policy "solo admins" on public.jugadores for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

drop policy "solo admins" on public.cuotas_jugadores;
create policy "solo admins" on public.cuotas_jugadores for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

drop policy "solo admins" on public.alumnos;
create policy "solo admins" on public.alumnos for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

drop policy "solo admins" on public.cuotas_alumnos;
create policy "solo admins" on public.cuotas_alumnos for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

drop policy "solo admins" on public.recordatorios;
create policy "solo admins" on public.recordatorios for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

drop policy "solo admins insertan" on public.errores_app;
drop policy "solo admins leen" on public.errores_app;
create policy "solo admins insertan" on public.errores_app for insert to authenticated
  with check ((select public.es_admin()));
create policy "solo admins leen" on public.errores_app for select to authenticated
  using ((select public.es_admin()));
