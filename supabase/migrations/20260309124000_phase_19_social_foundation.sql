create table public.profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  display_name text,
  bio text,
  avatar_path text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (user_id),
  constraint profiles_username_format_check check (username ~ '^[a-z0-9._-]{3,30}$')
);

create unique index profiles_username_unique_idx
  on public.profiles (lower(username))
  where deleted_at is null;

create index profiles_updated_idx
  on public.profiles (updated_at desc);

create table public.profile_privacy_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_visibility text not null default 'authenticated',
  routines_visibility text not null default 'authenticated',
  recent_history_visibility text not null default 'private',
  pr_visibility text not null default 'private',
  stats_visibility text not null default 'authenticated',
  allow_follow boolean not null default true,
  allow_friend_requests boolean not null default true,
  updated_at timestamptz not null,
  primary key (user_id),
  constraint profile_privacy_profile_visibility_check
    check (profile_visibility in ('authenticated', 'friends')),
  constraint profile_privacy_routines_visibility_check
    check (routines_visibility in ('authenticated', 'friends', 'private')),
  constraint profile_privacy_recent_history_visibility_check
    check (recent_history_visibility in ('authenticated', 'friends', 'private')),
  constraint profile_privacy_pr_visibility_check
    check (pr_visibility in ('authenticated', 'friends', 'private')),
  constraint profile_privacy_stats_visibility_check
    check (stats_visibility in ('authenticated', 'friends', 'private'))
);

create table public.user_follows (
  follower_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (follower_user_id, target_user_id),
  constraint user_follows_self_check check (follower_user_id <> target_user_id)
);

create index user_follows_target_updated_idx
  on public.user_follows (target_user_id, updated_at desc);

create table public.user_friendships (
  id text not null primary key,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  addressee_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  responded_at timestamptz,
  deleted_at timestamptz,
  constraint user_friendships_status_check check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  constraint user_friendships_self_check check (requester_user_id <> addressee_user_id)
);

create unique index user_friendships_unique_pair_idx
  on public.user_friendships (
    least(requester_user_id, addressee_user_id),
    greatest(requester_user_id, addressee_user_id)
  )
  where deleted_at is null;

create index user_friendships_requester_updated_idx
  on public.user_friendships (requester_user_id, updated_at desc);

create index user_friendships_addressee_updated_idx
  on public.user_friendships (addressee_user_id, updated_at desc);

create table public.social_routines (
  id text not null primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source_routine_id text,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  author_username text not null,
  author_display_name text,
  title text not null,
  description text,
  tags jsonb not null default '[]'::jsonb,
  snapshot jsonb not null,
  custom_exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  published_at timestamptz not null,
  deleted_at timestamptz
);

create index social_routines_owner_updated_idx
  on public.social_routines (owner_user_id, updated_at desc);

create unique index social_routines_owner_source_idx
  on public.social_routines (owner_user_id, source_routine_id)
  where deleted_at is null and source_routine_id is not null;

create index social_routines_published_idx
  on public.social_routines (published_at desc)
  where deleted_at is null;

create index social_routines_title_idx
  on public.social_routines (title);

create table public.social_workout_posts (
  id text not null primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  workout_id text,
  routine_id text,
  routine_name text,
  caption text,
  visibility text not null default 'authenticated',
  tags jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  published_at timestamptz not null,
  deleted_at timestamptz,
  constraint social_workout_posts_visibility_check check (visibility in ('authenticated', 'friends'))
);

create index social_workout_posts_owner_published_idx
  on public.social_workout_posts (owner_user_id, published_at desc);

create index social_workout_posts_published_idx
  on public.social_workout_posts (published_at desc)
  where deleted_at is null;

create table public.social_post_likes (
  post_id text not null references public.social_workout_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (post_id, user_id)
);

create index social_post_likes_user_updated_idx
  on public.social_post_likes (user_id, updated_at desc);

