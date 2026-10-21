-- Generated cases and publishing.
--
-- 1. Drafts have no case number yet. The number is given on approval, so
--    rejected drafts don't leave gaps in the public numbering (#1, #2, #3...).
-- 2. A case is visible to players only once its day has come. Before, an
--    approved case scheduled for next week could already be read and played.

alter table public.cases alter column case_number drop not null;

alter table public.cases
  add constraint cases_number_when_approved
  check (status = 'draft' or case_number is not null);

-- Browser roles: approved AND published (its day is today or in the past).
drop policy "Approved cases are readable" on public.cases;

create policy "Published cases are readable"
  on public.cases for select
  to anon, authenticated
  using (
    status = 'approved'
    and exists (
      select 1 from public.daily_schedule ds
      where ds.case_id = cases.id
        and ds.publish_date <= (now() at time zone 'utc')::date
    )
  );

-- The server can only start a game on a published case.
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
  join public.daily_schedule ds on ds.case_id = c.id
  where c.case_number = p_case_number
    and c.status = 'approved'
    and ds.publish_date <= (now() at time zone 'utc')::date;

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

-- `create or replace` keeps the existing grants, but restate them to be safe.
revoke execute on function public.start_game(uuid, integer) from public, anon, authenticated;
grant execute on function public.start_game(uuid, integer) to service_role;

create index case_reviews_created_at_idx on public.case_reviews (created_at desc);
