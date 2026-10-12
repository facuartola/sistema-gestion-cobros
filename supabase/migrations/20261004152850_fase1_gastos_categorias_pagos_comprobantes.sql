
-- Árbol de categorías de gastos, editable por la usuaria (sin depender de código).
-- La recurrencia vive en la categoría: Wifi/Celulares mensuales, Zoom anual, etc.
create table categorias_gasto (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 1 and 80),
  parent_id uuid references categorias_gasto(id) on delete restrict,
  orden int not null default 0,
  recurrencia text not null default 'ninguna'
    check (recurrencia in ('ninguna','mensual','anual')),
  monto_estimado numeric(10,2) check (monto_estimado is null or monto_estimado >= 0),
  dia_vencimiento smallint check (dia_vencimiento between 1 and 31),
  mes_vencimiento smallint check (mes_vencimiento between 1 and 12),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique nulls not distinct (parent_id, nombre),
  check (recurrencia <> 'anual' or mes_vencimiento is not null)
);
create index on categorias_gasto (parent_id);

-- Pagos realizados (egresos). Todo en USD.
-- periodo: primer día del mes (gastos mensuales) o del año (anuales) que cubre
-- el pago; null para pagos sueltos.
create table pagos_gasto (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references categorias_gasto(id) on delete restrict,
  fecha_pago date not null,
  periodo date check (periodo is null or extract(day from periodo) = 1),
  monto numeric(10,2) not null check (monto > 0 and monto < 1000000),
  metodo_pago text check (metodo_pago in ('efectivo','transferencia')),
  descripcion text check (descripcion is null or length(descripcion) <= 300),
  proveedor text check (proveedor is null or length(proveedor) <= 120),
  comprobante_path text,
  created_at timestamptz not null default now()
);
create index on pagos_gasto (categoria_id, periodo);
create index on pagos_gasto (fecha_pago);

alter table categorias_gasto enable row level security;
alter table pagos_gasto enable row level security;
create policy "solo admins" on categorias_gasto for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));
create policy "solo admins" on pagos_gasto for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));

-- Estructura inicial tal cual la pidió la clienta.
do $$
declare
  v_fijos uuid; v_variables uuid; v_mkt uuid; v_app uuid; v_coaches uuid;
begin
  insert into categorias_gasto (nombre, orden) values ('Gastos fijos', 1)
    returning id into v_fijos;
  insert into categorias_gasto (nombre, parent_id, orden, recurrencia, dia_vencimiento)
    values ('Wifi', v_fijos, 1, 'mensual', 10);
  insert into categorias_gasto (nombre, parent_id, orden, recurrencia, mes_vencimiento)
    values ('Zoom', v_fijos, 2, 'anual', 7);
  insert into categorias_gasto (nombre, parent_id, orden, recurrencia, dia_vencimiento)
    values ('Celulares', v_fijos, 3, 'mensual', 10);

  insert into categorias_gasto (nombre, orden) values ('Gastos variables', 2)
    returning id into v_variables;

  insert into categorias_gasto (nombre, parent_id, orden)
    values ('Equipo de marketing', v_variables, 1) returning id into v_mkt;
  insert into categorias_gasto (nombre, parent_id, orden) values
    ('Consultora de marketing', v_mkt, 1),
    ('Producciones fotográficas y videos', v_mkt, 2);

  insert into categorias_gasto (nombre, parent_id, orden)
    values ('Diseño, desarrollo y mantenimiento app', v_variables, 2) returning id into v_app;
  insert into categorias_gasto (nombre, parent_id, orden, recurrencia, monto_estimado)
    values ('Mantenimiento', v_app, 1, 'mensual', 100);
  insert into categorias_gasto (nombre, parent_id, orden)
    values ('Desarrollo', v_app, 2);

  insert into categorias_gasto (nombre, parent_id, orden)
    values ('Equipo de coaches', v_variables, 3) returning id into v_coaches;
  insert into categorias_gasto (nombre, parent_id, orden) values
    ('Pago de sesiones', v_coaches, 1),
    ('Pago de encuentros', v_coaches, 2);
end $$;

-- Comprobantes: bucket privado, solo imágenes y PDF, hasta 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 5242880,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy "comprobantes: admins leen" on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and (select private.es_admin()));
create policy "comprobantes: admins suben" on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and (select private.es_admin()));
create policy "comprobantes: admins borran" on storage.objects for delete to authenticated
  using (bucket_id = 'comprobantes' and (select private.es_admin()));
