do $$
declare
  demo_user_id constant uuid := '9a8e3f7a-6f16-4a84-8f6a-4a39f8e2e901';
  demo_email constant text := 'demo.social@gym-app.local';
  now_utc timestamptz := timezone('utc', now());
begin
  insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    demo_user_id,
    'authenticated',
    'authenticated',
    demo_email,
    '$2a$10$7A6uF8hQ1qIMh7aLrj0Y5.B15VgTlHzw4M4M6RcP5fLQ8G8ro8s0m',
    now_utc,
    now_utc,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"demo_atleta","full_name":"Demo Atleta"}'::jsonb,
    now_utc,
    now_utc
  )
  on conflict (id) do update
  set
    email = excluded.email,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = excluded.updated_at;

  insert into public.profiles (
    user_id,
    username,
    display_name,
    bio,
    avatar_path,
    created_at,
    updated_at,
    deleted_at
  )
  values (
    demo_user_id,
    'demo_atleta',
    'Demo Atleta',
    'Perfil demo para pruebas de follow, rutinas públicas y feed social.',
    null,
    now_utc,
    now_utc,
    null
  )
  on conflict (user_id) do update
  set
    username = excluded.username,
    display_name = excluded.display_name,
    bio = excluded.bio,
    updated_at = excluded.updated_at,
    deleted_at = null;

  insert into public.profile_privacy_settings (
    user_id,
    profile_visibility,
    routines_visibility,
    recent_history_visibility,
    pr_visibility,
    stats_visibility,
    allow_follow,
    allow_friend_requests,
    updated_at
  )
  values (
    demo_user_id,
    'authenticated',
    'authenticated',
    'friends',
    'friends',
    'authenticated',
    true,
    true,
    now_utc
  )
  on conflict (user_id) do update
  set
    profile_visibility = excluded.profile_visibility,
    routines_visibility = excluded.routines_visibility,
    recent_history_visibility = excluded.recent_history_visibility,
    pr_visibility = excluded.pr_visibility,
    stats_visibility = excluded.stats_visibility,
    allow_follow = excluded.allow_follow,
    allow_friend_requests = excluded.allow_friend_requests,
    updated_at = excluded.updated_at;
end
$$;
