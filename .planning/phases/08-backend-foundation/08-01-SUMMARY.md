---
phase: 08-backend-foundation
plan: 01
subsystem: backend
tags: [fastify, wrkout, bff, vite-proxy]

requires:
  - phase: 03-ejercicios-directorio
    provides: tips wrkout integrados en frontend
provides:
  - Backend local con endpoints `/health` y `/api/wrkout/*`
  - Frontend consumiendo backend por defecto para tips
  - Scripts de desarrollo app+api y configuracion de entorno
affects: [integraciones, settings, ejercicio-detalle]

tech-stack:
  added: [fastify, @fastify/cors, tsx, concurrently]
  patterns: [bff proxy, env-based configuration]

key-files:
  created: [backend/src/server.ts, backend/README.md, .env.example]
  modified: [src/data/wrkout.ts, src/pages/ExerciseDetail.tsx, vite.config.ts, package.json]

duration: 90min
completed: 2026-02-18
---

# Phase 8 Summary (Wave 1)

## Delivered

- Se agrego backend BFF para wrkout en `backend/src/server.ts`.
- Frontend ahora usa `/api/wrkout/*` por defecto, evitando dependencia de CORS del proveedor.
- Se agregaron scripts:
  - `npm run dev:api`
  - `npm run dev:all`
- Vite proxy de `/api` a backend local para desarrollo.
- UI de detalle de ejercicio muestra estado claro cuando backend no tiene `WRKOUT_API_KEY`.
- Se agrego scaffold cloud con Supabase Edge Function:
  - `supabase/functions/wrkout-proxy/index.ts`
  - `supabase/config.toml`
  - `supabase/README.md`

## Verification

- `npm run build` (OK)
- `npm run dev:api` (OK)
- `curl /health` (OK)
- `curl /api/wrkout/exercise/query?...` sin key -> `503 missing_wrkout_api_key` (OK)

## Remaining

- Configurar `WRKOUT_API_KEY` real para validar tips end-to-end.
- Definir despliegue backend para produccion.
- Diseñar siguiente subfase: auth + sync cloud.
