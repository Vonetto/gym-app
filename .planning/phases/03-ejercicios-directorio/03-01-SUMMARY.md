---
phase: 03-ejercicios-directorio
plan: 01
subsystem: ui
tags: [react, dexie, wrkout, indexeddb]

# Dependency graph
requires:
  - phase: 02-rutinas-catalogo-ejercicios
    provides: ejercicio base + favoritos/recientes + workouts en IndexedDB
provides:
  - Directorio de ejercicios con tabs A‑Z / Músculo / Equipo
  - Detalle de ejercicio con historial y 1RM/mejor marca
  - Tips de ejercicios con cache local (wrkout.xyz)
affects: [historial, perfiles, ejercicios]

# Tech tracking
tech-stack:
  added: [wrkout API (REST), settings key storage]
  patterns: [tips cache with TTL 180 days, exercise detail aggregation]

key-files:
  created: [src/pages/ExerciseDetail.tsx, src/data/wrkout.ts]
  modified: [src/pages/ExerciseCatalog.tsx, src/pages/Profile.tsx, src/data/db.ts, src/data/workouts.ts, src/pages/Settings.tsx, src/styles.css]

key-decisions:
  - "Directorio por tabs A‑Z / Músculo / Equipo con chips y búsqueda"
  - "Detalle con historial cronológico + 1RM mejor histórico"
  - "Tips via wrkout.xyz con cache 180 días y fallback"

patterns-established:
  - "Historial por ejercicio usando workoutExercises + workoutSets"
  - "Tips cacheados por exerciseId en IndexedDB"

# Metrics
duration: 120min
completed: 2026-02-02
---

# Phase 3: Ejercicios — Directorio + Detalle Summary

**Directorio de ejercicios con tabs A‑Z/músculo/equipo y detalle por ejercicio con historial, mejor marca y tips cacheados.**

## Performance

- **Duration:** 2h
- **Started:** 2026-02-02T00:00:00Z
- **Completed:** 2026-02-02T00:00:00Z
- **Tasks:** 3
- **Files modified:** 10+

## Accomplishments
- Directorio navegable con tabs, chips y búsqueda en la pantalla de Ejercicios.
- Vista detalle con historial cronológico, mejor 1RM o mejor marca según métrica.
- Integración wrkout.xyz con cache 180 días y fallback cuando no hay tips.

## Task Commits

Each task was committed atomically:

1. **Task 1: Exercise directory tabs** — `8700af6` (feat)
2. **Task 2: Exercise detail view** — `567bc37` (feat)
3. **Task 3: wrkout tips cache** — `ba5b45a` (feat)

Additional fix:
- CSS syntax cleanup — `6de5d7e` (fix)

## Files Created/Modified
- `src/pages/ExerciseCatalog.tsx` — tabs A‑Z/músculo/equipo, filtros por chips y links a detalle.
- `src/pages/ExerciseDetail.tsx` — detalle con historial, 1RM/mejor marca y tips.
- `src/data/wrkout.ts` — fetch + cache de tips con TTL.
- `src/data/workouts.ts` — listado de historial por ejercicio.
- `src/data/db.ts` — tabla `wrkoutTips` y settings con API key.
- `src/pages/Settings.tsx` — input de API key.
- `src/styles.css` — estilos para directorio y detalle.

## Decisions Made
- Cache de tips en IndexedDB con TTL 180 días.
- Matching por nombre normalizado y primer resultado.

## Deviations from Plan

None - plan executed as specified (small CSS warning fixed).

## Issues Encountered
- Build warning por brace extra en CSS; corregido y recompilado.

## User Setup Required

- Para tips de ejercicios: ingresar `Wrkout API Key` en Ajustes.

## Next Phase Readiness

- Fase 3 lista para verificación. Directorio + detalle funcionando y tips disponibles con API key.

---
*Phase: 03-ejercicios-directorio*
*Completed: 2026-02-02*
