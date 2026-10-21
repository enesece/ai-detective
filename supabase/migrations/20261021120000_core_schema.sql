-- Daily AI Detective: core schema.
--
-- Golden rule: the secret half of a case (killer, timeline, suspects' secrets,
-- hints) is never readable from the browser. Browser roles (anon,
-- authenticated) only get the columns and rows granted below; the server uses
-- the service role for everything else.
--
-- Game state (question counter, messages, accusation) is written only by the
-- server, through the functions in the next migration, so a player can't
-- give themselves extra questions.

-- Keeps updated_at current on every update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- cases
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  case_number integer not null unique check (case_number > 0),
  status text not null default 'draft' check (status in ('draft', 'approved')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  public_briefing jsonb not null,
  secret jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.cases.secret is
  'Killer, true timeline, every suspect''s secrets and hints. Service role only.';

create trigger cases_set_updated_at
  before update on public.cases
  for each row execute function public.set_updated_at();

alter table public.cases enable row level security;

-- Column-level privileges: browser roles can read every column except `secret`.
-- Even `select *` fails for them, so the secret can't leak by accident.
revoke all on table public.cases from anon, authenticated;
grant select (id, case_number, status, difficulty, public_briefing, created_at)
  on table public.cases to anon, authenticated;

create policy "Approved cases are readable"
  on public.cases for select
  to anon, authenticated
  using (status = 'approved');

-- ------------------------------------------------------- daily_schedule
create table public.daily_schedule (
  publish_date date primary key,
  case_id uuid not null unique references public.cases (id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.daily_schedule enable row level security;
revoke all on table public.daily_schedule from anon, authenticated;
grant select on table public.daily_schedule to anon, authenticated;

-- Future days stay hidden, so nobody can peek at tomorrow's case.
create policy "Published days are readable"
  on public.daily_schedule for select
  to anon, authenticated
  using (publish_date <= (now() at time zone 'utc')::date);

-- ------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username is null or username ~ '^[A-Za-z0-9_]{3,20}$'),
  language text not null default 'en' check (language in ('en', 'tr')),
  streak integer not null default 0 check (streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  last_solved_date date,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
-- Players may change their name and language, never their streak.
grant update (username, language) on table public.profiles to authenticated;

create policy "Players read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Players update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Every new user (anonymous ones too) gets a profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- games
create table public.games (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references auth.users (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  status text not null default 'playing' check (status in ('playing', 'finished')),
  questions_used integer not null default 0 check (questions_used >= 0),
  hints_used integer not null default 0 check (hints_used >= 0),
  -- Set while an answer is streaming, so a player can't run questions in parallel.
  busy_until timestamptz,
  accusation jsonb,
  result jsonb,
  score integer,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (player_id, case_id)
);

create index games_case_id_idx on public.games (case_id);

alter table public.games enable row level security;
revoke all on table public.games from anon, authenticated;
grant select on table public.games to authenticated;

create policy "Players read their own games"
  on public.games for select
  to authenticated
  using ((select auth.uid()) = player_id);

-- ------------------------------------------------------------- messages
create table public.messages (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games (id) on delete cascade,
  suspect_id text not null,
  question text not null check (char_length(question) <= 280),
  answer text not null,
  locale text not null check (locale in ('en', 'tr')),
  created_at timestamptz not null default now()
);

create index messages_game_id_idx on public.messages (game_id, id);

alter table public.messages enable row level security;
revoke all on table public.messages from anon, authenticated;
grant select on table public.messages to authenticated;

create policy "Players read messages from their own games"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id and g.player_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------- notes
-- The player's notebook. Only public case text and their own answers live
-- here, so the browser writes it directly; RLS keeps it private.
create table public.notes (
  player_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  case_number integer not null references public.cases (case_number) on delete cascade,
  text text not null default '' check (char_length(text) <= 5000),
  pins jsonb not null default '[]'::jsonb check (
    jsonb_typeof(pins) = 'array'
    and jsonb_array_length(pins) <= 200
    and pg_column_size(pins) <= 200000
  ),
  updated_at timestamptz not null default now(),
  primary key (player_id, case_number)
);

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

alter table public.notes enable row level security;
revoke all on table public.notes from anon, authenticated;
grant select, insert, update on table public.notes to authenticated;

create policy "Players read their own notes"
  on public.notes for select
  to authenticated
  using ((select auth.uid()) = player_id);

create policy "Players create their own notes"
  on public.notes for insert
  to authenticated
  with check ((select auth.uid()) = player_id);

create policy "Players update their own notes"
  on public.notes for update
  to authenticated
  using ((select auth.uid()) = player_id)
  with check ((select auth.uid()) = player_id);

-- --------------------------------------------------------- case_reviews
-- Validation results and admin notes for generated cases (phase 4).
-- RLS on with no policies: only the service role can touch it.
create table public.case_reviews (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  checks jsonb not null default '{}'::jsonb,
  decision text not null default 'pending' check (decision in ('pending', 'approved', 'rejected')),
  admin_notes text,
  created_at timestamptz not null default now()
);

create index case_reviews_case_id_idx on public.case_reviews (case_id);

alter table public.case_reviews enable row level security;
revoke all on table public.case_reviews from anon, authenticated;
