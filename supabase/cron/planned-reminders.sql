-- Reemplaza los placeholders antes de ejecutar.
-- Requiere extensiones `pg_cron`, `pg_net` y `vault` habilitadas en el proyecto.

select vault.create_secret(
  'https://<TU_PROJECT_REF>.functions.supabase.co/planned-reminders',
  'planned_reminders_url'
);

select vault.create_secret(
  '<TU_CRON_SECRET>',
  'planned_reminders_cron_secret'
);

select
  cron.schedule(
    'planned-reminders-every-minute',
    '* * * * *',
    $$
    select
      net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'planned_reminders_url'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'planned_reminders_cron_secret')
        ),
        body := '{"source":"cron"}'::jsonb
      ) as request_id;
    $$
  );
