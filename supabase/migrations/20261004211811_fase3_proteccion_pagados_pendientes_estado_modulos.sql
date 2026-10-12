
-- 1. Lo ya pagado no se puede modificar ni borrar sin eliminar antes el pago.
--    El único cambio permitido es que pago_gasto_id pase a null (lo hace la base
--    sola cuando se elimina el pago en Gastos); así el ítem vuelve a quedar pendiente.
create or replace function private.proteger_encuentro_pagado() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.pago_gasto_id is not null then
      raise exception 'Este encuentro ya fue pagado y no se puede eliminar';
    end if;
    return old;
  end if;
  if old.pago_gasto_id is not null and (
        new.profe_id  is distinct from old.profe_id
     or new.dictado   is distinct from old.dictado
     or new.tarifa    is distinct from old.tarifa
     or new.tipo      is distinct from old.tipo
     or new.modulo_id is distinct from old.modulo_id) then
    raise exception 'Este encuentro ya fue pagado: para corregirlo, primero eliminá el pago en Gastos';
  end if;
  return new;
end $$;

create or replace function private.proteger_sesion_pagada() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.pago_gasto_id is not null then
      raise exception 'Esta sesión ya fue pagada y no se puede eliminar';
    end if;
    return old;
  end if;
  if old.pago_gasto_id is not null and (
        new.coach_id       is distinct from old.coach_id
     or new.realizada      is distinct from old.realizada
     or new.tarifa         is distinct from old.tarifa
     or new.modulo_id      is distinct from old.modulo_id
     or new.inscripcion_id is distinct from old.inscripcion_id) then
    raise exception 'Esta sesión ya fue pagada: para corregirla, primero eliminá el pago en Gastos';
  end if;
  return new;
end $$;

revoke execute on function private.proteger_encuentro_pagado(), private.proteger_sesion_pagada()
  from public, anon, authenticated;

create trigger proteger_encuentro_pagado before update or delete on encuentros
  for each row execute function private.proteger_encuentro_pagado();
create trigger proteger_sesion_pagada before update or delete on sesiones
  for each row execute function private.proteger_sesion_pagada();

-- 2. Estado de cada módulo: cuándo está listo para liquidar.
create view estado_modulos with (security_invoker = true) as
select mo.id as modulo_id, mo.certificacion_id, mo.numero, mo.fecha_inicio, mo.fecha_fin, mo.cerrado_en,
  (select count(*) from encuentros e where e.modulo_id = mo.id and e.tipo = 'regular')::int as encuentros_regulares,
  (select count(*) from encuentros e where e.modulo_id = mo.id)::int as encuentros_total,
  (select count(*) from encuentros e where e.modulo_id = mo.id and e.dictado)::int as encuentros_dictados,
  (select count(*) from sesiones s where s.modulo_id = mo.id)::int as sesiones_total,
  (select count(*) from sesiones s where s.modulo_id = mo.id and s.realizada)::int as sesiones_realizadas,
  (mo.cerrado_en is null
    and (select count(*) from encuentros e where e.modulo_id = mo.id and e.tipo = 'regular') >= 4
    and not exists (select 1 from encuentros e where e.modulo_id = mo.id and not e.dictado)
  ) as listo_para_liquidar
from modulos mo;

-- 3. Pendientes de toda la certificación (sesiones o encuentros hechos y no pagados),
--    sin depender de que haya un módulo abierto: cubre lo que se hace tarde.
create or replace function public.calcular_pendientes(p_certificacion_id uuid)
returns table (equipo_id uuid, nombre text, concepto text, cantidad int, total numeric)
language sql stable security invoker set search_path = '' as $$
  with c as (
    select tarifa_sesion, tarifa_encuentro, tarifa_practica
    from public.certificaciones where id = p_certificacion_id
  ),
  items as (
    select e.profe_id as eid, 'encuentros'::text as concepto,
           coalesce(e.tarifa, case when e.tipo = 'practica_final'
             then coalesce(c.tarifa_practica, c.tarifa_encuentro) else c.tarifa_encuentro end) as monto
    from public.encuentros e
    join public.modulos mo on mo.id = e.modulo_id
    cross join c
    where mo.certificacion_id = p_certificacion_id and e.dictado and e.pago_gasto_id is null
    union all
    select s.coach_id, 'sesiones', coalesce(s.tarifa, c.tarifa_sesion)
    from public.sesiones s
    join public.modulos mo on mo.id = s.modulo_id
    cross join c
    where mo.certificacion_id = p_certificacion_id and s.realizada and s.pago_gasto_id is null
  )
  select i.eid, q.nombre, i.concepto, count(*)::int,
         case when bool_or(i.monto is null) then null else sum(i.monto) end
  from items i join public.equipo q on q.id = i.eid
  group by i.eid, q.nombre, i.concepto
  order by q.nombre, i.concepto;
$$;

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
            format('%s · Pendientes · %s', v_cert.nombre, v_texto), r.equipo_id)
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

-- 4. liquidar_modulo ahora bloquea también la certificación, para que dos
--    liquidaciones simultáneas (de un módulo y de pendientes) no dupliquen pagos.
create or replace function public.liquidar_modulo(p_modulo_id uuid, p_fecha_pago date, p_metodo_pago text default null)
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_mod record; v_cat_ses uuid; v_cat_enc uuid; r record; v_pago uuid; v_n int := 0; v_texto text;
begin
  if not (select private.es_admin()) then raise exception 'No autorizado'; end if;
  if p_metodo_pago is not null and p_metodo_pago not in ('efectivo','transferencia') then
    raise exception 'Método de pago inválido';
  end if;

  select mo.id, mo.numero, mo.certificacion_id, c.nombre as cert
    into v_mod
    from public.modulos mo join public.certificaciones c on c.id = mo.certificacion_id
   where mo.id = p_modulo_id
   for update of mo;
  if not found then raise exception 'El módulo no existe'; end if;

  perform 1 from public.certificaciones where id = v_mod.certificacion_id for update;

  if exists (select 1 from public.modulos where id = p_modulo_id and cerrado_en is not null) then
    raise exception 'Este módulo ya fue liquidado';
  end if;

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

revoke execute on function public.calcular_pendientes(uuid) from public, anon;
revoke execute on function public.liquidar_pendientes(uuid, date, text) from public, anon;
revoke execute on function public.liquidar_modulo(uuid, date, text) from public, anon;
grant execute on function public.calcular_pendientes(uuid) to authenticated;
grant execute on function public.liquidar_pendientes(uuid, date, text) to authenticated;
grant execute on function public.liquidar_modulo(uuid, date, text) to authenticated;
