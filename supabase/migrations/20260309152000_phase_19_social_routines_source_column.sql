alter table public.social_routines
  add column if not exists source_routine_id text;

create unique index if not exists social_routines_owner_source_idx
  on public.social_routines (owner_user_id, source_routine_id)
  where deleted_at is null and source_routine_id is not null;
