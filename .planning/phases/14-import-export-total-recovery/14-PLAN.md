---
wave: 1
depends_on:
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - .planning/phases/14-import-export-total-recovery/14-CONTEXT.md
  - .planning/phases/14-import-export-total-recovery/14-RESEARCH.md
  - .planning/phases/13-recordatorios-notificaciones/13-SUMMARY.md
  - .planning/phases/09-auth-sync-base/09-SUMMARY.md
files_modified:
  - .planning/phases/14-import-export-total-recovery/14-PLAN.md
autonomous: true
---

<tasks>
  <task id="full-backup-domain-schema" title="Define backup total schema and migration entrypoints" owner="agent">
    <description>
      Create a dedicated domain payload for full backup/restore, separate from routine-level import/export. Add a strict envelope (`backupType`, `schemaVersion`, `exportedAt`, `data`) and migration entrypoints so future schema evolution remains predictable.
    </description>
    <acceptance_criteria>
      <item>There is a dedicated type/module for full backup payload, independent from `RoutineBackupPayload`.</item>
      <item>`schemaVersion` is required and validated before import.</item>
      <item>A migration registry exists for safe version upgrades of backup files.</item>
      <item>Unknown future versions fail with a clear user-facing error.</item>
    </acceptance_criteria>
  </task>

  <task id="full-backup-exporter" title="Implement full data exporter from Dexie domain tables" owner="agent">
    <description>
      Add an exporter that serializes all functional local data agreed in discuss/research: settings, custom exercises/translations, favorites/recents, routines/defaults, workouts and planning entities. Keep active session, push subscription state, cache, and sync metadata out of the file.
    </description>
    <acceptance_criteria>
      <item>Export contains all V1 functional entities needed to recreate user data locally.</item>
      <item>Export explicitly excludes active session, push subscriptions, cache, and sync-state internals.</item>
      <item>The resulting JSON is portable and can be downloaded from `Ajustes &gt; Datos`.</item>
      <item>Routine-level import/export continues working unchanged.</item>
    </acceptance_criteria>
  </task>

  <task id="import-parse-validate-preview" title="Build parse + validation pipeline with preview counts" owner="agent">
    <description>
      Implement a staged import pipeline: parse JSON, validate envelope/schema version, validate structural integrity and key references, then compute a preview summary. Any failure must stop the flow before writes and show actionable error copy.
    </description>
    <acceptance_criteria>
      <item>Import runs validations in ordered stages before touching IndexedDB.</item>
      <item>Corrupt or incomplete files fail hard with explicit message and no partial writes.</item>
      <item>Preview shows counts relevant for user decision (rutinas, entrenamientos, ejercicios custom, planificación, etc.).</item>
      <item>The pipeline can distinguish full-backup payload from routine payload.</item>
    </acceptance_criteria>
  </task>

  <task id="pre-import-auto-backup" title="Create automatic safety backup before applying import" owner="agent">
    <description>
      Before any import apply, generate an automatic local safety backup and keep a short retention window. This provides rollback material if the user chooses a wrong mode or data outcome.
    </description>
    <acceptance_criteria>
      <item>Every import attempt creates a pre-import auto-backup file/snapshot.</item>
      <item>Retention policy exists (for example last 3 backups) to avoid unbounded growth.</item>
      <item>The user gets a clear confirmation that a safety backup was generated.</item>
      <item>Auto-backup mechanism does not block normal import performance on mobile-sized datasets.</item>
    </acceptance_criteria>
  </task>

  <task id="merge-mode-lww-conflicts" title="Implement `Fusionar` mode with LWW+tombstones and deterministic renaming" owner="agent">
    <description>
      Add merge semantics aligned with existing sync behavior: latest timestamp wins (`updatedAt`/`deletedAt`), newer deletes win, and name collisions with different ids coexist via suffix strategy (`(2)`, `(3)`, ...). Preserve deterministic behavior across repeated imports.
    </description>
    <acceptance_criteria>
      <item>`Fusionar` resolves by id using LWW/tombstones and produces deterministic results.</item>
      <item>Newer delete beats older active record.</item>
      <item>Name collisions produce coexistence with suffixes instead of silent overwrite.</item>
      <item>Merge logic is implemented in one reusable place (no duplicated conflict rules across UI/data layers).</item>
    </acceptance_criteria>
  </task>

  <task id="replace-mode-safe-reset" title="Implement `Reemplazar` mode with base-catalog preservation" owner="agent">
    <description>
      Implement destructive restore mode that clears local functional data and restores from backup while preserving base exercise catalog behavior (`wger`) and app operability. Keep this path strictly transactional.
    </description>
    <acceptance_criteria>
      <item>`Reemplazar` performs a full functional reset + restore in a single transaction.</item>
      <item>Base exercise catalog remains available after replace flow.</item>
      <item>No partial state remains if an error happens mid-process.</item>
      <item>The restore result matches backup payload contents for included entities.</item>
    </acceptance_criteria>
  </task>

  <task id="settings-data-ux-flow" title="Ship 3-step full backup UX under Ajustes > Datos" owner="agent">
    <description>
      Extend `Ajustes` with a dedicated full backup section. Implement import UX in three steps (file, preview+mode, final confirmation), strong confirmation text for replace (`REEMPLAZAR`), and result feedback (toast + expandable details). Keep routine import/export section separate.
    </description>
    <acceptance_criteria>
      <item>`Ajustes &gt; Datos` has a clear section for full backup export/import and separate routine-level tools.</item>
      <item>Import flow enforces 3 steps with explicit mode selection and confirmation.</item>
      <item>`Reemplazar` requires typing `REEMPLAZAR` before apply.</item>
      <item>Completion feedback includes result counters (importados, fusionados, omitidos, renombrados).</item>
    </acceptance_criteria>
  </task>

  <task id="verification-and-regression-guardrails" title="Verify backup/restore safety and non-regression paths" owner="agent">
    <description>
      Validate end-to-end scenarios for export/import success and failure cases, including malformed file rejection and replace confirmation path. Confirm routine-level import/export still works and build remains green.
    </description>
    <acceptance_criteria>
      <item>`npm run build` passes.</item>
      <item>Full export then import (`Fusionar`) restores missing data and preserves expected local data behavior.</item>
      <item>Malformed or incompatible files are rejected without mutating current data.</item>
      <item>`Reemplazar` only executes after strong confirmation and preserves base exercise catalog.</item>
      <item>Routine-level import/export remains operational and unchanged in UX intent.</item>
    </acceptance_criteria>
  </task>
</tasks>

<verification>
  <criteria>
    <item>El usuario puede exportar un backup total versionado desde `Ajustes &gt; Datos`.</item>
    <item>El usuario puede importar ese backup en modo `Fusionar` o `Reemplazar` con resultado predecible.</item>
    <item>La importación inválida falla con mensajes claros y sin corrupción parcial de datos.</item>
    <item>Se crea auto-backup previo a import para rollback manual del usuario.</item>
    <item>El flujo de import/export por rutina individual se mantiene intacto.</item>
  </criteria>
</verification>

<must_haves>
  <item>Payload full-backup separado del payload de rutina individual.</item>
  <item>`schemaVersion` obligatorio + migraciones seguras.</item>
  <item>Import transaccional y atómico en Dexie.</item>
  <item>Modos `Fusionar` y `Reemplazar` con confirmación fuerte para reemplazo.</item>
  <item>LWW+tombstones + renombrado determinístico por colisión de nombre.</item>
</must_haves>
