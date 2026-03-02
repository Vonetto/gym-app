# Phase 9 Research: Auth + Sync Base (Ecosystem)

## Standard Stack

**Prescriptive stack for this phase (aligned with Supabase official guidance + current repo):**

- **`@supabase/supabase-js` in the frontend** for email/password auth and cloud CRUD. Supabase documents `auth.signUp`, `auth.signInWithPassword`, and `auth.onAuthStateChange` as the standard browser flow. Browser clients also persist the session automatically when `localStorage` is available. Sources: Supabase JS auth docs. https://supabase.com/docs/reference/javascript/auth-signup https://supabase.com/docs/reference/javascript/auth-signinwithpassword https://supabase.com/docs/reference/javascript/auth-onauthstatechange
- **Supabase Postgres + Row Level Security (RLS)** for all user-owned cloud data. Supabase documents `auth.uid()`-based policies as the standard authorization mechanism and explicitly notes that `UPDATE` also requires a matching `SELECT` policy. Source: Supabase RLS guide. https://supabase.com/docs/guides/database/postgres/row-level-security
- **Dexie / IndexedDB stays as the local-first source of truth** for UI reads/writes and offline operation. That is already the app architecture today (`src/data/db.ts`), so Phase 9 should layer sync on top instead of replacing it. Source: local repo `src/data/db.ts`.
- **SQL migrations under `supabase/migrations/`** and applied with the Supabase CLI (`migration new`, `db push`). Sources: Supabase CLI docs. https://supabase.com/docs/reference/cli/supabase-migration-new https://supabase.com/docs/reference/cli/db-push
- **`upsert` for writes and paginated reads via `range()`** for sync transport. Supabase documents both patterns and notes a default row cap of 1,000 rows per request unless you paginate. Sources: Supabase JS docs. https://supabase.com/docs/reference/javascript/upsert https://supabase.com/docs/reference/javascript/range

## Architecture Patterns

### 1) Use Supabase Auth directly from the browser; do not add a custom auth backend

- This phase only needs email/password signup and login.
- Use a thin `AuthProvider` that boots the current session on app load and subscribes to `onAuthStateChange`.
- Important documented behavior: if email confirmation is enabled in Supabase, `signUp()` can return a `user` but a `null` session until the email is confirmed. This must be handled explicitly in UI. Source: Supabase auth signup docs. https://supabase.com/docs/reference/javascript/auth-signup

### 2) Keep the app local-first; Supabase is the remote replica, not the primary UI store

- Current app data is normalized in Dexie across `routines`, `routineExercises`, `routineTags`, `exerciseDefaults`, `workouts`, `workoutExercises`, and `workoutSets`. Source: local repo `src/data/db.ts`.
- Replacing local reads with direct cloud reads would regress offline behavior and increase UI latency.
- Recommended pattern for this project: **all screens continue reading/writing local Dexie first**, then a sync layer pushes/pulls changes in the background.
- This is an implementation inference from the current repo and the phase requirement to preserve offline-first behavior.

### 3) Sync cloud aggregates, not every local Dexie table 1:1

**Recommended cloud tables for V1 sync:**

- `user_custom_exercises`
- `user_favorites`
- `user_routines`
- `user_workouts`

**Why this shape is preferable here:**

- The local model is optimized for UI queries and edit flows.
- Phase 9 already decided that conflicts are resolved at the **whole-record** level, not field-by-field.
- The repo already has aggregate export shapes for routines in `src/data/routineBackup.ts`.

**Recommendation:**

- Keep the local Dexie schema normalized.
- Store **aggregate documents** in Supabase:
  - `user_routines.exercises` as `jsonb`
  - `user_routines.tags` as `jsonb`
  - `user_workouts.exercises` as `jsonb`
- This avoids multi-table cloud merges for one logical routine/workout and fits the chosen conflict model.

This recommendation is an inference from the current local schema (`src/data/db.ts`) and the current export/import design (`src/data/routineBackup.ts`), not a Supabase rule.

### 4) Use shared record IDs across local and cloud

