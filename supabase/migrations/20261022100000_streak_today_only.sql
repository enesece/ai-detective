-- Streaks count only the case of the day.
--
-- Before, solving an archive case also updated the streak and could move
-- last_solved_date back in time. Same function, one changed condition.

-- Records the single accusation. The server computed the result from the
-- counters it read; `p_expected_*` make sure they haven't changed since.
-- Also updates the player's streak, but only for the case of the day.
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

  -- Only today's case counts: replaying an archive case leaves the streak alone.
  if v_date = (now() at time zone 'utc')::date then
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

revoke execute on function public.finish_game(uuid, integer, integer, jsonb, jsonb, integer, boolean) from public, anon, authenticated;
grant execute on function public.finish_game(uuid, integer, integer, jsonb, jsonb, integer, boolean) to service_role;
