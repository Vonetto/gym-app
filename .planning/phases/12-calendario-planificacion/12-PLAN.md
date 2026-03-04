---
wave: 1
depends_on:
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - .planning/phases/12-calendario-planificacion/12-CONTEXT.md
  - .planning/phases/12-calendario-planificacion/12-RESEARCH.md
files_modified:
  - .planning/phases/12-calendario-planificacion/12-PLAN.md
autonomous: true
---

<tasks>
  <task id="schedule-model-local" title="Add local planning entities and repositories in Dexie" owner="agent">
    <description>
      Introduce a local-first planning model with two new entities: scheduled series and occurrence state overrides. Extend Dexie with backward-compatible tables for `plannedWorkoutSeries` and `plannedWorkoutOccurrences`, plus repository helpers to create, update, soft-delete, and query plans by date/range.
    </description>
    <acceptance_criteria>
      <item>Dexie has dedicated records for series and occurrence overrides, using `YYYY-MM-DD` local dates.</item>
      <item>One-time plans and recurring plans share the same series model.</item>
      <item>Soft delete and `updatedAt`/`deletedAt` semantics match the rest of the app.</item>
      <item>No pseudo-workout rows are created to represent future plans.</item>
    </acceptance_criteria>
  </task>

  <task id="local-date-recurrence-engine" title="Implement local-date helpers and recurrence expansion for visible calendar ranges" owner="agent">
    <description>
      Build a deterministic recurrence helper layer for `once`, `weekly`, and weekday-based series. All calculations must be local-date based and return virtual occurrences only for the requested range, avoiding UTC drift and avoiding materializing infinite series.
    </description>
    <acceptance_criteria>
      <item>There are helpers to parse/format/compare `YYYY-MM-DD` without relying on `toISOString()` as the source of truth.</item>
      <item>Visible occurrences can be expanded for the current month and for a selected day.</item>
      <item>Recurring plans with no end date do not create unbounded persisted rows.</item>
      <item>`endDate` cuts recurrence inclusively and weekday selection is deterministic.</item>
    </acceptance_criteria>
  </task>

  <task id="calendar-ui-composition" title="Compose planned occurrences with workout history in Calendar" owner="agent">
    <description>
      Rework the calendar screen so each day cell combines planned items and completed workouts without mixing their storage models. Add the agreed visual language for `pendiente`, `completado`, `omitido`, and existing performed workouts, and make the selected-day detail group content under `Planificados` and `Realizados`.
    </description>
    <acceptance_criteria>
      <item>The month grid visually distinguishes planned vs performed days with the agreed dot/ring semantics.</item>
      <item>Tapping a day with both plans and workouts shows a grouped detail list instead of flattening everything together.</item>
      <item>Existing workout review modals keep working without regression.</item>
      <item>The calendar remains readable on phone widths.</item>
    </acceptance_criteria>
  </task>

  <task id="plan-creation-and-editing-ui" title="Add planner flow from Calendar and prefilled shortcut from RoutineDetail" owner="agent">
    <description>
      Add the canonical CTA `Planificar rutina` to Calendar and a secondary shortcut `Programar esta rutina` in routine detail. Both should open the same modal or bottom sheet to choose routine, date, recurrence type, weekdays, and optional end date. Editing a recurring plan applies to the whole series only.
    </description>
    <acceptance_criteria>
      <item>Calendar exposes a clear `Planificar rutina` action.</item>
      <item>`RoutineDetail` can open the same planner prefilled with the current routine.</item>
      <item>The planner supports `una vez`, `semanal`, and `días específicos` plus optional end date.</item>
      <item>There is no recurrence UI embedded directly into the routine editor.</item>
    </acceptance_criteria>
  </task>

  <task id="plan-detail-and-state-transitions" title="Add plan detail, start flow, and occurrence status transitions" owner="agent">
    <description>
      Implement the per-day plan detail surface: opening a plan shows the routine name, the day context, and CTA `Empezar rutina`. Starting from there should carry enough context so finishing the workout marks that occurrence as `completado`, while manual actions can mark it `omitido` and otherwise leave it `pendiente`.
    </description>
    <acceptance_criteria>
      <item>Opening a planned item shows detail with CTA `Empezar rutina`.</item>
      <item>Finishing a workout started from that detail links the workout to the planned occurrence and marks it `completado`.</item>
      <item>There is an explicit `Omitir` path that marks the occurrence as `omitido`.</item>
      <item>Doing a different workout on the same day does not auto-complete unrelated pending plans.</item>
    </acceptance_criteria>
  </task>

  <task id="import-export-and-future-sync-guardrails" title="Keep planning persistence compatible with backup and future cloud sync" owner="agent">
    <description>
      Even if schedule sync stays deferred in this phase, the local model should already follow the app's standard persistence shape (`id`, `updatedAt`, `deletedAt`). Extend backup/export shape as needed, and ensure the new planning entities are easy to add later to Supabase without redesigning them.
    </description>
    <acceptance_criteria>
      <item>Planning records follow the same local-first metadata conventions as routines/workouts.</item>
      <item>The phase does not introduce a one-off model that would block future sync.</item>
      <item>If backup/export touches planning, the schema remains versionable and backward-compatible.</item>
      <item>No cloud tables are required to deliver the local V1 UX of this phase.</item>
    </acceptance_criteria>
  </task>

  <task id="verification-and-guardrails" title="Verify end-to-end planning behavior and date safety" owner="agent">
    <description>
      Validate that planning works across realistic date flows: create one-time and recurring plans, inspect them in the month grid, open a day with planned+completed items, start a workout from a plan, complete or omit it, and confirm local dates stay stable across month navigation without timezone drift.
    </description>
    <acceptance_criteria>
      <item>`npm run build` passes.</item>
      <item>One-time and recurring plans render correctly in the visible month.</item>
      <item>Completing from a plan marks the correct occurrence as completed and links the workout.</item>
      <item>Omitting a plan updates only that occurrence, not the whole series definition.</item>
      <item>Local `YYYY-MM-DD` handling keeps day placement stable when navigating calendar months.</item>
    </acceptance_criteria>
  </task>
</tasks>

<verification>
  <criteria>
    <item>El usuario puede planificar una rutina futura y verla en el calendario sin crear workouts falsos.</item>
    <item>La recurrencia simple se expande solo para el rango visible y no materializa series infinitas.</item>
    <item>Un día puede mostrar `Planificados` y `Realizados` en la misma vista, claramente separados.</item>
    <item>Completar una rutina desde el detalle del plan marca la ocurrencia correcta como `completado`.</item>
    <item>La implementación usa fechas locales `YYYY-MM-DD` y evita drift por zona horaria.</item>
  </criteria>
</verification>

<must_haves>
  <item>Modelo dual: serie planificada + estado por ocurrencia.</item>
  <item>Helpers de recurrencia propios para `once`, `weekly` y `weekdays`.</item>
  <item>CTA principal `Planificar rutina` en `Calendar` y atajo `Programar esta rutina` desde `RoutineDetail`.</item>
  <item>Estados explícitos `pendiente`, `completado`, `omitido`.</item>
  <item>Separación estricta entre agenda futura e histórico de workouts.</item>
</must_haves>
