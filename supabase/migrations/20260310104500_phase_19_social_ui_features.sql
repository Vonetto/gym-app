alter table public.social_workout_posts
add column if not exists image_paths jsonb not null default '[]'::jsonb;

create or replace function public.social_is_post_owner(target_post_id text)
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
      and post.owner_user_id = auth.uid()
      and post.deleted_at is null
  );
$$;

revoke all on function public.social_is_post_owner(text) from public;
grant execute on function public.social_is_post_owner(text) to authenticated;
grant execute on function public.social_is_post_owner(text) to service_role;

insert into storage.buckets (id, name, public)
values ('social-post-media', 'social-post-media', false)
on conflict (id) do nothing;

drop policy if exists "social_post_media_select_visible" on storage.objects;
create policy "social_post_media_select_visible"
on storage.objects
for select
using (
  bucket_id = 'social-post-media'
  and array_length(storage.foldername(name), 1) > 0
  and public.social_can_view_post((storage.foldername(name))[1])
);

drop policy if exists "social_post_media_insert_owner" on storage.objects;
create policy "social_post_media_insert_owner"
on storage.objects
for insert
with check (
  bucket_id = 'social-post-media'
  and array_length(storage.foldername(name), 1) > 0
  and public.social_is_post_owner((storage.foldername(name))[1])
);

drop policy if exists "social_post_media_update_owner" on storage.objects;
create policy "social_post_media_update_owner"
on storage.objects
for update
using (
  bucket_id = 'social-post-media'
  and array_length(storage.foldername(name), 1) > 0
  and public.social_is_post_owner((storage.foldername(name))[1])
)
with check (
  bucket_id = 'social-post-media'
  and array_length(storage.foldername(name), 1) > 0
  and public.social_is_post_owner((storage.foldername(name))[1])
);

drop policy if exists "social_post_media_delete_owner" on storage.objects;
create policy "social_post_media_delete_owner"
on storage.objects
for delete
using (
  bucket_id = 'social-post-media'
  and array_length(storage.foldername(name), 1) > 0
  and public.social_is_post_owner((storage.foldername(name))[1])
);

drop policy if exists "user_follows_select_authenticated" on public.user_follows;
create policy "user_follows_select_authenticated"
on public.user_follows
for select
using (auth.role() = 'authenticated' and deleted_at is null);

drop policy if exists "user_friendships_select_accepted_authenticated" on public.user_friendships;
create policy "user_friendships_select_accepted_authenticated"
on public.user_friendships
for select
using (auth.role() = 'authenticated' and deleted_at is null and status = 'accepted');
