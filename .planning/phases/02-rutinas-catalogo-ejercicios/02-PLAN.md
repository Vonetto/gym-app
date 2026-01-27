---
wave: 1
depends_on:
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - .planning/phases/02-rutinas-catalogo-ejercicios/02-RESEARCH.md
files_modified:
  - .planning/phases/02-rutinas-catalogo-ejercicios/02-PLAN.md
autonomous: true
---

<tasks>
  <task id="data-schema" title="Define IndexedDB schema for routines and exercise catalog" owner="agent">
    <description>
      Add Dexie tables for exercises (including translations), routines, routine exercises (order), routine tags/days, exercise defaults, favorites/recents, and routine versions/snapshots. Include indexes for name, muscle, equipment, routine ordering, and tag lookup. Add versioning + migrations for Phase 2 data.
    </description>
    <acceptance_criteria>
      <item>Schema includes indexed fields to power search and filters.</item>
      <item>Routine exercises are stored in a junction table with order index.</item>
      <item>Routine edits create version/snapshot records without mutating history.</item>
    </acceptance_criteria>
  </task>
  <task id="catalog-seed" title="Seed exercise catalog from wger dataset" owner="agent">
    <description>
      Add a local JSON seed of wger exercises and import it into IndexedDB on first run. Store all translations and select display name based on app language (Spanish default, fallback to English). Include attribution notice and license metadata.
    </description>
    <acceptance_criteria>
      <item>Exercise catalog loads from local seed on first run.</item>
      <item>Exercise names resolve to Spanish when available, otherwise English fallback.</item>
      <item>Attribution for wger is visible in Settings/About.</item>
    </acceptance_criteria>
  </task>
  <task id="exercise-catalog" title="Build exercise catalog CRUD + search" owner="agent">
    <description>
      Implement catalog views to list, search, and filter exercises by name, muscle, and equipment. Show recent and favorite exercises. Support creating and editing custom exercises with duplicate prevention via name normalization.
    </description>
    <acceptance_criteria>
      <item>User can search exercises by name and see results ordered alphabetically.</item>
      <item>Custom exercise form captures name, muscles, equipment, and metric type.</item>
      <item>Duplicate-name prevention blocks obvious duplicates.</item>
      <item>Favorites and recents are visible in the selector.</item>
    </acceptance_criteria>
  </task>
  <task id="routines-crud" title="Implement routines create/edit/duplicate/delete" owner="agent">
    <description>
      Build routines list and detail flows to create, edit, duplicate, and delete routines. Include days/tags and defaults per exercise. Ensure edits update routine metadata and exercise order without affecting historical sessions (use snapshots/versioning).
    </description>
    <acceptance_criteria>
      <item>User can create, edit, duplicate, and delete routines without errors.</item>
      <item>Routine exercise order persists after reload.</item>
      <item>Duplicated routines include last-used values where available.</item>
    </acceptance_criteria>
  </task>
  <task id="routines-reorder" title="Add routine ordering interactions" owner="agent">
    <description>
      Implement drag/press reorder controls in the routines list and persist the ordering in IndexedDB.
    </description>
    <acceptance_criteria>
      <item>User can reorder routines and the order persists after reload.</item>
    </acceptance_criteria>
  </task>
  <task id="start-empty-workout" title="Add empty workout CTA from routines screen" owner="agent">
    <description>
      Add the "Empezar entrenamiento vacío" action to the routines screen and ensure it starts a blank session context.
    </description>
    <acceptance_criteria>
      <item>CTA is visible and launches an empty session flow.</item>
    </acceptance_criteria>
  </task>
</tasks>

<verification>
  <criteria>
    <item>Routines can be created, edited, duplicated, deleted, and reordered with persistence.</item>
    <item>Exercise catalog supports search and custom exercise creation with duplicate prevention.</item>
    <item>User can start an empty workout from routines screen.</item>
  </criteria>
</verification>

<must_haves>
  <item>Full CRUD for routines with persistent ordering.</item>
  <item>Exercise catalog with search and custom exercise management.</item>
  <item>Empty workout CTA available on routines screen.</item>
</must_haves>