- Do **not** invent separate cloud-only numeric IDs for synced entities.
- Use the existing client-generated string IDs (`routine-...`, `custom-...`, `workout-...`) in Supabase as well.
- Recommended table keys:
  - `(user_id, id)` for routines/custom exercises/workouts
  - `(user_id, exercise_id)` for favorites
- This removes the need for ID mapping tables and keeps merge logic deterministic.

### 5) Add explicit sync metadata locally

The current local schema is missing enough metadata to support reliable sync on every entity.

**Needed local additions:**

- `updatedAt` on custom exercises and favorites
- `deletedAt` tombstones for synced entities (do not hard-delete synced records immediately)
- a `syncState` table for:
  - auth/onboarding flags
  - last pull cursor per entity
  - last sync attempt / last sync error
  - current sync status

Routines already have `updatedAt`. Workouts can use `endedAt` as their initial effective update time, but adding explicit `updatedAt` is cleaner.

### 6) Use last-write-wins with timestamps + tombstones

The user already chose:

- last-write-wins by timestamp
- conflict at full-record level
- delete wins if newer

The cleanest implementation is:

- every synced record has `updated_at`
- deletions become `deleted_at` tombstones
- merge compares the newest relevant timestamp
- records with newer `deleted_at` remove the local active copy

Without tombstones, deletes cannot propagate correctly across devices.

### 7) Sync in dependency order

Recommended push/pull order:

1. `user_custom_exercises`
2. `user_favorites`
3. `user_routines`
4. `user_workouts`

Why:

- routines and workouts may reference custom exercise IDs
- favorites can reference either default wger IDs or synced custom exercise IDs

This ordering avoids dangling references during merge/apply.

### 8) Treat the current device as a single local data realm in V1

The current IndexedDB schema is not partitioned per user. That means Phase 9 should **not** pretend to support arbitrary multi-account local isolation yet.

Pragmatic V1 behavior:

- guest mode uses the same local realm
- first login/signup offers upload/merge/replace as already decided
- logging into a different cloud account on the same device must prompt explicitly before re-binding the local realm

Do not silently mix two users’ local datasets.

## Don't Hand-Roll

1. **Do not hand-roll password auth or session persistence.**
   - Use Supabase Auth with `signUp`, `signInWithPassword`, and the documented auth listener/session flow. Sources: Supabase JS auth docs. https://supabase.com/docs/reference/javascript/auth-signup https://supabase.com/docs/reference/javascript/auth-signinwithpassword https://supabase.com/docs/reference/javascript/auth-onauthstatechange

2. **Do not enforce authorization only in frontend code.**
   - Use RLS policies with `auth.uid()`; Supabase documents that policies are the data-access boundary. Source: Supabase RLS guide. https://supabase.com/docs/guides/database/postgres/row-level-security

3. **Do not mirror every local join table into cloud in this phase.**
   - For this project, that would create artificial complexity because the chosen conflict unit is a full routine/workout, not a row inside a join graph. This is a project-specific architecture recommendation from the current repo.

4. **Do not attempt field-level merge or CRDT-style sync in Phase 9.**
   - It is outside the user-approved scope and unnecessary for the current requirements.

5. **Do not sync the wger base catalog or local settings in this phase.**
   - The user explicitly scoped them out; syncing them now only increases migration and conflict surface area.

## Common Pitfalls

1. **Signup can succeed without creating an active session.**
   - If email confirmation is enabled, Supabase can return a user and a null session. UI must show the correct “check your email” or “pending confirmation” state instead of assuming the user is logged in. Source: Supabase auth signup docs. https://supabase.com/docs/reference/javascript/auth-signup

2. **`SIGNED_IN` can fire more than once.**
   - Supabase documents that the event can fire on tab refocus or across tabs, not just after a manual login. Do not run a heavy full sync blindly on every event; debounce or gate it. Source: Supabase auth listener docs. https://supabase.com/docs/reference/javascript/auth-onauthstatechange

3. **Missing `SELECT` policy breaks `UPDATE` and `DELETE`.**
   - Supabase explicitly notes that to update rows, the rows must also be visible via `SELECT`. Source: Supabase RLS guide. https://supabase.com/docs/guides/database/postgres/row-level-security

