
-- Red de seguridad en la base: la app ya valida esto, pero la base no debe
-- aceptar datos absurdos si algún día falla una validación o se carga algo a mano.
alter table jugadores
  add constraint jugadores_nombre_largo check (length(btrim(nombre)) between 1 and 120),
  add constraint jugadores_monto_mensual_rango check (monto_mensual >= 0 and monto_mensual < 1000000),
  add constraint jugadores_contacto_largo check (contacto is null or length(contacto) <= 300),
  add constraint jugadores_notas_largo check (notas is null or length(notas) <= 2000);

alter table alumnos
  add constraint alumnos_nombre_largo check (length(btrim(nombre)) between 1 and 120),
  add constraint alumnos_monto_mensual_rango check (monto_mensual >= 0 and monto_mensual < 1000000),
  add constraint alumnos_monto_total_rango check (monto_total is null or (monto_total >= 0 and monto_total < 1000000)),
  add constraint alumnos_contacto_largo check (contacto is null or length(contacto) <= 300),
  add constraint alumnos_notas_largo check (notas is null or length(notas) <= 2000);

alter table cuotas_jugadores
  add constraint cuotas_jugadores_monto_rango check (monto >= 0 and monto < 1000000),
  add constraint cuotas_jugadores_mes_dia_1 check (extract(day from mes) = 1);

alter table cuotas_alumnos
  add constraint cuotas_alumnos_monto_rango check (monto >= 0 and monto < 1000000),
  add constraint cuotas_alumnos_mes_dia_1 check (extract(day from mes) = 1);

alter table recordatorios
  add constraint recordatorios_titulo_largo check (length(btrim(titulo)) between 1 and 200),
  add constraint recordatorios_nota_largo check (nota is null or length(nota) <= 2000);
