---
phase: 09-auth-sync-base
plan: 01
subsystem: auth-sync
tags: [supabase, auth, sync, dexie, rls]

requires:
  - phase: 08-backend-foundation
    provides: supabase project linked, frontend env pattern, cloud-ready base
provides:
  - Supabase Auth email/password en frontend
  - Sync local-first Dexie <-> Supabase con LWW y tombstones
  - Onboarding invitado/login/signup y card Cuenta en Perfil
  - Migraciones SQL de Supabase con RLS para datos del usuario
affects: [perfil, onboarding, auth, sync, storage-local, cloud]

tech-stack:
  added: [@supabase/supabase-js]
  patterns: [local-first sync, row-level security, aggregate cloud tables, tombstones, last-write-wins]

key-files:
  created:
    [
      src/data/AuthProvider.tsx,
      src/data/SyncProvider.tsx,
      src/data/supabase.ts,
      src/data/sync.ts,
      src/data/syncState.ts,
      src/components/AccountModal.tsx,
      src/components/SyncStatusBanner.tsx,
      supabase/migrations/20260227193000_phase_09_auth_sync_base.sql
    ]
  modified:
    [
      src/data/db.ts,
      src/data/exercises.ts,
      src/data/routines.ts,
      src/data/workouts.ts,
      src/data/routineBackup.ts,
      src/pages/Profile.tsx,
      src/App.tsx,
      src/components/Layout.tsx,
      src/main.tsx,
      src/styles.css,
      package.json,
      .env.example,
      .env.production.example
    ]

duration: multi-session
completed: 2026-03-02
---

# Phase 9 Summary (Wave 1)

## Delivered

- Se integró Supabase Auth en frontend con `email + password`, sesión persistente y soporte de signup/login/logout.
- Se agregó onboarding inicial con `Crear cuenta`, `Iniciar sesión` y `Continuar como invitado`.
- Se agregó card `Cuenta` en `Perfil` y modal global para autenticación y gestión de cuenta.
- Se agregó banner discreto de estado de sync y CTA manual `Sincronizar ahora`.
- Se extendió Dexie con metadata de sync:
  - `updatedAt`
  - `deletedAt`
  - tabla `syncState`
- Se cambió `resetAll()` para no borrar toda la `localStorage`, evitando romper sesiones futuras de Supabase.
- Se implementó sync base local-first:
  - serialización de ejercicios personalizados, favoritos, rutinas y workouts
  - push/pull cloud
  - last-write-wins por timestamp
  - tombstones para borrados
  - modos de migración inicial `push_local`, `replace_local`, `merge`
- Se agregaron migraciones SQL de Supabase para:
  - `user_custom_exercises`
  - `user_favorites`
  - `user_routines`
  - `user_workouts`
  con RLS por `auth.uid()`.

## Verification

- `supabase db push` (OK)
- `npm run build` (OK)
- Verificación manual reportada por usuario:
  - onboarding / invitado (OK)
  - signup / confirmación por email (OK)
  - login/logout (OK)
  - sync manual y feedback visual (OK)
  - UX móvil de card `Cuenta` ajustada (OK)

## Remaining

- Marcar estado `dirty` local para que `Sincronizado` vuelva automáticamente a `Sincronizar ahora` cuando haya nuevos cambios.
- Añadir resolución de conflictos más visible si aparecen edge cases reales multi-dispositivo.
- Conectar futuras notificaciones/push sobre esta base cloud.
