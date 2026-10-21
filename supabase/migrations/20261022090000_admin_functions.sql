-- Admin actions on generated cases. Called by the server (service role) after
-- it has checked that the caller is an admin; never callable from the browser.

-- Approves a draft: gives it the next case number and, optionally, a day.
-- One transaction, so the number, the status and the schedule change together.
create or replace function public.approve_case(p_case_id uuid, p_publish_date date default null)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_number integer;
begin
  -- Two approvals at once must not get the same number.
  lock table public.cases in share row exclusive mode;

  perform 1 from public.cases c where c.id = p_case_id and c.status = 'draft';
  if not found then
    raise exception 'case % is not a draft', p_case_id using errcode = 'P0002';
  end if;

  if p_publish_date is not null and p_publish_date < (now() at time zone 'utc')::date then
    raise exception 'publish date % is in the past', p_publish_date using errcode = '22023';
  end if;

  select coalesce(max(c.case_number), 0) + 1 into v_number from public.cases c;

  update public.cases c
  set status = 'approved', case_number = v_number
  where c.id = p_case_id;

  if p_publish_date is not null then
    -- Fails with a unique violation if that day is already taken.
    insert into public.daily_schedule (publish_date, case_id) values (p_publish_date, p_case_id);
  end if;

  update public.case_reviews r
  set decision = 'approved'
  where r.id = (
    select r2.id from public.case_reviews r2
    where r2.case_id = p_case_id
    order by r2.created_at desc
    limit 1
  );

  return v_number;
end;
$$;

-- Puts an approved, unscheduled case on a free day (today or later).
create or replace function public.schedule_case(p_case_id uuid, p_publish_date date)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.cases c where c.id = p_case_id and c.status = 'approved';
  if not found then
    raise exception 'case % is not approved', p_case_id using errcode = 'P0002';
  end if;
  if p_publish_date < (now() at time zone 'utc')::date then
    raise exception 'publish date % is in the past', p_publish_date using errcode = '22023';
  end if;
  insert into public.daily_schedule (publish_date, case_id) values (p_publish_date, p_case_id);
end;
$$;

-- Frees a future day. Days that are today or past stay: players may have played them.
create or replace function public.unschedule_day(p_publish_date date)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_publish_date <= (now() at time zone 'utc')::date then
    raise exception 'only future days can be unscheduled' using errcode = '22023';
  end if;
  delete from public.daily_schedule ds where ds.publish_date = p_publish_date;
end;
$$;

revoke execute on function public.approve_case(uuid, date) from public, anon, authenticated;
revoke execute on function public.schedule_case(uuid, date) from public, anon, authenticated;
revoke execute on function public.unschedule_day(date) from public, anon, authenticated;
grant execute on function public.approve_case(uuid, date) to service_role;
grant execute on function public.schedule_case(uuid, date) to service_role;
grant execute on function public.unschedule_day(date) to service_role;