create table public.social_post_comments (
  id text not null primary key,
  post_id text not null references public.social_workout_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index social_post_comments_post_created_idx
  on public.social_post_comments (post_id, created_at asc)
  where deleted_at is null;

create index social_post_comments_user_updated_idx
  on public.social_post_comments (user_id, updated_at desc);

create table public.social_pr_highlights (
  id text not null primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  exercise_name text not null,
  metric_type text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index social_pr_highlights_owner_updated_idx
  on public.social_pr_highlights (owner_user_id, updated_at desc);

create or replace function public.social_is_friend(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_friendships friendship
    where friendship.deleted_at is null
      and friendship.status = 'accepted'
      and least(friendship.requester_user_id, friendship.addressee_user_id) = least(auth.uid(), target_user_id)
      and greatest(friendship.requester_user_id, friendship.addressee_user_id) = greatest(auth.uid(), target_user_id)
  );
$$;

create or replace function public.social_can_view_scope(target_user_id uuid, scope text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  visibility text;
begin
  if auth.role() <> 'authenticated' or auth.uid() is null then
    return false;
  end if;

  if auth.uid() = target_user_id then
    return true;
  end if;

  if scope = 'profile' then
    select coalesce(profile_visibility, 'authenticated')
      into visibility
    from public.profile_privacy_settings
    where user_id = target_user_id;
  elsif scope = 'routines' then
    select coalesce(routines_visibility, 'authenticated')
      into visibility
    from public.profile_privacy_settings
    where user_id = target_user_id;
  elsif scope = 'recent_history' then
    select coalesce(recent_history_visibility, 'private')
      into visibility
    from public.profile_privacy_settings
    where user_id = target_user_id;
  elsif scope = 'pr_highlights' then
    select coalesce(pr_visibility, 'private')
      into visibility
    from public.profile_privacy_settings
    where user_id = target_user_id;
  elsif scope = 'stats' then
    select coalesce(stats_visibility, 'authenticated')
      into visibility
    from public.profile_privacy_settings
    where user_id = target_user_id;
  else
    visibility := 'private';
  end if;

  visibility := coalesce(visibility,
    case scope
      when 'profile' then 'authenticated'
      when 'routines' then 'authenticated'
      when 'stats' then 'authenticated'
      else 'private'
    end
  );

  if visibility = 'authenticated' then
    return true;
  end if;

  if visibility = 'friends' then
    return public.social_is_friend(target_user_id);
  end if;

  return false;
end;
$$;

create or replace function public.social_can_view_post(target_post_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.social_workout_posts post
    where post.id = target_post_id
      and post.deleted_at is null
      and (
        post.owner_user_id = auth.uid()
        or (post.visibility = 'authenticated' and auth.role() = 'authenticated')
        or (post.visibility = 'friends' and public.social_is_friend(post.owner_user_id))
      )
  );
$$;

revoke all on function public.social_is_friend(uuid) from public;
revoke all on function public.social_can_view_scope(uuid, text) from public;
revoke all on function public.social_can_view_post(text) from public;

grant execute on function public.social_is_friend(uuid) to authenticated;
grant execute on function public.social_can_view_scope(uuid, text) to authenticated;
grant execute on function public.social_can_view_post(text) to authenticated;
grant execute on function public.social_is_friend(uuid) to service_role;
grant execute on function public.social_can_view_scope(uuid, text) to service_role;
grant execute on function public.social_can_view_post(text) to service_role;

alter table public.profiles enable row level security;
alter table public.profile_privacy_settings enable row level security;
alter table public.user_follows enable row level security;
alter table public.user_friendships enable row level security;
alter table public.social_routines enable row level security;
alter table public.social_workout_posts enable row level security;
alter table public.social_post_likes enable row level security;
alter table public.social_post_comments enable row level security;
alter table public.social_pr_highlights enable row level security;

create policy "profiles_select_visible"
on public.profiles
for select
using (deleted_at is null and public.social_can_view_scope(user_id, 'profile'));

create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = user_id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "profiles_delete_own"
on public.profiles
for delete
using (auth.uid() = user_id);

create policy "profile_privacy_settings_select_own"
on public.profile_privacy_settings
for select
using (auth.uid() = user_id);

create policy "profile_privacy_settings_insert_own"
on public.profile_privacy_settings
for insert
with check (auth.uid() = user_id);

create policy "profile_privacy_settings_update_own"
on public.profile_privacy_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "profile_privacy_settings_delete_own"
on public.profile_privacy_settings
for delete
using (auth.uid() = user_id);

create policy "user_follows_select_involved"
on public.user_follows
for select
using (auth.uid() = follower_user_id or auth.uid() = target_user_id);

create policy "user_follows_insert_own"
on public.user_follows
for insert
with check (
  auth.uid() = follower_user_id
  and follower_user_id <> target_user_id
  and exists (
    select 1
    from public.profile_privacy_settings privacy
    where privacy.user_id = target_user_id
      and privacy.allow_follow = true
  )
);

create policy "user_follows_update_own"
on public.user_follows
for update
using (auth.uid() = follower_user_id)
with check (auth.uid() = follower_user_id);

create policy "user_follows_delete_own"
on public.user_follows
for delete
using (auth.uid() = follower_user_id);

create policy "user_friendships_select_involved"
on public.user_friendships
for select
using (auth.uid() = requester_user_id or auth.uid() = addressee_user_id);

create policy "user_friendships_insert_requester"
on public.user_friendships
for insert
with check (
  auth.uid() = requester_user_id
  and requester_user_id <> addressee_user_id
  and exists (
    select 1
    from public.profile_privacy_settings privacy
    where privacy.user_id = addressee_user_id
      and privacy.allow_friend_requests = true
  )
);

create policy "user_friendships_update_involved"
on public.user_friendships
for update
using (auth.uid() = requester_user_id or auth.uid() = addressee_user_id)
with check (auth.uid() = requester_user_id or auth.uid() = addressee_user_id);

create policy "user_friendships_delete_requester"
on public.user_friendships
for delete
using (auth.uid() = requester_user_id);

create policy "social_routines_select_visible"
on public.social_routines
for select
using (deleted_at is null and public.social_can_view_scope(owner_user_id, 'routines'));

create policy "social_routines_insert_own"
on public.social_routines
for insert
with check (auth.uid() = owner_user_id);

create policy "social_routines_update_own"
on public.social_routines
for update
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

create policy "social_routines_delete_own"
on public.social_routines
for delete
using (auth.uid() = owner_user_id);

create policy "social_workout_posts_select_visible"
on public.social_workout_posts
for select
using (public.social_can_view_post(id));

create policy "social_workout_posts_insert_own"
on public.social_workout_posts
for insert
with check (auth.uid() = owner_user_id);

create policy "social_workout_posts_update_own"
on public.social_workout_posts
for update
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

create policy "social_workout_posts_delete_own"
on public.social_workout_posts
for delete
using (auth.uid() = owner_user_id);

create policy "social_post_likes_select_visible"
on public.social_post_likes
for select
using (deleted_at is null and public.social_can_view_post(post_id));

create policy "social_post_likes_insert_own"
on public.social_post_likes
for insert
with check (auth.uid() = user_id and public.social_can_view_post(post_id));

create policy "social_post_likes_update_own"
on public.social_post_likes
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "social_post_likes_delete_own"
on public.social_post_likes
for delete
using (auth.uid() = user_id);

create policy "social_post_comments_select_visible"
on public.social_post_comments
for select
using (deleted_at is null and public.social_can_view_post(post_id));

create policy "social_post_comments_insert_own"
on public.social_post_comments
for insert
with check (auth.uid() = user_id and public.social_can_view_post(post_id));

create policy "social_post_comments_update_own"
on public.social_post_comments
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "social_post_comments_delete_own"
on public.social_post_comments
for delete
using (auth.uid() = user_id);

create policy "social_pr_highlights_select_visible"
on public.social_pr_highlights
for select
using (deleted_at is null and public.social_can_view_scope(owner_user_id, 'pr_highlights'));

create policy "social_pr_highlights_insert_own"
on public.social_pr_highlights
for insert
with check (auth.uid() = owner_user_id);

create policy "social_pr_highlights_update_own"
on public.social_pr_highlights
for update
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

create policy "social_pr_highlights_delete_own"
on public.social_pr_highlights
for delete
using (auth.uid() = owner_user_id);

insert into storage.buckets (id, name, public)
values ('social-avatars', 'social-avatars', false)
on conflict (id) do nothing;

create policy "social_avatars_select_visible"
on storage.objects
for select
using (
  bucket_id = 'social-avatars'
  and array_length(storage.foldername(name), 1) > 0
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.social_can_view_scope(((storage.foldername(name))[1])::uuid, 'profile')
);

create policy "social_avatars_insert_own"
on storage.objects
for insert
with check (
  bucket_id = 'social-avatars'
  and array_length(storage.foldername(name), 1) > 0
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "social_avatars_update_own"
on storage.objects
for update
using (
  bucket_id = 'social-avatars'
  and array_length(storage.foldername(name), 1) > 0
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'social-avatars'
  and array_length(storage.foldername(name), 1) > 0
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "social_avatars_delete_own"
on storage.objects
for delete
using (
  bucket_id = 'social-avatars'
  and array_length(storage.foldername(name), 1) > 0
  and auth.uid()::text = (storage.foldername(name))[1]
);
