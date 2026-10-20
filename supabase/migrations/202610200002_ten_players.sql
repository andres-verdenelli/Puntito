-- Limitar nuevas partidas sin alterar mesas ya creadas.
create or replace function public.create_game(p_id uuid, p_code text, p_host_hash text, p_names text[])
returns text language plpgsql security invoker set search_path = '' as $$
declare v_game public.games; v_inserted uuid;
begin
  if cardinality(p_names) is null or cardinality(p_names) not between 2 and 10 or
     exists (select 1 from unnest(p_names) n where n is null or length(btrim(n)) not between 1 and 30) or
     (select count(distinct lower(btrim(n))) from unnest(p_names) n) <> cardinality(p_names) then
    raise exception 'INVALID_NAMES';
  end if;
  insert into public.games(id, code, host_hash) values (p_id, p_code, p_host_hash)
  on conflict (id) do nothing returning id into v_inserted;
  select * into v_game from public.games where id = p_id for update;
  if v_game.host_hash <> p_host_hash then raise exception 'FORBIDDEN'; end if;
  if v_inserted is not null then
    insert into public.players(game_id, name, position)
    select p_id, btrim(n), (ordinality - 1)::integer from unnest(p_names) with ordinality as t(n, ordinality);
  elsif (select array_agg(name order by position) from public.players where game_id = p_id)
        is distinct from (select array_agg(btrim(n) order by ordinality) from unnest(p_names) with ordinality as t(n, ordinality)) then
    raise exception 'CONFLICT';
  end if;
  return v_game.code;
end;
$$;
