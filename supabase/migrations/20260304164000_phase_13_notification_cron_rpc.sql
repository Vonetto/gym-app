create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.configure_planned_reminders_cron(
  function_url text,
  bearer_token text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_job_id bigint;
  scheduled_job_id bigint;
  command_text text;
begin
  if coalesce(trim(function_url), '') = '' then
    raise exception 'function_url_required';
  end if;

  if coalesce(trim(bearer_token), '') = '' then
    raise exception 'bearer_token_required';
  end if;

  select jobid
    into existing_job_id
  from cron.job
  where jobname = 'planned-reminders-every-minute'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  command_text := format(
    $command$
    select
      net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := '{"source":"cron"}'::jsonb
      ) as request_id;
    $command$,
    function_url,
    bearer_token
  );

  select cron.schedule(
    'planned-reminders-every-minute',
    '* * * * *',
    command_text
  )
    into scheduled_job_id;

  return scheduled_job_id;
end;
$$;

create or replace function public.disable_planned_reminders_cron()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
  from cron.job
  where jobname = 'planned-reminders-every-minute'
  limit 1;

  if existing_job_id is null then
    return false;
  end if;

  perform cron.unschedule(existing_job_id);
  return true;
end;
$$;

revoke all on function public.configure_planned_reminders_cron(text, text) from public;
revoke all on function public.disable_planned_reminders_cron() from public;

grant execute on function public.configure_planned_reminders_cron(text, text) to service_role;
grant execute on function public.disable_planned_reminders_cron() to service_role;
