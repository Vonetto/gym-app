# Supabase deployment (prod)

Esta carpeta deja lista la integracion de `wrkout-proxy` como Supabase Edge Function.

## 1) Instalar CLI

```bash
brew install supabase/tap/supabase
```

## 2) Login + link del proyecto

```bash
supabase login
supabase link --project-ref <TU_PROJECT_REF>
```

## 3) Configurar secret de wrkout

```bash
supabase secrets set WRKOUT_API_KEY=<TU_WRKOUT_API_KEY>
```

## 4) Deploy function

```bash
supabase functions deploy wrkout-proxy --no-verify-jwt
```

## 5) Frontend prod

Define en tu build del frontend:

```bash
VITE_API_BASE_URL=https://<TU_PROJECT_REF>.functions.supabase.co/wrkout-proxy
```

Con eso, el frontend llamara:

- `GET {VITE_API_BASE_URL}/wrkout/query?...`
- `GET {VITE_API_BASE_URL}/wrkout/exercise/:id?...`

## 6) Probar en prod

```bash
curl "https://<TU_PROJECT_REF>.functions.supabase.co/wrkout-proxy/wrkout/query?name=bench%20press&limit=1&lang=en-GB&searchlang=en-GB"
```
