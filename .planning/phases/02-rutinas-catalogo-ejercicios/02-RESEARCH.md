# Phase 2 Research: Rutinas + Catálogo de Ejercicios (Ecosystem)

## Standard Stack

**Prescriptive stack for this phase (aligns with repo + ecosystem best practice):**

- **IndexedDB as the primary data store** for routines, exercises, tags, and historical snapshots. IndexedDB is designed for large, structured client-side data and uses indexes for high‑performance searches. Source: MDN IndexedDB overview. https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/indexeddb_api/index.md
- **Dexie.js as the IndexedDB wrapper** for schema definition, indexes, and fluent queries. Dexie is a wrapper around IndexedDB, provides a simpler API, and is built to work around IndexedDB implementation bugs. Source: Dexie README. https://raw.githubusercontent.com/dexie/Dexie.js/master/README.md
- **React 18 + React Router + Vite** as already used in the repo; keep all UI/data flows in React components and route state (no new framework). Source: repo `package.json`. (Local)
- **PWA storage management considerations** (quotas + eviction). Data stored in IndexedDB is subject to browser quota and eviction rules; plan for persistence or export. Source: MDN Storage quotas & eviction. https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/storage_api/storage_quotas_and_eviction_criteria/index.md

## Architecture Patterns

**Use a local‑first, offline‑first data layer with IndexedDB/Dexie.**

**SOTA vs. outdated assumptions:** Modern PWA data layers use IndexedDB (not localStorage) plus a mature wrapper like Dexie, and explicitly account for storage eviction and persistence. Sources: MDN IndexedDB overview + MDN Storage quotas & eviction + Dexie README. https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/indexeddb_api/index.md https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/storage_api/storage_quotas_and_eviction_criteria/index.md https://raw.githubusercontent.com/dexie/Dexie.js/master/README.md

1. **Normalized schema with explicit indexes for search and filters.**
   - Model **Exercises** as a single source of truth and reference them by ID in **Routines** and **RoutineExercises** (junction table) for reordering and per‑exercise defaults.
   - Use IndexedDB indexes to power high‑performance searches and filters (muscle, equipment, alphabetical). IndexedDB explicitly uses indexes for high‑performance searches. Source: MDN IndexedDB overview. https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/indexeddb_api/index.md
   - Dexie’s schema definition supports index declarations via `db.version(...).stores({ ... })` and query chaining (`where(...)`, `orderBy(...)`, etc.). Source: Dexie README. https://raw.githubusercontent.com/dexie/Dexie.js/master/README.md

2. **Versioned schema with migration story.**
   - Use Dexie’s versioned schema (`db.version(1).stores(...)`) and bump versions as you add fields like tags, metrics, or routine change history. Source: Dexie README. https://raw.githubusercontent.com/dexie/Dexie.js/master/README.md

3. **Transactional writes for multi‑record updates.**
   - Routine edits touch multiple tables (routine, routine_exercises, order indexes, and latest defaults). Use IndexedDB’s transaction model to keep these multi‑step updates consistent (transactions are a core IndexedDB concept). Source: MDN IndexedDB overview. https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/indexeddb_api/index.md

4. **Explicit separation between catalog data and historical data.**
   - Exercises and routines are editable for *future sessions only*; historical sessions should snapshot the routine structure + exercise values at time of completion.
   - Store `routine_versions` or `routine_snapshots` as immutable records so editing a routine never mutates past sessions (matches requirement).

5. **Defaults and “last used values” flow.**
   - Store per‑exercise “last values” in a dedicated table keyed by (exerciseId, metricType) to prefill defaults on the next routine/session.
   - The initial routine values should be empty; the default should be pulled from this table after the first completed session (requirement‑aligned).

6. **Search experience is index‑driven, not full scans.**
   - Use IndexedDB indexes for muscle/equipment filters and alphabetical sorting; avoid filtering large collections in memory.

## Don't Hand-Roll

1. **Do not build your own persistence layer on top of localStorage.**
   - Web Storage (localStorage/sessionStorage) is capped at 10 MiB and string‑only; IndexedDB is designed for large structured data and is a better fit. Source: MDN Storage quotas & eviction (Web Storage limits + IndexedDB positioning). https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/storage_api/storage_quotas_and_eviction_criteria/index.md

2. **Do not implement your own IndexedDB wrapper.**
   - Dexie is a purpose‑built wrapper around IndexedDB and explicitly works around browser implementation bugs to provide a more stable experience. Source: Dexie README. https://raw.githubusercontent.com/dexie/Dexie.js/master/README.md

3. **Do not ignore storage eviction/quotas.**
   - Browser storage is best‑effort by default and subject to eviction; plan for persistence requests and user export/backup flows. Source: MDN Storage quotas & eviction. https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/storage_api/storage_quotas_and_eviction_criteria/index.md

## Common Pitfalls

1. **Missing indexes for filters/search.**
   - IndexedDB uses indexes to provide high‑performance searches; without them, queries devolve into expensive scans. Source: MDN IndexedDB overview. https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/indexeddb_api/index.md

2. **Assuming data is permanent.**
   - IndexedDB is stored in a best‑effort bucket by default and can be evicted under storage pressure or browser policies. Source: MDN Storage quotas & eviction. https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/storage_api/storage_quotas_and_eviction_criteria/index.md

3. **Forgetting same‑origin restrictions.**
   - IndexedDB follows the same‑origin policy; data is not shared across domains/subdomains. Source: MDN IndexedDB overview. https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/indexeddb_api/index.md

4. **Blocking the UI with synchronous assumptions.**
   - IndexedDB operations are asynchronous; UI flows must be designed with async reads/writes and optimistic rendering. Source: MDN IndexedDB overview. https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/indexeddb_api/index.md

## Code Examples

> The examples below use Dexie’s schema and query patterns (from the official README) and are tailored to the routine + exercise catalog domain.

```ts
import { Dexie } from 'dexie';

export const db = new Dexie('GymApp');

db.version(1).stores({
  exercises: '++id, name, primaryMuscle, equipment, metricType',
  routines: '++id, name, estimatedDurationMinutes',
  routineExercises: '++id, routineId, exerciseId, orderIndex',
  exerciseDefaults: '++id, exerciseId, metricType, lastSets, lastReps, lastWeight, lastRestSeconds'
});

// Example query using an indexed field (Dexie README pattern)
const legs = await db.table('exercises')
  .where('primaryMuscle')
  .equals('quads')
  .toArray();
```

Source for schema + query pattern: Dexie README. https://raw.githubusercontent.com/dexie/Dexie.js/master/README.md

```ts
// Pseudocode: routine update in a single transaction (IndexedDB is transactional)
// - Update routine metadata
// - Replace routine exercise order
// - Write last-used defaults
```

Source for transaction model: MDN IndexedDB overview. https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/indexeddb_api/index.md

## Confidence Levels

- **High:** IndexedDB’s role for large structured data, indexes for search performance, transactional model, and same‑origin scope (MDN IndexedDB overview). https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/indexeddb_api/index.md
- **High:** Storage quotas/eviction behavior and localStorage size limitations (MDN Storage quotas & eviction). https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/storage_api/storage_quotas_and_eviction_criteria/index.md
- **High:** Dexie as the recommended IndexedDB wrapper and schema/query patterns (Dexie README). https://raw.githubusercontent.com/dexie/Dexie.js/master/README.md
