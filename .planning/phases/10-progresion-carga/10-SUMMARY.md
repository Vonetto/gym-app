---
phase: 10-progresion-carga
plan: 01
subsystem: progression
tags: [progression, workout, mobile, heuristics, metric-types]

requires:
  - phase: 09-auth-sync-base
    provides: local-first storage estable, historial usable, active session persistente
provides:
  - Motor de progresion explicable por tipo de metrica
  - UX inline `SUG.` integrada al flujo de workout
  - `goalMode` por ejercicio para `weight_reps`
  - Override manual de tipo de metrica por ejercicio de rutina/sesion
affects: [workout, routines, progression, history, calendar, storage-local, sync]

tech-stack:
  added: []
  patterns:
    [
      completed-set history only,
      block-level progression,
      conservative double progression,
      exercise metric override,
      bodyweight fallback
    ]

key-files:
  created:
    [
      src/data/activeSession.ts,
      src/data/progression.ts
    ]
  modified:
    [
      src/data/db.ts,
      src/data/routines.ts,
      src/data/routineBackup.ts,
      src/data/sync.ts,
      src/data/workouts.ts,
      src/pages/Home.tsx,
      src/pages/Workout.tsx,
      src/pages/RoutineDetail.tsx,
      src/pages/Calendar.tsx,
      src/pages/Routines.tsx,
      src/components/ActiveSessionBanner.tsx,
      src/hooks/useActiveSession.ts,
      src/styles.css
    ]

duration: multi-session
completed: 2026-03-03
---

# Phase 10 Summary (Wave 1)

## Delivered

- Se centralizo el shape de `active-session` para compartirlo entre Home, Workout, banner y hooks, incluyendo metadata de sugerencias por set.
- Se agrego historial reutilizable basado solo en sets completados para alimentar la progresion desde workouts reales y no desde sets sin check.
- Se implemento un motor de progresion por tipo de metrica:
  - `weight_reps`: progresion por bloques, con `goalMode`, subida de reps de `+1`, subida de carga solo tras dos sesiones completas en el tope del rango y redondeo por equipamiento.
  - `reps`, `time`, `distance`: reglas conservadoras por bloque completo.
- La sesion nueva ya no arranca pegada al seed inicial de la rutina; ahora se precarga con la prescripcion actual derivada del historial.
- Se agrego la UX inline `SUG.` dentro de la tabla del workout, sin scroll horizontal y con explicacion compacta por ejercicio.
- Se removio la columna `RPE` del workout para liberar espacio en movil.
- Se agrego `goalMode` por ejercicio de rutina (`auto | strength | hypertrophy | endurance`) y el modo `auto` infiere el rango desde las reps objetivo.
- Se agrego `metricTypeOverride` por ejercicio, editable tanto en `Editar rutina` como dentro del workout (`Peso + reps`, `Solo reps`, `Tiempo`, `Distancia`).
- Los ejercicios `weight_reps` con `0 kg` constante ahora hacen fallback automatico a progresion de `reps`, cubriendo mejor ejercicios bodyweight.
- La revision de workouts en Home/Calendar ahora infiere el tipo real desde los sets guardados, para renderizar correctamente `time` y `distance` aunque haya habido override durante la sesion.

## Verification

- `npm run build` (OK)
- Verificacion manual reportada por usuario:
  - `weight_reps` arranca desde la prescripcion actual y no desde el default historico (OK)
  - progreso por bloques tipo `60x10 -> 60x11 -> 60x12 -> 62.5x10` (OK)
  - fallo parcial `12/12/12/8` repite el objetivo correcto y no cae al seed inicial (OK)
  - overrides de tipo (`Solo reps`, `Tiempo`, `Distancia`) visibles y persistentes (OK)
  - revision de entrenamientos muestra correctamente `time`/`distance` segun los sets guardados (OK)
  - layout movil estable tras quitar `RPE` y pulir `SUG.` (OK)

## Remaining

- Si se quiere subir el nivel en futuras fases, la evolucion natural es:
  - heuristicas mas finas por ejercicio/usuario
  - modelos ML/PT asistido
  - señales extra de fatiga/frecuencia/adherencia
- Quedan buckets legacy del roadmap (phases 4-7) con naming desalineado respecto de lo ya implementado; no bloquean V1 pero conviene refactorizarlos al abrir la siguiente fase.
