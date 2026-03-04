---
wave: 1
depends_on:
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - .planning/phases/11-sets-avanzados/11-CONTEXT.md
  - .planning/phases/11-sets-avanzados/11-RESEARCH.md
files_modified:
  - .planning/phases/11-sets-avanzados/11-PLAN.md
autonomous: true
---

<tasks>
  <task id="set-type-model" title="Add `setType` enum across active session, Dexie, and routine defaults" owner="agent">
    <description>
      Introduce a shared advanced-set enum (`normal | warmup | drop | failure | amrap`) and thread it through the data model. Extend `ActiveWorkoutSet`, `WorkoutSetRecord`, and routine defaults with backward-compatible defaults to `normal`. Add routine-level presets as `defaultSetTypes[]` aligned by set index.
    </description>
    <acceptance_criteria>
      <item>`setType` exists in shared types and persists in `active-session` without breaking resume/discard/save.</item>
      <item>Dexie schema supports `setType` on workout sets and `defaultSetTypes` on routine defaults.</item>
      <item>Existing history and routines with no type metadata continue behaving as `normal`.</item>
      <item>Duplicating a routine preserves `defaultSetTypes`.</item>
    </acceptance_criteria>
  </task>

  <task id="analytics-eligibility" title="Centralize volume / PR / progression eligibility by set type" owner="agent">
    <description>
      Create a single helper module that defines what each set type contributes to volume, PRs, and progression. Rewire existing analytics and progression code to use this shared filter layer instead of iterating every completed set indiscriminately.
    </description>
    <acceptance_criteria>
      <item>`warmup` and `drop` count for volume but not for PRs or progression.</item>
      <item>`normal`, `failure`, and `amrap` remain eligible for PRs and progression.</item>
      <item>Profile/Stats PR calculations and progression history selectors read from the centralized helper.</item>
      <item>No duplicate filtering logic remains scattered across screens.</item>
    </acceptance_criteria>
  </task>

  <task id="sync-backup-persistence" title="Persist advanced set metadata through sync and routine backup" owner="agent">
    <description>
      Extend Supabase sync payloads and routine backup versioning to carry `setType` and `defaultSetTypes`. Keep compatibility with old payloads by defaulting missing values to `normal`.
    </description>
    <acceptance_criteria>
      <item>Workout sync serializes/deserializes `setType` per set.</item>
      <item>Routine sync serializes/deserializes `defaultSetTypes` in exercise defaults.</item>
      <item>Routine import/export preserves advanced-set presets and completed workout set types.</item>
      <item>Legacy backups and cloud rows without the new fields still import/read safely.</item>
    </acceptance_criteria>
  </task>

  <task id="workout-marking-ui" title="Add Hevy-like set type menu and badge rendering in workout" owner="agent">
    <description>
      Make the first column of the workout table the interaction surface for set type. Tapping it should open a compact menu or bottom sheet with `Normal`, `Warm-up`, `Drop`, `Fallo`, `AMRAP`, and `Eliminar Serie`. Render short badges (`W`, `D`, `F`, `A`) with agreed colors, while `normal` continues to show the set number.
    </description>
    <acceptance_criteria>
      <item>The menu opens from the set identifier and is usable on phone widths.</item>
      <item>Changing the type updates the badge immediately without shifting table layout.</item>
      <item>`Eliminar Serie` works from the same menu.</item>
      <item>The table stays within mobile width without horizontal scroll.</item>
    </acceptance_criteria>
  </task>

  <task id="routine-preset-ui" title="Support advanced-set presets in routine creation/editing and workout bootstrap" owner="agent">
    <description>
      Allow routine exercises to define per-set types ahead of time and ensure those presets seed the workout session correctly. Reuse the same set-type menu/badge language in routine editing so workouts and routine design stay consistent.
    </description>
    <acceptance_criteria>
      <item>Editing a routine allows changing each seed set between the five supported types.</item>
      <item>Starting a workout from that routine preloads the matching set types.</item>
      <item>Adding/removing sets in routine editing re-aligns `defaultSetTypes` by index.</item>
      <item>Updating a routine from a live workout can persist changed set types when the user chooses to update the routine.</item>
    </acceptance_criteria>
  </task>

  <task id="history-review-ui" title="Show advanced-set badges in review and history surfaces" owner="agent">
    <description>
      Update workout review surfaces (home recent workout modal, calendar workout modal, and any other session breakdown view) to render set-type badges consistently. Use compact badges and keep metric rendering intact across `weight_reps`, `reps`, `time`, and `distance`.
    </description>
    <acceptance_criteria>
      <item>Workout review shows `W/D/F/A` badges for non-normal sets.</item>
      <item>Metric values remain readable for all metric types alongside the badge.</item>
      <item>Sets without explicit metadata display as `normal` without visual regressions.</item>
    </acceptance_criteria>
  </task>

  <task id="verification-and-guardrails" title="Verify end-to-end behavior for advanced sets" owner="agent">
    <description>
      Validate the complete flow: routine presets, live workout marking, save/reload, history/review rendering, PR/progression filtering, sync/backups compatibility, and mobile layout stability.
    </description>
    <acceptance_criteria>
      <item>`npm run build` passes.</item>
      <item>Advanced-set badges survive save/reload in Dexie and active-session resume.</item>
      <item>PRs/progression ignore `warmup` and `drop` but include `failure` and `amrap`.</item>
      <item>Recent workout review and calendar review reflect the saved set types correctly.</item>
      <item>Routine presets survive duplication, import/export, and cloud sync.</item>
    </acceptance_criteria>
  </task>
</tasks>

<verification>
  <criteria>
    <item>El usuario puede marcar tipos de set desde la primera columna sin romper el layout móvil.</item>
    <item>Los tipos de set persisten en rutina, workout, historial, sync e import/export.</item>
    <item>La semántica analítica es consistente: volumen incluye todos los sets completados; PRs y progresión filtran `warmup` y `drop`.</item>
    <item>Los badges se muestran en historial/revisión con el mismo lenguaje visual del workout.</item>
    <item>La compatibilidad hacia atrás mantiene como `normal` todo set viejo sin metadata.</item>
  </criteria>
</verification>

<must_haves>
  <item>`setType` persistido por set y `defaultSetTypes` por rutina.</item>
  <item>Helpers centralizados de elegibilidad para volumen / PR / progresión.</item>
  <item>Menú estilo Hevy desde la primera columna del set.</item>
  <item>Badges compactos y colores fijos, mobile-first.</item>
  <item>Compatibilidad completa con sync e import/export existentes.</item>
</must_haves>
