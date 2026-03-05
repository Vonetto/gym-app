create table public.user_schedule_series (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  routine_id text not null,
  kind text not null,
  start_date text not null,
  weekdays jsonb not null default '[]'::jsonb,
  end_date text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (user_id, id)
);

create index user_schedule_series_user_updated_idx
  on public.user_schedule_series (user_id, updated_at desc);

create table public.user_schedule_occurrences (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  series_id text not null,
  occurrence_date text not null,
  status text not null,
  workout_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (user_id, id)
);

create index user_schedule_occurrences_user_updated_idx
  on public.user_schedule_occurrences (user_id, updated_at desc);

create table public.user_notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  notifications_enabled boolean not null default false,
  planned_enabled boolean not null default false,
  rest_enabled boolean not null default true,
  background_session_enabled boolean not null default false,
  planned_reminder_time text not null default '19:00',
  planned_reminder_offset_minutes integer not null default 0,
  background_session_delay_minutes integer not null default 10,
  timezone text not null default 'UTC',
  updated_at timestamptz not null,
  primary key (user_id)
);

create table public.user_push_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  endpoint text not null,
  subscription_json jsonb not null,
  user_agent text,
  platform text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (user_id, id)
);

create index user_push_subscriptions_user_updated_idx
  on public.user_push_subscriptions (user_id, updated_at desc);

create table public.user_notification_deliveries (
  id text not null primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  occurrence_id text not null,
  delivered_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb
);

create index user_notification_deliveries_user_delivered_idx
  on public.user_notification_deliveries (user_id, delivered_at desc);

alter table public.user_schedule_series enable row level security;
alter table public.user_schedule_occurrences enable row level security;
alter table public.user_notification_preferences enable row level security;
alter table public.user_push_subscriptions enable row level security;
alter table public.user_notification_deliveries enable row level security;

create policy "user_schedule_series_select_own"
on public.user_schedule_series
for select
using (auth.uid() = user_id);

create policy "user_schedule_series_insert_own"
on public.user_schedule_series
for insert
with check (auth.uid() = user_id);

create policy "user_schedule_series_update_own"
on public.user_schedule_series
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_schedule_series_delete_own"
on public.user_schedule_series
for delete
using (auth.uid() = user_id);

create policy "user_schedule_occurrences_select_own"
on public.user_schedule_occurrences
for select
using (auth.uid() = user_id);

create policy "user_schedule_occurrences_insert_own"
on public.user_schedule_occurrences
for insert
with check (auth.uid() = user_id);

create policy "user_schedule_occurrences_update_own"
on public.user_schedule_occurrences
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_schedule_occurrences_delete_own"
on public.user_schedule_occurrences
for delete
using (auth.uid() = user_id);

create policy "user_notification_preferences_select_own"
on public.user_notification_preferences
for select
using (auth.uid() = user_id);

create policy "user_notification_preferences_insert_own"
on public.user_notification_preferences
for insert
with check (auth.uid() = user_id);

create policy "user_notification_preferences_update_own"
on public.user_notification_preferences
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_notification_preferences_delete_own"
on public.user_notification_preferences
for delete
using (auth.uid() = user_id);

create policy "user_push_subscriptions_select_own"
on public.user_push_subscriptions
for select
using (auth.uid() = user_id);

create policy "user_push_subscriptions_insert_own"
on public.user_push_subscriptions
for insert
with check (auth.uid() = user_id);

create policy "user_push_subscriptions_update_own"
on public.user_push_subscriptions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_push_subscriptions_delete_own"
on public.user_push_subscriptions
for delete
using (auth.uid() = user_id);

create policy "user_notification_deliveries_select_own"
on public.user_notification_deliveries
for select
using (auth.uid() = user_id);
