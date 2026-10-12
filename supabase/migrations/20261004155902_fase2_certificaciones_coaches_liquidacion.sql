
-- Clave estable para las categorías que usa la liquidación (por si las renombran).
alter table categorias_gasto add column clave text unique;
update categorias_gasto set clave = 'pago_sesiones' where nombre = 'Pago de sesiones';
update categorias_gasto set clave = 'pago_encuentros' where nombre = 'Pago de encuentros';

-- Personas del equipo: coaches y profes (la misma persona puede ser ambas cosas).
create table equipo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 1 and 100),
  contacto text check (contacto is null or length(contacto) <= 300),
  notas text check (notas is null or length(notas) <= 1000),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Certificación (edición). Tarifas fijas definidas al inicio.
-- tarifa_practica: encuentros de prácticas finales; si es null se usa tarifa_encuentro.
create table certificaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 1 and 100),
  fecha_inicio date,
  tarifa_sesion numeric(10,2) check (tarifa_sesion is null or tarifa_sesion >= 0),
  tarifa_encuentro numeric(10,2) check (tarifa_encuentro is null or tarifa_encuentro >= 0),
  tarifa_practica numeric(10,2) check (tarifa_practica is null or tarifa_practica >= 0),
  estado text not null default 'en_curso' check (estado in ('en_curso','finalizada')),
  created_at timestamptz not null default now()
);

create table modulos (
  id uuid primary key default gen_random_uuid(),
  certificacion_id uuid not null references certificaciones(id) on delete cascade,
  numero smallint not null check (numero between 1 and 10),
  fecha_inicio date,
  fecha_fin date,
  cerrado_en timestamptz,
  unique (certificacion_id, numero)
);

-- Encuentros: 4 regulares por módulo + 5 de práctica final en los módulos 9 y 10.
-- tarifa null = tarifa de la certificación; con valor = tarifa especial (invitados).
create table encuentros (
  id uuid primary key default gen_random_uuid(),
  modulo_id uuid not null references modulos(id) on delete cascade,
  tipo text not null default 'regular' check (tipo in ('regular','practica_final')),
  numero smallint not null check (numero between 1 and 10),
  fecha date,
  profe_id uuid references equipo(id) on delete restrict,
  tarifa numeric(10,2) check (tarifa is null or tarifa >= 0),
  dictado boolean not null default false,
  pago_gasto_id uuid references pagos_gasto(id) on delete set null,
  unique (modulo_id, tipo, numero),
  check (not dictado or profe_id is not null)
);

