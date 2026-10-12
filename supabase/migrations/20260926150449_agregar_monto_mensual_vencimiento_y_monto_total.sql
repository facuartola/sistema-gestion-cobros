
-- Cada jugador/alumno pasa a tener su propio monto mensual y día de vencimiento,
-- en vez de un valor fijo hardcodeado en el frontend para todos.
alter table jugadores add column monto_mensual numeric(10,2) not null default 15000;
alter table jugadores add column dia_vencimiento smallint check (dia_vencimiento between 1 and 31);

alter table alumnos add column monto_mensual numeric(10,2) not null default 10000;
alter table alumnos add column dia_vencimiento smallint check (dia_vencimiento between 1 and 31);

-- Solo los alumnos de la certificación tienen un costo total a abonar
-- (la certificación se paga en cuotas hasta cubrir ese total). Nullable:
-- si no se carga, el alumno se trata como pago mensual recurrente sin techo.
alter table alumnos add column monto_total numeric(10,2);
