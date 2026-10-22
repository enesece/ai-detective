-- How everyone did on one case: finished games, how many named the right
-- killer, and the average score. Aggregates only, never a single player's
-- answers. The server sends it to a player only after their own accusation,
-- so it can't hint at the solution while they are still playing.

create or replace function public.case_stats(p_case_number integer)
returns table (finished integer, solved integer, average_score integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*)::integer,
    count(*) filter (where (g.result -> 'correct' ->> 'killer')::boolean)::integer,
    coalesce(round(avg(g.score)), 0)::integer
  from public.games g
  join public.cases c on c.id = g.case_id
  where c.case_number = p_case_number
    and c.status = 'approved'
    and g.status = 'finished';
$$;

revoke execute on function public.case_stats(integer) from public, anon, authenticated;
grant execute on function public.case_stats(integer) to service_role;
