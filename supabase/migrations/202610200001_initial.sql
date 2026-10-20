-- Ejecutar una vez en el SQL Editor de un proyecto Supabase Free.
-- El navegador nunca accede a estas tablas ni funciones directamente.
create table public.games (
  id uuid primary key,
  code text not null unique check (code ~ '^[a-f0-9]{12}$'),
  host_hash text not null check (host_hash ~ '^[a-f0-9]{64}$'),
  round_count integer not null default 0 check (round_count >= 0),
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 30),
  position integer not null check (position between 0 and 19),
  unique (game_id, position),
  unique (game_id, id)
);

create table public.rounds (
  id uuid primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  number integer not null check (number > 0),
  created_at timestamptz not null default now(),
  unique (game_id, number),
  unique (game_id, id)
);

create table public.scores (
  game_id uuid not null,
  round_id uuid not null,
  player_id uuid not null,
  points integer not null check (points in (0, 5, 6, 7, 8)),
  primary key (round_id, player_id),
  foreign key (game_id, round_id) references public.rounds(game_id, id) on delete cascade,
  foreign key (game_id, player_id) references public.players(game_id, id) on delete cascade
);
create index scores_player_idx on public.scores(player_id);

alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.rounds enable row level security;
alter table public.scores enable row level security;
revoke all on public.games, public.players, public.rounds, public.scores from anon, authenticated;
grant all on public.games, public.players, public.rounds, public.scores to service_role;

-- Una sola consulta obtiene una versión consistente del marcador.
create function public.read_game(p_code text, p_host_hash text default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'game', jsonb_build_object(
      'code', g.code, 'roundCount', g.round_count,
      'players', (select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'position', p.position,
        'total', (select coalesce(sum(s.points), 0) from public.scores s where s.player_id = p.id)
      ) order by p.position) from public.players p where p.game_id = g.id)
    ),
    'canEdit', coalesce(g.host_hash = p_host_hash, false)
  ) from public.games g where g.code = p_code;
$$;

create function public.create_game(p_id uuid, p_code text, p_host_hash text, p_names text[])
returns text language plpgsql security invoker set search_path = '' as $$
declare v_game public.games; v_inserted uuid;
begin
  if cardinality(p_names) is null or cardinality(p_names) not between 2 and 20 or
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

create function public.save_round(p_code text, p_host_hash text, p_id uuid, p_base_round integer, p_points integer[])
returns void language plpgsql security invoker set search_path = '' as $$
declare v_game public.games; v_round public.rounds; v_previous integer[];
begin
  select * into v_game from public.games where code = p_code for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_host_hash is null or v_game.host_hash <> p_host_hash then raise exception 'FORBIDDEN'; end if;
  if cardinality(p_points) is distinct from (select count(*)::integer from public.players where game_id = v_game.id)
     or exists (select 1 from unnest(p_points) p where p is null or p not in (0, 5, 6, 7, 8)) then
    raise exception 'INVALID_POINTS';
  end if;
  select * into v_round from public.rounds where id = p_id;
  if found then
    select array_agg(s.points order by pl.position) into v_previous
    from public.scores s join public.players pl on pl.id = s.player_id where s.round_id = p_id;
    if v_round.game_id <> v_game.id or v_round.number is distinct from p_base_round + 1 or v_previous is distinct from p_points then
      raise exception 'CONFLICT';
    end if;
    return; -- Respuesta perdida o doble clic: la misma ronda no se vuelve a sumar.
  end if;
  if p_base_round is distinct from v_game.round_count then raise exception 'STALE_ROUND'; end if;
  insert into public.rounds(id, game_id, number) values (p_id, v_game.id, v_game.round_count + 1);
  insert into public.scores(game_id, round_id, player_id, points)
  select v_game.id, p_id, pl.id, p_points[pl.position + 1]
  from public.players pl where pl.game_id = v_game.id;
  update public.games set round_count = round_count + 1 where id = v_game.id;
end;
$$;

revoke all on function public.read_game(text, text) from public, anon, authenticated;
revoke all on function public.create_game(uuid, text, text, text[]) from public, anon, authenticated;
revoke all on function public.save_round(text, text, uuid, integer, integer[]) from public, anon, authenticated;
grant execute on function public.read_game(text, text) to service_role;
grant execute on function public.create_game(uuid, text, text, text[]) to service_role;
grant execute on function public.save_round(text, text, uuid, integer, integer[]) to service_role;