-- Alumno inscripto en una certificación, con su coach actual.
create table inscripciones (
  id uuid primary key default gen_random_uuid(),
  certificacion_id uuid not null references certificaciones(id) on delete cascade,
  alumno_id uuid not null references alumnos(id) on delete cascade,
  coach_id uuid references equipo(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (certificacion_id, alumno_id)
);

-- Una sesión individual por alumno y módulo (10 en total, requisito para certificar).
-- coach_id es quien la dio: si el alumno cambia de coach, las ya hechas no cambian.
create table sesiones (
  id uuid primary key default gen_random_uuid(),
  inscripcion_id uuid not null references inscripciones(id) on delete cascade,
  modulo_id uuid not null references modulos(id) on delete cascade,
  coach_id uuid references equipo(id) on delete restrict,
  realizada boolean not null default false,
  fecha_realizada date,
  tarifa numeric(10,2) check (tarifa is null or tarifa >= 0),
  pago_gasto_id uuid references pagos_gasto(id) on delete set null,
  unique (inscripcion_id, modulo_id),
  check (not realizada or coach_id is not null)
);

-- Los pagos generados por la liquidación quedan vinculados a la persona y al módulo.
alter table pagos_gasto
  add column equipo_id uuid references equipo(id) on delete set null,
  add column modulo_id uuid references modulos(id) on delete set null;

create index on modulos (certificacion_id);
create index on encuentros (modulo_id);
create index on encuentros (profe_id);
create index on encuentros (pago_gasto_id);
create index on inscripciones (alumno_id);
create index on inscripciones (coach_id);
create index on sesiones (modulo_id);
create index on sesiones (coach_id);
create index on sesiones (pago_gasto_id);
create index on pagos_gasto (equipo_id);
create index on pagos_gasto (modulo_id);

-- Seguridad: solo admins.
alter table equipo enable row level security;
alter table certificaciones enable row level security;
alter table modulos enable row level security;
alter table encuentros enable row level security;
alter table inscripciones enable row level security;
alter table sesiones enable row level security;
create policy "solo admins" on equipo for all to authenticated using ((select private.es_admin())) with check ((select private.es_admin()));
create policy "solo admins" on certificaciones for all to authenticated using ((select private.es_admin())) with check ((select private.es_admin()));
create policy "solo admins" on modulos for all to authenticated using ((select private.es_admin())) with check ((select private.es_admin()));
create policy "solo admins" on encuentros for all to authenticated using ((select private.es_admin())) with check ((select private.es_admin()));
create policy "solo admins" on inscripciones for all to authenticated using ((select private.es_admin())) with check ((select private.es_admin()));
create policy "solo admins" on sesiones for all to authenticated using ((select private.es_admin())) with check ((select private.es_admin()));

-- Automatismos: al crear una certificación se crean sus 10 módulos; cada módulo
-- trae sus 4 encuentros; cada inscripción trae sus 10 sesiones.
create or replace function private.crear_modulos() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into public.modulos (certificacion_id, numero)
  select new.id, g from generate_series(1, 10) g;
  return new;
end $$;

create or replace function private.crear_encuentros() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into public.encuentros (modulo_id, tipo, numero)
  select new.id, 'regular', g from generate_series(1, 4) g;
  return new;
end $$;

create or replace function private.crear_sesiones() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into public.sesiones (inscripcion_id, modulo_id, coach_id)
  select new.id, m.id, new.coach_id from public.modulos m
  where m.certificacion_id = new.certificacion_id;
  return new;
end $$;

-- Si cambia el coach, se pasan al nuevo solo las sesiones no hechas ni pagadas.
create or replace function private.cambiar_coach() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.sesiones set coach_id = new.coach_id
  where inscripcion_id = new.id and not realizada and pago_gasto_id is null;
  return new;
end $$;

-- Prácticas finales: solo en los módulos 9 y 10, y como máximo 5 por certificación.
create or replace function private.validar_encuentro() returns trigger
language plpgsql set search_path = '' as $$
declare v_num smallint; v_cert uuid; v_cant int;
begin
  if new.tipo = 'practica_final' then
    select numero, certificacion_id into v_num, v_cert from public.modulos where id = new.modulo_id;
    if v_num not in (9, 10) then
      raise exception 'Las prácticas finales solo pueden estar en los módulos 9 y 10';
    end if;
    select count(*) into v_cant from public.encuentros e
      join public.modulos m on m.id = e.modulo_id
     where m.certificacion_id = v_cert and e.tipo = 'practica_final' and e.id <> new.id;
    if v_cant >= 5 then
      raise exception 'Una certificación tiene como máximo 5 encuentros de práctica final';
    end if;
  end if;
  return new;
end $$;

revoke execute on function private.crear_modulos(), private.crear_encuentros(),
  private.crear_sesiones(), private.cambiar_coach(), private.validar_encuentro()
  from public, anon;

create trigger crear_modulos after insert on certificaciones
  for each row execute function private.crear_modulos();
create trigger crear_encuentros after insert on modulos
  for each row execute function private.crear_encuentros();
create trigger crear_sesiones after insert on inscripciones
  for each row execute function private.crear_sesiones();
create trigger cambiar_coach after update of coach_id on inscripciones
  for each row when (old.coach_id is distinct from new.coach_id)
  execute function private.cambiar_coach();
create trigger validar_encuentro before insert or update on encuentros
  for each row execute function private.validar_encuentro();

-- Avance de cada alumno hacia la certificación (10 sesiones obligatorias).
create view progreso_certificacion with (security_invoker = true) as
select i.id as inscripcion_id, i.certificacion_id, i.alumno_id, a.nombre as alumno,
       i.coach_id, q.nombre as coach,
       count(*) filter (where s.realizada)::int as sesiones_realizadas,
       count(*)::int as sesiones_totales,
       count(*) filter (where s.realizada) = 10 as en_condiciones
from inscripciones i
join alumnos a on a.id = i.alumno_id
left join equipo q on q.id = i.coach_id
join sesiones s on s.inscripcion_id = i.id
group by i.id, i.certificacion_id, i.alumno_id, a.nombre, i.coach_id, q.nombre;

-- Vista previa de la liquidación de un módulo: lo que se le debe a cada persona
-- por encuentros dictados y sesiones hechas, impagos, de ese módulo o anteriores
-- (incluye sesiones recuperadas tarde).
create or replace function public.calcular_liquidacion(p_modulo_id uuid)
returns table (equipo_id uuid, nombre text, concepto text, cantidad int, total numeric)
language sql stable security invoker set search_path = '' as $$
  with m as (
    select mo.numero, mo.certificacion_id, c.tarifa_sesion, c.tarifa_encuentro, c.tarifa_practica
    from public.modulos mo join public.certificaciones c on c.id = mo.certificacion_id
    where mo.id = p_modulo_id
  ),
  items as (
    select e.profe_id as eid, 'encuentros'::text as concepto,
           coalesce(e.tarifa, case when e.tipo = 'practica_final'
             then coalesce(m.tarifa_practica, m.tarifa_encuentro) else m.tarifa_encuentro end) as monto
    from public.encuentros e
    join public.modulos mo on mo.id = e.modulo_id
    join m on m.certificacion_id = mo.certificacion_id
    where e.dictado and e.pago_gasto_id is null and mo.numero <= m.numero
    union all
    select s.coach_id, 'sesiones', coalesce(s.tarifa, m.tarifa_sesion)
    from public.sesiones s
    join public.modulos mo on mo.id = s.modulo_id
    join m on m.certificacion_id = mo.certificacion_id
    where s.realizada and s.pago_gasto_id is null and mo.numero <= m.numero
  )
  select i.eid, q.nombre, i.concepto, count(*)::int,
         case when bool_or(i.monto is null) then null else sum(i.monto) end
  from items i join public.equipo q on q.id = i.eid
  group by i.eid, q.nombre, i.concepto
  order by q.nombre, i.concepto;
$$;

-- Liquidación: crea los pagos en Gastos, marca lo pagado y cierra el módulo.
-- Todo en una transacción; el bloqueo del módulo evita liquidar dos veces.
create or replace function public.liquidar_modulo(p_modulo_id uuid, p_fecha_pago date, p_metodo_pago text default null)
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_mod record; v_cat_ses uuid; v_cat_enc uuid; r record; v_pago uuid; v_n int := 0;
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
    insert into public.pagos_gasto (categoria_id, fecha_pago, monto, metodo_pago, descripcion, equipo_id, modulo_id)
    values (case when r.concepto = 'sesiones' then v_cat_ses else v_cat_enc end,
            p_fecha_pago, r.total, p_metodo_pago,
            format('%s · Módulo %s · %s %s', v_mod.cert, v_mod.numero, r.cantidad, r.concepto),
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

revoke execute on function public.calcular_liquidacion(uuid) from public, anon;
revoke execute on function public.liquidar_modulo(uuid, date, text) from public, anon;
grant execute on function public.calcular_liquidacion(uuid) to authenticated;
grant execute on function public.liquidar_modulo(uuid, date, text) to authenticated;
