alter table public.social_workout_posts
add column if not exists hidden_at timestamptz;

create index if not exists social_workout_posts_hidden_idx
  on public.social_workout_posts (owner_user_id, hidden_at, published_at desc)
  where deleted_at is null;

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
        or (
          post.hidden_at is null
          and (
            (post.visibility = 'authenticated' and auth.role() = 'authenticated')
            or (post.visibility = 'friends' and public.social_is_friend(post.owner_user_id))
          )
        )
      )
  );
$$;
