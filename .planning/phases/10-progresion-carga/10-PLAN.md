---
wave: 1
depends_on:
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - .planning/phases/10-progresion-carga/10-CONTEXT.md
  - .planning/phases/10-progresion-carga/10-RESEARCH.md
files_modified:
  - .planning/phases/10-progresion-carga/10-PLAN.md
autonomous: true
---

<tasks>
  <task id="shared-session-types" title="Centralize active session types and suggestion state" owner="agent">
    <description>
      Extract the duplicated `WorkoutSession` / set / exercise types from `Home.tsx`, `Workout.tsx`, and `useActiveSession.ts` into a shared module so progression metadata can live in one place. Add per-set suggestion state with suggested values, compact display label, explanation string, and acceptance status.
    </description>
    <acceptance_criteria>
      <item>`active-session` shape is defined once and reused across Home, Workout, banner, and save flow.</item>
      <item>Each set can carry an optional progression suggestion without breaking existing save/discard logic.</item>
      <item>Suggestions persist in `localStorage` as part of the active session and survive navigation/background resume.</item>
    </acceptance_criteria>
  </task>

  <task id="completed-history-selectors" title="Add selectors for completed-set history and metric baselines" owner="agent">
    <description>
      Extend the workout data layer with helpers that return completed exercise history grouped by workout session, filtered to completed sets only, plus small utilities for mapping previous completed values into comparable session baselines. Keep the source of truth in Dexie/workouts and do not infer from unchecked sets.
    </description>
    <acceptance_criteria>
      <item>There are reusable selectors for the last completed sessions of an exercise.</item>
      <item>Selectors ignore unchecked sets and deleted workouts.</item>
      <item>The engine can distinguish current planned values from last actually completed values.</item>
    </acceptance_criteria>
  </task>

  <task id="progression-engine" title="Implement metric-aware progression engine" owner="agent">
    <description>
      Create a dedicated progression module that branches by metric type. For `weight_reps`, implement a conservative double-progression rule using completed history, planned target reps, and equipment-based rounding inside the ACSM 2-10% envelope. For `reps`, `time`, and `distance`, implement conservative success-based increments with no pseudo-scientific precision. The engine should return both suggested values and a short explanation string.
    </description>
    <acceptance_criteria>
      <item>`weight_reps` suggestions use completed history only and never depend on RPE.</item>
      <item>The engine can return `maintain/no suggestion` when baseline is weak or performance is inconsistent.</item>
      <item>`reps`, `time`, and `distance` each have explicit, testable conservative rules rather than sharing one generic formula.</item>
      <item>Suggested loads round to sensible steps based on existing exercise equipment metadata.</item>
    </acceptance_criteria>
  </task>

  <task id="session-bootstrap" title="Generate suggestions when sessions start and when exercises are added live" owner="agent">
    <description>
      Integrate progression generation into the places that create workout exercises: start routine, start empty workout, add exercise during session, and replace exercise during session. Suggestions should be computed once per exercise/session bootstrap and stored with the active session, not recalculated on every keystroke.
    </description>
    <acceptance_criteria>
      <item>Routine starts preload suggestions for eligible exercises.</item>
      <item>Adding or replacing an exercise during a live workout also preloads suggestions.</item>
      <item>Editing metric inputs manually does not trigger unstable live recalculation loops.</item>
    </acceptance_criteria>
  </task>

  <task id="workout-table-ui" title="Add compact inline suggestion UX to the workout table" owner="agent">
    <description>
      Extend the workout table with a narrow `SUG.` surface that fits on mobile without horizontal scroll. The suggestion cell should be a compact tap target that applies suggested values into the row. Use short delta labels such as `+2.5`, `+1r`, `+15s`, or `+50m`; place the longer explanation at exercise level as muted helper text so the row stays compact.
    </description>
    <acceptance_criteria>
      <item>`weight_reps`, `reps`, `time`, and `distance` rows all render a compact suggestion affordance when applicable.</item>
      <item>The table still fits on phone widths without horizontal scroll.</item>
      <item>Tapping the suggestion applies the values into the current set row.</item>
      <item>The exercise surface exposes a one-line explanation such as why the suggestion exists.</item>
    </acceptance_criteria>
  </task>

  <task id="accept-reject-lifecycle" title="Define accept/reject semantics without extra modal friction" owner="agent">
    <description>
      Implement a low-friction acceptance lifecycle: tapping `SUG.` marks the row as accepted and fills the suggested values; leaving the suggestion unused, editing away from it, or finishing the workout without applying it counts as rejection/ignored. Reflect accepted vs pending visually without adding per-set popups.
    </description>
    <acceptance_criteria>
      <item>Accepted suggestions have a distinct visual state.</item>
      <item>Unapplied or overridden suggestions are treated as rejected/ignored without extra dialogs.</item>
      <item>Finishing the workout does not persist suggestion metadata into workout history rows.</item>
    </acceptance_criteria>
  </task>

  <task id="verification-and-guardrails" title="Verify progression behavior on real workout flows" owner="agent">
    <description>
      Validate the new behavior against the current Hevy-like workout UX: build passes, mobile layout stays stable, and the engine behaves conservatively on common cases (successful progression, maintain, weak history, non-weight metrics).
    </description>
    <acceptance_criteria>
      <item>`npm run build` passes.</item>
      <item>On mobile widths, the set table with `SUG.` still fits without horizontal scroll.</item>
      <item>`weight_reps` can demonstrate at least three cases: increase, maintain, no suggestion.</item>
      <item>`reps`, `time`, and `distance` each demonstrate a conservative suggestion path.</item>
    </acceptance_criteria>
  </task>
</tasks>

<verification>
  <criteria>
    <item>La sugerencia se integra inline en la tabla actual y no rompe el layout movil.</item>
    <item>La sugerencia usa solo historial de sets completados y nunca depende obligatoriamente de RPE.</item>
    <item>El usuario puede aplicar la sugerencia por fila con un tap y seguir entrenando sin modales extra.</item>
    <item>La logica de `weight_reps` es conservadora, explicable y redondea segun equipamiento.</item>
    <item>Los ejercicios `reps`, `time` y `distance` reciben soporte inicial simple sin pseudo-precision.</item>
  </criteria>
</verification>

<must_haves>
  <item>Motor de progresion separado por tipo de metrica.</item>
  <item>Historial basado solo en sets completados.</item>
  <item>UX inline compacta tipo `SUG.` mobile-first.</item>
  <item>Aceptacion/rechazo sin popup por set.</item>
  <item>Sin dependencia obligatoria de RPE ni composicion corporal.</item>
</must_haves>
