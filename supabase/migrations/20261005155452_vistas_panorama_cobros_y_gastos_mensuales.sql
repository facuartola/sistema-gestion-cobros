
-- Cobros por mes calendario (según la fecha en que se cobró), por origen y método de pago.
create view cobros_mensuales with (security_invoker = true) as
select date_trunc('month', fecha_pago)::date as mes,
       'jugadores'::text as origen,
       coalesce(metodo_pago, 'sin_metodo') as metodo,
       sum(monto) as total,
       count(*)::int as cantidad
from cuotas_jugadores
where estado = 'pagado' and fecha_pago is not null
group by 1, 3
union all
select date_trunc('month', fecha_pago)::date,
       'alumnos',
       coalesce(metodo_pago, 'sin_metodo'),
       sum(monto),
       count(*)::int
from cuotas_alumnos
where estado = 'pagado' and fecha_pago is not null
group by 1, 3;

-- Gastos por mes y por tipo de gasto, con la ruta completa del árbol y su nivel
-- (1 = grupo principal, 2 = subgrupo, 3 = tipo final).
create view gastos_mensuales_por_tipo with (security_invoker = true) as
with recursive ruta as (
  select id, nombre, parent_id, nombre::text as ruta, 1 as nivel
  from categorias_gasto where parent_id is null
  union all
  select c.id, c.nombre, c.parent_id, r.ruta || ' > ' || c.nombre, r.nivel + 1
  from categorias_gasto c join ruta r on c.parent_id = r.id
)
select date_trunc('month', p.fecha_pago)::date as mes,
       p.categoria_id,
       r.ruta,
       r.nivel,
       sum(p.monto) as total,
       count(*)::int as cantidad
from pagos_gasto p
join ruta r on r.id = p.categoria_id
group by 1, 2, 3, 4;
