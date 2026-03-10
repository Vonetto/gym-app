create or replace function public.social_target_allows_follow(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select privacy.allow_follow
      from public.profile_privacy_settings privacy
      where privacy.user_id = target_user_id
    ),
    true
  );
$$;

create or replace function public.social_target_allows_friend_requests(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select privacy.allow_friend_requests
      from public.profile_privacy_settings privacy
      where privacy.user_id = target_user_id
    ),
    true
  );
$$;

revoke all on function public.social_target_allows_follow(uuid) from public;
revoke all on function public.social_target_allows_friend_requests(uuid) from public;

grant execute on function public.social_target_allows_follow(uuid) to authenticated;
grant execute on function public.social_target_allows_follow(uuid) to service_role;
grant execute on function public.social_target_allows_friend_requests(uuid) to authenticated;
grant execute on function public.social_target_allows_friend_requests(uuid) to service_role;

drop policy if exists "user_follows_insert_own" on public.user_follows;
create policy "user_follows_insert_own"
on public.user_follows
for insert
with check (
  auth.uid() = follower_user_id
  and follower_user_id <> target_user_id
  and public.social_target_allows_follow(target_user_id)
);

drop policy if exists "user_friendships_insert_requester" on public.user_friendships;
create policy "user_friendships_insert_requester"
on public.user_friendships
for insert
with check (
  auth.uid() = requester_user_id
  and requester_user_id <> addressee_user_id
  and public.social_target_allows_friend_requests(addressee_user_id)
);
