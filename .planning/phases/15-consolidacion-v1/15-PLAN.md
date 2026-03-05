---
wave: 1
depends_on:
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - .planning/phases/15-consolidacion-v1/15-CONTEXT.md
  - .planning/phases/15-consolidacion-v1/15-RESEARCH.md
  - .planning/phases/14-import-export-total-recovery/14-SUMMARY.md
files_modified:
  - .planning/phases/15-consolidacion-v1/15-PLAN.md
autonomous: true
---

<tasks>
  <task id="test-infra-bootstrap" title="Bootstrap test infrastructure for V1 hardening" owner="agent">
    <description>
      Add a minimal, maintainable local test stack for this phase only: Vitest as runner, React Testing Library for UI behavior where needed, and fake-indexeddb for deterministic Dexie tests. Add `npm run test` script and test setup files without changing production runtime behavior.
    </description>
    <acceptance_criteria>
      <item>`npm run test` exists and runs locally.</item>
      <item>Vitest setup supports TypeScript and jsdom where required.</item>
      <item>Dexie-dependent tests can run in Node using fake-indexeddb.</item>
      <item>No regression in `npm run build`.</item>
    </acceptance_criteria>
  </task>

  <task id="backup-sync-core-tests" title="Add core regression tests for backup/import and sync conflict rules" owner="agent">
    <description>
      Implement risk-based tests around LWW/tombstones and full-backup import safety. Cover successful merge/replace paths, corrupt/incomplete payload rejection, and deterministic conflict outcomes (including rename collisions).
    </description>
    <acceptance_criteria>
      <item>There are tests for both `merge` and `replace` import modes.</item>
      <item>Invalid payloads fail with expected error codes and no writes.</item>
      <item>LWW/tombstone conflict behavior is explicitly tested.</item>
      <item>Name collision behavior remains deterministic across repeated runs.</item>
    </acceptance_criteria>
  </task>

  <task id="notifications-workout-core-tests" title="Add core tests for notification gates and workout persistence behavior" owner="agent">
    <description>
      Add targeted tests validating notification toggles/permission gating and workout recording invariants tied to V1 closure (for example: no session saved with zero completed sets, metric handling by exercise type, and stable completion behavior).
    </description>
    <acceptance_criteria>
      <item>Notification global/type toggles are covered in automated tests.</item>
      <item>Permission-denied scenarios are handled without throwing unhandled errors.</item>
      <item>Workout flow rules critical for V1 are covered (zero completed sets discarded, metric-safe persistence).</item>
      <item>All new tests pass with `npm run test`.</item>
    </acceptance_criteria>
  </task>

  <task id="legacy-roadmap-requirements-normalization" title="Normalize legacy phases 4-7 and requirements traceability" owner="agent">
    <description>
      Align planning docs with the real implementation history: keep phases 4-7 but mark them as consolidated/superseded where applicable, remove false `Pending` statuses in V1 requirements, and add a clear requirement-to-phase equivalence table for auditability.
    </description>
    <acceptance_criteria>
      <item>`ROADMAP.md` reflects legacy phase consolidation without deleting history.</item>
      <item>`REQUIREMENTS.md` no longer contains false `Pending` items for already delivered V1 scope.</item>
      <item>Traceability table maps each requirement to the phase where it was actually implemented.</item>
      <item>`STATE.md` is updated to reflect the normalized model.</item>
    </acceptance_criteria>
  </task>

  <task id="ux-polish-workout-settings-home" title="Apply scoped UX polish on Workout, Settings and Home" owner="agent">
    <description>
      Ship only micro-polish fixes and spacing/density improvements on prioritized screens (`Workout`, `Ajustes`, `Home`) to resolve visible rough edges found during V1 closure. Avoid redesigns and avoid scope expansion.
    </description>
    <acceptance_criteria>
      <item>Only regression fixes and micro-adjustments are included (no major redesign).</item>
      <item>Changes are validated on mobile viewport and do not break current behavior.</item>
      <item>Any deferred UX ideas are documented instead of silently dropped.</item>
    </acceptance_criteria>
  </task>

  <task id="closure-verification-checklist" title="Run V1 closure verification and capture evidence" owner="agent">
    <description>
      Execute the agreed closure gate: build + tests in local, plus manual QA checklist in production/local for core flows. Capture pass/fail evidence and explicit pending items before declaring V1 closure.
    </description>
    <acceptance_criteria>
      <item>`npm run build` passes.</item>
      <item>`npm run test` passes.</item>
      <item>Manual QA checklist exists and is completed for production + local.</item>
      <item>No critical/high issues remain open at closure point.</item>
    </acceptance_criteria>
  </task>

  <task id="phase-15-summary-and-handover" title="Create closure summary with pending backlog and deferred UX" owner="agent">
    <description>
      Produce the formal phase summary and handover artifact with what was closed, what remains intentionally deferred, and how to continue after V1.
    </description>
    <acceptance_criteria>
      <item>`15-SUMMARY.md` is created in phase directory.</item>
      <item>Summary includes closure evidence, unresolved medium-priority items, and `Deferred UX` section.</item>
      <item>`ROADMAP.md`, `STATE.md`, and `REQUIREMENTS.md` are synchronized to the final phase status.</item>
    </acceptance_criteria>
  </task>
</tasks>

<verification>
  <criteria>
    <item>El cierre V1 mantiene 0 bugs críticos y 0 bugs altos.</item>
    <item>Existe infraestructura de tests local con `npm run test` y cobertura de riesgos core (Sync, Notificaciones, Workout, Backup/Import).</item>
    <item>Los artefactos de planificación quedan alineados con lo implementado (sin estados legacy inconsistentes).</item>
    <item>El pulido UX se mantiene acotado a ajustes menores en Workout, Ajustes y Home.</item>
    <item>Se genera evidencia formal de cierre: `15-SUMMARY.md` + checklist QA + pendientes explícitos.</item>
  </criteria>
</verification>

<must_haves>
  <item>Gate de fase: `npm run build` + `npm run test` en local.</item>
  <item>Cobertura obligatoria en conflictos de backup/import (`merge`, `replace`, corruptos, LWW/tombstones).</item>
  <item>Normalización completa de `REQUIREMENTS.md` (sin `Pending` falsos en V1).</item>
  <item>Trazabilidad requirement -> fase real de implementación.</item>
  <item>Deuda UX fuera de alcance registrada en `STATE.md` y `15-SUMMARY.md`.</item>
</must_haves>
