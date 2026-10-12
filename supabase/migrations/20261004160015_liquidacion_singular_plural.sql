
create or replace function public.liquidar_modulo(p_modulo_id uuid, p_fecha_pago date, p_metodo_pago text default null)
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_mod record; v_cat_ses uuid; v_cat_enc uuid; r record; v_pago uuid; v_n int := 0;
  v_texto text;
begin
  if not (select private.es_admin()) then
    raise exception 'No autorizado';
  end if;
  if p_metodo_pago is not null and p_metodo_pago not in ('efectivo','transferencia') then
    raise exception 'Método de pago inválido';
  end if;

  select mo.id, mo.numero, mo.certificacion_id, mo.cerrado_en, c.nombre as cert
    into v_mod
    from public.modulos mo join public.certificaciones c on c.id = mo.certificacion_id
   where mo.id = p_modulo_id
   for update of mo;
  if not found then raise exception 'El módulo no existe'; end if;
  if v_mod.cerrado_en is not null then raise exception 'Este módulo ya fue liquidado'; end if;

  select id into v_cat_ses from public.categorias_gasto where clave = 'pago_sesiones';
  select id into v_cat_enc from public.categorias_gasto where clave = 'pago_encuentros';
  if v_cat_ses is null or v_cat_enc is null then
    raise exception 'Faltan las categorías de pago al equipo de coaches';
  end if;

  if exists (select 1 from public.calcular_liquidacion(p_modulo_id) where total is null) then
    raise exception 'Falta definir la tarifa de la certificación antes de liquidar';
  end if;

  for r in select * from public.calcular_liquidacion(p_modulo_id) where total > 0 loop
    v_texto := case
      when r.concepto = 'sesiones' then case when r.cantidad = 1 then '1 sesión' else r.cantidad || ' sesiones' end
      else case when r.cantidad = 1 then '1 encuentro' else r.cantidad || ' encuentros' end
    end;

    insert into public.pagos_gasto (categoria_id, fecha_pago, monto, metodo_pago, descripcion, equipo_id, modulo_id)
    values (case when r.concepto = 'sesiones' then v_cat_ses else v_cat_enc end,
            p_fecha_pago, r.total, p_metodo_pago,
            format('%s · Módulo %s · %s', v_mod.cert, v_mod.numero, v_texto),
            r.equipo_id, p_modulo_id)
    returning id into v_pago;

    if r.concepto = 'sesiones' then
      update public.sesiones s set pago_gasto_id = v_pago
        from public.modulos mo
       where mo.id = s.modulo_id and mo.certificacion_id = v_mod.certificacion_id
         and mo.numero <= v_mod.numero and s.coach_id = r.equipo_id
         and s.realizada and s.pago_gasto_id is null;
    else
      update public.encuentros e set pago_gasto_id = v_pago
        from public.modulos mo
       where mo.id = e.modulo_id and mo.certificacion_id = v_mod.certificacion_id
         and mo.numero <= v_mod.numero and e.profe_id = r.equipo_id
         and e.dictado and e.pago_gasto_id is null;
    end if;
    v_n := v_n + 1;
  end loop;

  update public.modulos set cerrado_en = now() where id = p_modulo_id;
  return v_n;
end $$;
