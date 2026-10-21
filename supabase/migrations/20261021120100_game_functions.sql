-- Game state transitions, run by the server with the service role.
--
-- Each function does its check and its update in one statement, so two
-- parallel requests can't both pass a check (e.g. both take question 20).
-- None of them can be called from the browser: execute is revoked from the
-- browser roles at the end of this file.

-- Returns the player's game for a case, creating it on first use.
-- Null if the case doesn't exist or isn't approved.
create or replace function public.start_game(p_player_id uuid, p_case_number integer)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_case_id uuid;
  v_game_id uuid;
begin
  select c.id into v_case_id
  from public.cases c
  where c.case_number = p_case_number and c.status = 'approved';

  if v_case_id is null then
    return null;
  end if;

  insert into public.games (player_id, case_id)
  values (p_player_id, v_case_id)
  on conflict (player_id, case_id) do nothing;

  select g.id into v_game_id
  from public.games g
  where g.player_id = p_player_id and g.case_id = v_case_id;

  return v_game_id;
end;
$$;

-- Counts a question before the AI is called. `error` is null on success.
create or replace function public.reserve_question(p_game_id uuid, p_limit integer)
returns table (used integer, error text)
language plpgsql
set search_path = ''
as $$
declare
  v_game public.games;
begin
  update public.games g
  set questions_used = g.questions_used + 1,
      busy_until = now() + interval '90 seconds'
  where g.id = p_game_id
    and g.status = 'playing'
    and g.questions_used < p_limit
    and (g.busy_until is null or g.busy_until < now())
  returning g.questions_used into used;

  if found then
    error := null;
    return next;
    return;
  end if;

  select * into v_game from public.games g where g.id = p_game_id;
  used := coalesce(v_game.questions_used, 0);
  error := case
    when v_game.id is null then 'not_found'
    when v_game.status <> 'playing' then 'game_over'
    when v_game.questions_used >= p_limit then 'limit_reached'
    else 'busy'
  end;
  return next;
end;
$$;

-- Gives a question back when the AI produced no answer.
create or replace function public.refund_question(p_game_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.games g
  set questions_used = greatest(g.questions_used - 1, 0),
      busy_until = null
  where g.id = p_game_id and g.status = 'playing';
$$;

-- Saves a finished answer and frees the game for the next question.
create or replace function public.complete_question(
  p_game_id uuid,
  p_suspect_id text,
  p_question text,
  p_answer text,
  p_locale text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.messages (game_id, suspect_id, question, answer, locale)
  values (p_game_id, p_suspect_id, p_question, p_answer, p_locale);

  update public.games g set busy_until = null where g.id = p_game_id;
end;
$$;

-- Unlocks the next hint if the case has one left.
create or replace function public.reveal_hint(p_game_id uuid, p_available integer)
returns table (used integer, error text)
language plpgsql
set search_path = ''
as $$
declare
  v_game public.games;
begin
  update public.games g
  set hints_used = g.hints_used + 1
  where g.id = p_game_id
    and g.status = 'playing'
    and g.hints_used < p_available
  returning g.hints_used into used;

  if found then
    error := null;
    return next;
    return;
  end if;

  select * into v_game from public.games g where g.id = p_game_id;
  used := coalesce(v_game.hints_used, 0);
  error := case
    when v_game.id is null then 'not_found'
    when v_game.status <> 'playing' then 'game_over'
    else 'no_hints_left'
  end;
  return next;
end;
$$;

-- Records the single accusation. The server computed the result from the
-- counters it read; `p_expected_*` make sure they haven't changed since.
-- Also updates the player's streak when the case is on the daily schedule.
create or replace function public.finish_game(
  p_game_id uuid,
  p_expected_questions integer,
  p_expected_hints integer,
  p_accusation jsonb,
  p_result jsonb,
  p_score integer,
  p_solved boolean
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_game public.games;
  v_date date;
begin
  update public.games g
  set status = 'finished',
      accusation = p_accusation,
      result = p_result,
      score = p_score,
      finished_at = now(),
      busy_until = null
  where g.id = p_game_id
    and g.status = 'playing'
    and g.questions_used = p_expected_questions
    and g.hints_used = p_expected_hints
    and (g.busy_until is null or g.busy_until < now())
  returning * into v_game;

  if not found then
    select * into v_game from public.games g where g.id = p_game_id;
    return case
      when v_game.id is null then 'not_found'
      when v_game.status <> 'playing' then 'game_over'
      else 'busy'
    end;
  end if;

  select ds.publish_date into v_date
  from public.daily_schedule ds
  where ds.case_id = v_game.case_id;

  if v_date is not null then
    update public.profiles p
    set streak = case
          when not p_solved then 0
          when p.last_solved_date = v_date then p.streak
          when p.last_solved_date = v_date - 1 then p.streak + 1
          else 1
        end,
        last_solved_date = case when p_solved then v_date else p.last_solved_date end
    where p.id = v_game.player_id;

    update public.profiles p
    set best_streak = greatest(p.best_streak, p.streak)
    where p.id = v_game.player_id;
  end if;

  return null;
end;
$$;

-- Functions in `public` are executable by everyone by default in Supabase.
-- These change game state, so only the server (service role) may call them.
revoke execute on function public.start_game(uuid, integer) from public, anon, authenticated;
revoke execute on function public.reserve_question(uuid, integer) from public, anon, authenticated;
revoke execute on function public.refund_question(uuid) from public, anon, authenticated;
revoke execute on function public.complete_question(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.reveal_hint(uuid, integer) from public, anon, authenticated;
revoke execute on function public.finish_game(uuid, integer, integer, jsonb, jsonb, integer, boolean) from public, anon, authenticated;

grant execute on function public.start_game(uuid, integer) to service_role;
grant execute on function public.reserve_question(uuid, integer) to service_role;
grant execute on function public.refund_question(uuid) to service_role;
grant execute on function public.complete_question(uuid, text, text, text, text) to service_role;
grant execute on function public.reveal_hint(uuid, integer) to service_role;
grant execute on function public.finish_game(uuid, integer, integer, jsonb, jsonb, integer, boolean) to service_role;
