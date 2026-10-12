
create or replace function private.proteger_categorias() returns trigger
language plpgsql set search_path = '' as $$
declare v_prof int; v_p uuid; v_alto int; v_guard int := 0;
begin
  if tg_op = 'DELETE' then
    if old.clave is not null then
      raise exception 'Este tipo de gasto lo usa el sistema y no se puede borrar';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.clave is not null then
    if new.clave is distinct from old.clave then
      raise exception 'Este tipo de gasto lo usa el sistema y no se puede modificar su identificación';
    end if;
    if new.parent_id is distinct from old.parent_id then
      raise exception 'Este tipo de gasto lo usa el sistema y no se puede mover';
    end if;
    if old.activo and not new.activo then
      raise exception 'Este tipo de gasto lo usa el sistema y no se puede desactivar';
    end if;
  end if;

  -- Nivel donde queda el tipo (máximo 3) y que no quede dentro de sí mismo.
  v_prof := 1;
  v_p := new.parent_id;
  while v_p is not null loop
    v_guard := v_guard + 1;
    if v_guard > 10 or v_p = new.id then
      raise exception 'Esa carpeta no es válida: un tipo de gasto no puede quedar dentro de sí mismo';
    end if;
    v_prof := v_prof + 1;
    select parent_id into v_p from public.categorias_gasto where id = v_p;
  end loop;

  -- Altura de lo que cuelga de este tipo (solo al mover o editar uno existente).
  v_alto := 0;
  if tg_op = 'UPDATE' then
    with recursive d as (
      select id, 1 as n from public.categorias_gasto where parent_id = new.id
      union all
      select c.id, d.n + 1 from public.categorias_gasto c join d on c.parent_id = d.id where d.n < 10
    )
    select coalesce(max(n), 0) into v_alto from d;
  end if;

  if v_prof + v_alto > 3 then
    raise exception 'Los tipos de gasto admiten hasta 3 niveles';
  end if;
  return new;
end $$;

revoke execute on function private.proteger_categorias() from public, anon, authenticated;

create trigger proteger_categorias
  before insert or update or delete on public.categorias_gasto
  for each row execute function private.proteger_categorias();
