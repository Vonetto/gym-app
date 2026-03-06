---
wave: 1
depends_on:
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - .planning/phases/16-normalizacion-catalogo-ejercicios/16-CONTEXT.md
  - .planning/phases/16-normalizacion-catalogo-ejercicios/16-RESEARCH.md
  - .planning/phases/15-consolidacion-v1/15-SUMMARY.md
files_modified:
  - .planning/phases/16-normalizacion-catalogo-ejercicios/16-PLAN.md
autonomous: true
---

<tasks>
  <task id="canonical-map-artifacts" title="Build canonicalization artifacts from current seed" owner="agent">
    <description>
      Create deterministic artifacts to drive normalization: canonical ES name per exercise family, legacy-to-canonical id map, and alias index for search/matching. Keep manual overrides file for ambiguous groups.
    </description>
    <acceptance_criteria>
      <item>There is a versioned artifact for `legacyId -> canonicalId` mappings.</item>
      <item>There is a versioned alias index containing multilingual aliases per canonical exercise.</item>
      <item>Ambiguous groups are handled through explicit overrides (not ad-hoc runtime logic).</item>
      <item>Artifact generation is reproducible from repository inputs.</item>
    </acceptance_criteria>
  </task>

  <task id="canonical-resolver-layer" title="Introduce canonical exercise resolver as single source of truth" owner="agent">
    <description>
      Add a shared resolver (`resolveCanonicalExerciseId`) and family/variant helpers. Centralize all canonical-id decisions so data modules and UI never duplicate normalization logic.
    </description>
    <acceptance_criteria>
      <item>A dedicated resolver module exists and is reused by data boundaries.</item>
      <item>Family key and variant key rules match Phase 16 decisions (name normalized + metric/equipment variant split).</item>
      <item>No component-level ad-hoc dedupe logic is introduced.</item>
      <item>Custom exercises stay out of automatic canonical merge paths.</item>
    </acceptance_criteria>
  </task>

  <task id="catalog-search-normalization" title="Normalize catalog listing and search on canonical names + aliases" owner="agent">
    <description>
      Refactor catalog lookup so visible names are canonical ES while search matches aliases/translations. Eliminate obvious duplicate cards from the exercise directory without hiding legitimate equipment/metric variants.
    </description>
    <acceptance_criteria>
      <item>Exercise cards show canonical ES display names by default.</item>
      <item>Search can match aliases from non-canonical names/translations.</item>
      <item>Obvious duplicates are removed from listing for merged groups.</item>
      <item>Real variants (equipment/metric) remain independently selectable.</item>
    </acceptance_criteria>
  </task>

  <task id="dexie-remap-migration" title="Ship one-shot idempotent Dexie remap migration across references" owner="agent">
    <description>
      Implement a transactional local migration that remaps existing references to canonical exercise ids across routines, defaults, workouts, favorites, recents, and tips. Mark migration completion to guarantee idempotency.
    </description>
    <acceptance_criteria>
      <item>Migration runs in a single Dexie transaction and fails atomically.</item>
      <item>All `exerciseId` references in local domain tables are remapped to canonical ids.</item>
      <item>Post-remap duplicate records created by convergence are deduplicated deterministically.</item>
      <item>Migration stores a completion marker and does not reapply on next app launch.</item>
    </acceptance_criteria>
  </task>

  <task id="sync-boundary-remap" title="Enforce canonical remap in cloud sync serialization and ingestion" owner="agent">
    <description>
      Update sync boundaries so outgoing and incoming rows are normalized to canonical ids before local persistence. Prevent reintroduction of legacy ids from cloud snapshots.
    </description>
    <acceptance_criteria>
      <item>`serialize*` sync flows emit canonical exercise ids.</item>
      <item>`applyRemote*` sync flows remap remote exercise ids before writing local rows.</item>
      <item>Routine/workout/favorite sync remains LWW-compatible after remap.</item>
      <item>No infinite conflict loops are introduced by canonicalization.</item>
    </acceptance_criteria>
  </task>

  <task id="backup-boundary-remap" title="Enforce canonical remap in full and routine backup import/export" owner="agent">
    <description>
      Normalize exercise ids at backup boundaries so imported legacy payloads are upgraded to canonical references while preserving data integrity and current merge/replace semantics.
    </description>
    <acceptance_criteria>
      <item>Full backup import remaps legacy exercise ids before reference validation/write.</item>
      <item>Routine backup import remaps legacy exercise ids consistently with full backup rules.</item>
      <item>Export payloads only emit canonical ids for base exercises.</item>
      <item>Corrupt/incomplete payload behavior remains unchanged (fail-fast, no partial writes).</item>
    </acceptance_criteria>
  </task>

  <task id="regression-tests-phase16" title="Add regression tests for canonical remap and dedupe behavior" owner="agent">
    <description>
      Extend automated coverage with risk-based tests for migration idempotency, boundary remap (sync/backup), and duplicate handling in favorites/recents/routine references.
    </description>
    <acceptance_criteria>
      <item>There are tests for one-shot migration and second-run idempotency.</item>
      <item>There are tests ensuring sync and backup paths normalize legacy ids.</item>
      <item>There are tests for duplicate convergence outcomes (favorites/recents/routine refs).</item>
      <item>`npm run test` and `npm run build` pass after Phase 16 implementation.</item>
    </acceptance_criteria>
  </task>

  <task id="phase16-verification-and-close" title="Run manual QA and capture closure evidence for catalog normalization" owner="agent">
    <description>
      Validate end-to-end UX and data integrity after normalization (catalog, routine creation/edit, workout start/save, exercise detail, sync/backup roundtrip) and document results before closure.
    </description>
    <acceptance_criteria>
      <item>Manual QA confirms duplicate cleanup and variant preservation in Exercise Catalog.</item>
      <item>Routine and workout flows remain stable with canonical ids after migration.</item>
      <item>Sync and backup roundtrips do not reintroduce legacy duplicated ids.</item>
      <item>`16-SUMMARY.md` captures outcomes, risks and deferred cleanup items.</item>
    </acceptance_criteria>
  </task>
</tasks>

<verification>
  <criteria>
    <item>El catálogo muestra nombres canónicos en español, sin duplicados obvios del seed base.</item>
    <item>La búsqueda encuentra ejercicios por aliases y traducciones sin perder variantes reales.</item>
    <item>Las referencias históricas se remapean automáticamente a IDs canónicos sin pérdida silenciosa.</item>
    <item>Sync e import/export respetan canonicalización y no reintroducen IDs legacy.</item>
    <item>Ejercicios personalizados se mantienen fuera de la auto-fusión del catálogo base.</item>
  </criteria>
</verification>

<must_haves>
  <item>Resolver único `legacy -> canonical` reutilizado en todas las fronteras de datos.</item>
  <item>Migración local transaccional, idempotente y con marca de ejecución.</item>
  <item>Remap obligatorio en sync (`serialize` + `applyRemote`) y backup (`full` + `routine`).</item>
  <item>Deduplicación determinística con soporte de overrides para casos ambiguos.</item>
  <item>Cero impacto sobre la política de ejercicios personalizados (sin auto-merge).</item>
</must_haves>
