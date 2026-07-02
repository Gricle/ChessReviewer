-- ChessReviewer cloud schema: profiles, games, reviews, move_facts.
-- Every table has RLS so users only ever see their own rows.

-- ── profiles ──────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  chesscom_username text,
  lichess_username text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: own rows" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Auto-create a profile row on signup.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── games ─────────────────────────────────────────────────────────────────
create table public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pgn text not null,
  white_name text not null,
  black_name text not null,
  white_rating int,
  black_rating int,
  result text,
  played_at date,
  source text not null default 'paste',
  opening_eco text,
  opening_name text,
  created_at timestamptz not null default now()
);

-- Same game re-analyzed by the same user overwrites instead of duplicating.
create unique index games_user_pgn_uniq on public.games (user_id, md5(pgn));
create index games_user_created_idx on public.games (user_id, created_at desc);

alter table public.games enable row level security;

create policy "games: own rows" on public.games
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ── reviews ───────────────────────────────────────────────────────────────
create table public.reviews (
  game_id uuid primary key references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  white_accuracy real not null,
  black_accuracy real not null,
  white_est_rating int not null,
  black_est_rating int not null,
  counts jsonb not null,
  analysis jsonb not null,
  depth int not null,
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

create policy "reviews: own rows" on public.reviews
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ── move_facts (one row per move; fuels Phase 6 weakness reports) ────────
-- NOTE: motif tags (spec data-model) intentionally deferred to Phase 5; they
-- can be backfilled from reviews.analysis by re-running the detectors.
create table public.move_facts (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ply int not null,
  side text not null check (side in ('white', 'black')),
  classification text not null,
  win_drop real not null,
  phase text not null check (phase in ('opening', 'middlegame', 'endgame')),
  primary key (game_id, ply)
);

create index move_facts_user_idx on public.move_facts (user_id, classification);

alter table public.move_facts enable row level security;

create policy "move_facts: own rows" on public.move_facts
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
