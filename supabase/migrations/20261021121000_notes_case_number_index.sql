-- Covering index for the notes -> cases foreign key (Supabase performance advisor).
create index notes_case_number_idx on public.notes (case_number);
