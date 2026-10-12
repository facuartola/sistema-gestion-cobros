
-- Los pagos son en USD, así que solo hay dos formas reales: efectivo o
-- transferencia. Nullable porque no aplica a una cuota todavía pendiente.
alter table cuotas_jugadores add column metodo_pago text
  check (metodo_pago in ('efectivo','transferencia'));
alter table cuotas_alumnos add column metodo_pago text
  check (metodo_pago in ('efectivo','transferencia'));
