create table public.user_custom_exercises (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  base_name text not null,
  normalized_name text not null,
  muscles jsonb not null default '[]'::jsonb,
  equipment jsonb not null default '[]'::jsonb,
  metric_type text not null,
  translations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (user_id, id)
);

create index user_custom_exercises_user_updated_idx
  on public.user_custom_exercises (user_id, updated_at desc);

create table public.user_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (user_id, exercise_id)
);

create index user_favorites_user_updated_idx
  on public.user_favorites (user_id, updated_at desc);

create table public.user_routines (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  order_index integer not null default 0,
  tags jsonb not null default '[]'::jsonb,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (user_id, id)
);

create index user_routines_user_updated_idx
  on public.user_routines (user_id, updated_at desc);

create table public.user_workouts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  routine_id text,
  routine_name text,
  tags jsonb not null default '[]'::jsonb,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  exercises jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (user_id, id)
);

create index user_workouts_user_updated_idx
  on public.user_workouts (user_id, updated_at desc);

alter table public.user_custom_exercises enable row level security;
alter table public.user_favorites enable row level security;
alter table public.user_routines enable row level security;
alter table public.user_workouts enable row level security;

create policy "user_custom_exercises_select_own"
on public.user_custom_exercises
for select
using (auth.uid() = user_id);

create policy "user_custom_exercises_insert_own"
on public.user_custom_exercises
for insert
with check (auth.uid() = user_id);

create policy "user_custom_exercises_update_own"
on public.user_custom_exercises
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_custom_exercises_delete_own"
on public.user_custom_exercises
for delete
using (auth.uid() = user_id);

create policy "user_favorites_select_own"
on public.user_favorites
for select
using (auth.uid() = user_id);

create policy "user_favorites_insert_own"
on public.user_favorites
for insert
with check (auth.uid() = user_id);

create policy "user_favorites_update_own"
on public.user_favorites
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_favorites_delete_own"
on public.user_favorites
for delete
using (auth.uid() = user_id);

create policy "user_routines_select_own"
on public.user_routines
for select
using (auth.uid() = user_id);

create policy "user_routines_insert_own"
on public.user_routines
for insert
with check (auth.uid() = user_id);

create policy "user_routines_update_own"
on public.user_routines
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_routines_delete_own"
on public.user_routines
for delete
using (auth.uid() = user_id);

create policy "user_workouts_select_own"
on public.user_workouts
for select
using (auth.uid() = user_id);

create policy "user_workouts_insert_own"
on public.user_workouts
for insert
with check (auth.uid() = user_id);

create policy "user_workouts_update_own"
on public.user_workouts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_workouts_delete_own"
on public.user_workouts
for delete
using (auth.uid() = user_id);
