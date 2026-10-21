-- Fixed-window rate limiting in Postgres (no extra service needed).
-- Keys look like "ask:player:<uuid>", "ask:ip:<hmac>" or "ai:day". IPs are
-- stored only as an HMAC computed by the server, never in plain text.

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

-- RLS on, no policies, no grants: only the service role can touch it.
alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anon, authenticated;

-- Counts one hit against every (key, limit, window) rule at once.
-- Returns true when the request is within all limits. All rules are counted
-- even when one is exceeded, so hammering doesn't reset anything.
create or replace function public.check_rate_limits(
  p_keys text[],
  p_limits integer[],
  p_window_seconds integer[]
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_allowed boolean := true;
  v_count integer;
  v_window timestamptz;
begin
  if array_length(p_keys, 1) is distinct from array_length(p_limits, 1)
     or array_length(p_keys, 1) is distinct from array_length(p_window_seconds, 1) then
    raise exception 'check_rate_limits: arrays must have the same length';
  end if;

  for i in 1 .. coalesce(array_length(p_keys, 1), 0) loop
    v_window := to_timestamp(
      floor(extract(epoch from now()) / p_window_seconds[i]) * p_window_seconds[i]
    );

    insert into public.rate_limits as r (key, window_start, count)
    values (p_keys[i], v_window, 1)
    on conflict (key, window_start) do update set count = r.count + 1
    returning r.count into v_count;

    if v_count > p_limits[i] then
      v_allowed := false;
    end if;
  end loop;

  -- Occasional cleanup of old windows (about 1 call in 100).
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;

  return v_allowed;
end;
$$;

revoke execute on function public.check_rate_limits(text[], integer[], integer[]) from public, anon, authenticated;
grant execute on function public.check_rate_limits(text[], integer[], integer[]) to service_role;
