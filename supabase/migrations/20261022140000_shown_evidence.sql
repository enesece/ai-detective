-- "Show evidence": a question can come with one piece of (public) evidence the
-- detective puts in front of the suspect. Stored with the message so history,
-- reloads and the result screen know what was shown.

alter table public.messages add column shown_evidence_id text;

-- Same function with one more parameter. The old signature is dropped so there
-- is exactly one way to save a question.
drop function public.complete_question(uuid, text, text, text, text);

create function public.complete_question(
  p_game_id uuid,
  p_suspect_id text,
  p_question text,
  p_answer text,
  p_locale text,
  p_shown_evidence_id text default null
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.messages (game_id, suspect_id, question, answer, locale, shown_evidence_id)
  values (p_game_id, p_suspect_id, p_question, p_answer, p_locale, p_shown_evidence_id);

  update public.games g set busy_until = null where g.id = p_game_id;
end;
$$;

revoke execute on function public.complete_question(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_question(uuid, text, text, text, text, text) to service_role;
