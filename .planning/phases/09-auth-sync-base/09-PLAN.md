---
wave: 1
depends_on:
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - .planning/phases/09-auth-sync-base/09-CONTEXT.md
  - .planning/phases/09-auth-sync-base/09-RESEARCH.md
files_modified:
  - .planning/phases/09-auth-sync-base/09-PLAN.md
autonomous: true
---

<tasks>
  <task id="supabase-client-auth" title="Add Supabase client and auth session layer" owner="agent">
    <description>
      Install and configure `@supabase/supabase-js`, add typed environment variables for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and create a small auth/session module plus React provider that loads the current session and exposes signup, login, logout, and auth status to the app.
    </description>
    <acceptance_criteria>
      <item>The app can initialize a Supabase client from environment variables.</item>
      <item>Frontend auth supports `signUp`, `signInWithPassword`, and `signOut`.</item>
      <item>Session state persists across reloads and is available through React context.</item>
      <item>The implementation handles the case where signup returns `user` with a null `session`.</item>
    </acceptance_criteria>
  </task>
  <task id="local-sync-metadata" title="Extend Dexie schema with sync metadata and tombstones" owner="agent">
    <description>
      Add the minimum local metadata required for reliable sync: `updatedAt` where missing, `deletedAt` tombstones for synced entities, and a `syncState` table to track onboarding decisions, sync cursors, last sync times, status, and last error. Keep the existing UI-facing tables as the local source of truth.
    </description>
    <acceptance_criteria>
      <item>Dexie schema migration preserves existing local data.</item>
      <item>Custom exercises, favorites, routines, and workouts can be marked updated/deleted without hard deletion.</item>
      <item>A `syncState` table exists for status, cursors, and migration flags.</item>
    </acceptance_criteria>
  </task>
  <task id="supabase-schema-rls" title="Create Supabase tables, constraints, and RLS policies" owner="agent">
    <description>
      Add SQL migrations in `supabase/migrations/` for user-scoped aggregate tables: `user_custom_exercises`, `user_favorites`, `user_routines`, and `user_workouts`. Use shared client-generated IDs, `updated_at`, `deleted_at`, and `auth.uid()`-based RLS policies for select/insert/update/delete.
    </description>
    <acceptance_criteria>
      <item>All synced tables are keyed by `user_id` plus the existing local record ID.</item>
      <item>Tables store aggregate JSON where appropriate (`tags`, `exercises`).</item>
      <item>RLS allows users to access only their own rows.</item>
      <item>Migrations apply cleanly via Supabase CLI.</item>
    </acceptance_criteria>
  </task>
  <task id="sync-serializers" title="Implement aggregate serializers for routines, workouts, favorites, and custom exercises" owner="agent">
    <description>
      Build deterministic serialization and deserialization helpers between the normalized Dexie schema and the Supabase aggregate row shapes. Reuse existing routine backup logic where it makes sense, but target stable cloud payloads rather than import/export files.
    </description>
    <acceptance_criteria>
      <item>Each synced domain has explicit local→cloud and cloud→local conversion functions.</item>
      <item>Routine/workout aggregates preserve tags, exercise order, defaults, notes, sets, and metrics.</item>
      <item>Default wger exercises remain references only and are not uploaded as catalog rows.</item>
    </acceptance_criteria>
  </task>
  <task id="sync-engine" title="Add incremental push/pull sync engine with last-write-wins conflict handling" owner="agent">
    <description>
      Implement a sync service that runs on login, app resume, and explicit retry. Push local changes with `upsert`, pull cloud changes with pagination, and apply last-write-wins using `updatedAt/updated_at` plus `deletedAt/deleted_at` tombstones. Debounce auth events so `SIGNED_IN` does not trigger redundant full sync passes.
    </description>
    <acceptance_criteria>
      <item>Sync processes entities in dependency order: custom exercises, favorites, routines, workouts.</item>
      <item>Deletes propagate across devices via tombstones.</item>
      <item>Conflict resolution follows whole-record LWW by timestamp.</item>
      <item>Pulls paginate rather than assuming a single query returns all rows.</item>
    </acceptance_criteria>
  </task>
  <task id="onboarding-account-ui" title="Add guest/auth onboarding, account card, and migration prompts" owner="agent">
    <description>
      Add first-open onboarding that offers `Crear cuenta`, `Iniciar sesión`, or `Continuar como invitado`, plus a `Cuenta` card in Perfil for auth actions. Implement the initial local/cloud migration prompts for `subir local`, `fusionar`, or `reemplazar`, including the case of switching to another account on the same device.
    </description>
    <acceptance_criteria>
      <item>First app open shows the three entry options without blocking guest usage.</item>
      <item>Perfil includes a `Cuenta` card with auth state and actions.</item>
      <item>If cloud is empty, first sync can upload local data.</item>
      <item>If both local and cloud have data, the app prompts before applying migration behavior.</item>
    </acceptance_criteria>
  </task>
  <task id="sync-status-ui" title="Expose sync status with discreet banner and failure recovery" owner="agent">
    <description>
      Add a small sync-status surface that reports syncing, synced, offline-pending, or error states without blocking the app. Surface manual retry only when sync fails, matching the agreed UX constraint.
    </description>
    <acceptance_criteria>
      <item>Normal successful sync is visible only as a discreet state/banner.</item>
      <item>Offline mode does not block local usage and clearly indicates pending cloud sync.</item>
      <item>Failures expose a manual retry path and readable error state.</item>
    </acceptance_criteria>
  </task>
</tasks>

<verification>
  <criteria>
    <item>El usuario puede crear cuenta, iniciar sesión y cerrar sesión desde la app.</item>
    <item>La app mantiene modo invitado y no bloquea el uso local sin cuenta.</item>
    <item>Rutinas, ejercicios personalizados, favoritos y workouts se sincronizan entre local y Supabase.</item>
    <item>La primera migración pregunta cuando existen datos locales y remotos a la vez.</item>
    <item>Conflictos y borrados siguen la regla LWW por timestamp con tombstones.</item>
    <item>La UI muestra estado de sync discreto y recuperación manual ante fallos.</item>
  </criteria>
</verification>

<must_haves>
  <item>Supabase Auth email/password integrado en frontend.</item>
  <item>Esquema cloud con RLS y migraciones reproducibles.</item>
  <item>Dexie sigue siendo la fuente local y offline-first.</item>
  <item>Sync incremental con LWW, tombstones y paginación.</item>
  <item>Onboarding inicial con cuenta o invitado, más prompts de migración.</item>
</must_haves>