4. **Forgetting pagination will truncate sync.**
   - Supabase documents a default maximum of 1,000 rows per query. Pull loops must use `range()` or equivalent pagination. Source: Supabase JS range docs. https://supabase.com/docs/reference/javascript/range

5. **Upsert keys must match the real uniqueness model.**
   - If cloud uniqueness is `(user_id, id)` or `(user_id, exercise_id)`, `upsert` must target that conflict key consistently. Source: Supabase JS upsert docs. https://supabase.com/docs/reference/javascript/upsert

6. **Custom exercise duplication across devices remains possible in V1.**
   - If the same logical custom exercise is created offline on two devices before the first sync, the IDs will differ and both will survive. This is a known limitation of ID-based record sync.

7. **Local reset and cloud sync are different actions.**
   - “Resetear datos” today is local-only. After auth exists, the app must avoid accidentally interpreting a local reset as a cloud delete unless the user explicitly requests it.

8. **Account switching on one device is a real data-leak risk if ignored.**
   - Because the current Dexie DB is not partitioned by user, logout/login flows must not silently expose the previous local dataset to a different account.

## Code Examples

```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
```

Source APIs: Supabase JS auth docs. https://supabase.com/docs/reference/javascript/auth-signup https://supabase.com/docs/reference/javascript/auth-signinwithpassword

```ts
// Sketch only: auth/session bootstrap for a local-first app.
// Debounce sync work; SIGNED_IN may fire on tab refocus or across tabs.
supabase.auth.onAuthStateChange((event, session) => {
  if (!session?.user) return;
  queueSync({ reason: event, userId: session.user.id });
});
```

Source API: Supabase auth listener docs. https://supabase.com/docs/reference/javascript/auth-onauthstatechange

```sql
create table public.user_routines (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  order_index integer not null default 0,
  tags jsonb not null default '[]'::jsonb,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (user_id, id)
);

alter table public.user_routines enable row level security;

create policy "user_routines_select_own"
on public.user_routines
for select
using (auth.uid() = user_id);

create policy "user_routines_insert_own"
on public.user_routines
for insert
with check (auth.uid() = user_id);

create policy "user_routines_update_own"
on public.user_routines
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

RLS pattern source: Supabase RLS guide. https://supabase.com/docs/guides/database/postgres/row-level-security

```ts
// Sketch only: pull in pages and apply LWW/tombstones inside a Dexie transaction.
let from = 0;
const pageSize = 500;

while (true) {
  const { data, error } = await supabase
    .from('user_routines')
    .select('*')
    .gt('updated_at', lastRoutineCursor)
    .order('updated_at', { ascending: true })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  if (!data?.length) break;

  await db.transaction('rw', db.routines, db.routineExercises, db.routineTags, async () => {
    for (const row of data) {
      applyRoutineAggregate(row);
    }
  });

  from += pageSize;
}
```

Source APIs: Supabase JS `range()` docs. https://supabase.com/docs/reference/javascript/range

## Confidence Levels

- **High:** Supabase Auth browser flow (`signUp`, `signInWithPassword`, `onAuthStateChange`) and session persistence behavior. Sources: Supabase JS auth docs. https://supabase.com/docs/reference/javascript/auth-signup https://supabase.com/docs/reference/javascript/auth-signinwithpassword https://supabase.com/docs/reference/javascript/auth-onauthstatechange
- **High:** RLS with `auth.uid()` and the need for matching `SELECT` visibility on updates. Source: Supabase RLS guide. https://supabase.com/docs/guides/database/postgres/row-level-security
- **High:** `upsert`, pagination with `range()`, and default row cap. Sources: Supabase JS docs. https://supabase.com/docs/reference/javascript/upsert https://supabase.com/docs/reference/javascript/range
- **High:** SQL migration workflow with `supabase migration new` and `supabase db push`. Sources: Supabase CLI docs. https://supabase.com/docs/reference/cli/supabase-migration-new https://supabase.com/docs/reference/cli/db-push
- **Medium-High:** Cloud aggregate-table recommendation (`user_routines`, `user_workouts`, etc.) over 1:1 join-table mirroring. This is an inference from the current local schema and the already-approved full-record conflict strategy, not an official Supabase prescription. Sources: local repo `src/data/db.ts`, `src/data/routineBackup.ts`.
