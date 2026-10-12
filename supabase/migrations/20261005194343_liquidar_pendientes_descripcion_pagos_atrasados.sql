
create or replace function public.liquidar_pendientes(p_certificacion_id uuid, p_fecha_pago date, p_metodo_pago text default null)
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_cert record; v_cat_ses uuid; v_cat_enc uuid; r record; v_pago uuid; v_n int := 0; v_texto text;
begin
  if not (select private.es_admin()) then raise exception 'No autorizado'; end if;
  if p_metodo_pago is not null and p_metodo_pago not in ('efectivo','transferencia') then
    raise exception 'Método de pago inválido';
  end if;

  select id, nombre into v_cert from public.certificaciones where id = p_certificacion_id for update;
  if not found then raise exception 'La certificación no existe'; end if;

  select id into v_cat_ses from public.categorias_gasto where clave = 'pago_sesiones';
  select id into v_cat_enc from public.categorias_gasto where clave = 'pago_encuentros';
  if v_cat_ses is null or v_cat_enc is null then
    raise exception 'Faltan las categorías de pago al equipo de coaches';
  end if;

  if exists (select 1 from public.calcular_pendientes(p_certificacion_id) where total is null) then
    raise exception 'Falta definir la tarifa de la certificación antes de liquidar';
  end if;

  for r in select * from public.calcular_pendientes(p_certificacion_id) where total > 0 loop
    v_texto := case
      when r.concepto = 'sesiones' then case when r.cantidad = 1 then '1 sesión' else r.cantidad || ' sesiones' end
      else case when r.cantidad = 1 then '1 encuentro' else r.cantidad || ' encuentros' end
    end;

    insert into public.pagos_gasto (categoria_id, fecha_pago, monto, metodo_pago, descripcion, equipo_id)
    values (case when r.concepto = 'sesiones' then v_cat_ses else v_cat_enc end,
            p_fecha_pago, r.total, p_metodo_pago,
            format('%s · Pagos atrasados · %s', v_cert.nombre, v_texto), r.equipo_id)
    returning id into v_pago;

    if r.concepto = 'sesiones' then
      update public.sesiones s set pago_gasto_id = v_pago
        from public.modulos mo
       where mo.id = s.modulo_id and mo.certificacion_id = p_certificacion_id
         and s.coach_id = r.equipo_id and s.realizada and s.pago_gasto_id is null;
    else
      update public.encuentros e set pago_gasto_id = v_pago
        from public.modulos mo
       where mo.id = e.modulo_id and mo.certificacion_id = p_certificacion_id
         and e.profe_id = r.equipo_id and e.dictado and e.pago_gasto_id is null;
    end if;
    v_n := v_n + 1;
  end loop;

  return v_n;
end $$;

revoke execute on function public.liquidar_pendientes(uuid, date, text) from public, anon;
grant execute on function public.liquidar_pendientes(uuid, date, text) to authenticated;
