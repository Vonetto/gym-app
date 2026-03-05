# Supabase deployment (prod)

Esta carpeta deja listas dos piezas:

- `wrkout-proxy` para tips de ejercicios
- `planned-reminders` para recordatorios push de rutinas planificadas

## 1) Instalar CLI

```bash
brew install supabase/tap/supabase
```

## 2) Login + link del proyecto

```bash
supabase login
supabase link --project-ref <TU_PROJECT_REF>
```

## 3) Configurar secrets

### wrkout

```bash
supabase secrets set WRKOUT_API_KEY=<TU_WRKOUT_API_KEY>
```

### notificaciones / push

Genera un par VAPID. Una forma simple:

```bash
npx web-push generate-vapid-keys
```

Luego guarda estos secrets en Supabase:

```bash
supabase secrets set \
  PUSH_VAPID_PUBLIC_KEY=<TU_VAPID_PUBLIC_KEY> \
  PUSH_VAPID_PRIVATE_KEY=<TU_VAPID_PRIVATE_KEY> \
  PUSH_VAPID_SUBJECT=mailto:<TU_EMAIL> \
  CRON_SECRET=<UN_SECRET_LARGO_Y_ALEATORIO>
```

## 4) Deploy function

```bash
supabase functions deploy wrkout-proxy --no-verify-jwt
supabase functions deploy planned-reminders --no-verify-jwt
```

## 5) Frontend prod

Define en tu build del frontend:

```bash
VITE_API_BASE_URL=https://<TU_PROJECT_REF>.functions.supabase.co/wrkout-proxy
VITE_PUSH_PUBLIC_KEY=<TU_VAPID_PUBLIC_KEY>
```

Con eso, el frontend llamara:

- `GET {VITE_API_BASE_URL}/wrkout/query?...`
- `GET {VITE_API_BASE_URL}/wrkout/exercise/:id?...`
- y podra crear `PushSubscription` usando `VITE_PUSH_PUBLIC_KEY`

## 6) Migraciones

Antes de probar Phase 13, aplica migraciones:

```bash
supabase db push
```

## 7) Scheduler de recordatorios

La function `planned-reminders` espera un `Authorization: Bearer <CRON_SECRET>`.

Tienes un ejemplo en:

```bash
supabase/cron/planned-reminders.sql
```

Ese SQL:

- guarda la URL de la function en `vault`
- guarda el `CRON_SECRET` en `vault`
- crea un job `pg_cron` que llama la function cada minuto con `pg_net`

## 8) Probar en prod

```bash
curl "https://<TU_PROJECT_REF>.functions.supabase.co/wrkout-proxy/wrkout/query?name=bench%20press&limit=1&lang=en-GB&searchlang=en-GB"
```

Prueba manual de recordatorios:

```bash
curl -X POST \
  "https://<TU_PROJECT_REF>.functions.supabase.co/planned-reminders" \
  -H "Authorization: Bearer <TU_CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true}'
```

Notas:

- `planned-reminders` usa `PUSH_VAPID_*`, `CRON_SECRET`, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- `descanso terminado` y `¿Sigues entrenando?` siguen siendo foreground / best-effort en cliente.
- la ruta robusta de push se aplica a `rutinas planificadas`.
