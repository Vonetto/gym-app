# Project State: Gym Tracker PWA (Hevy-inspired)

**Date:** 2026-03-03
**Status:** Phase 11 completed; no active phase.

## Current Phase
- No active phase

## Progress Summary
- Phase 1 completed: PWA shell, offline indicator, theme toggle, reset flow, local persistence.
- Phase 2 completed: rutinas, catalogo, workouts, historial, perfil, calendario, y export/import local.
- Phase 3 completed: directorio de ejercicios, detalle con historial/1RM, tips con cache wrkout.
- Phase 8 completed: BFF local, Supabase `wrkout-proxy`, y frontend Vercel operativos en produccion.
- Phase 9 completed: Supabase Auth email/password, onboarding invitado/cuenta, sync local-first con LWW+tombstones, y RLS en cloud.
- Phase 10 completed: motor de progresion explicable por tipo de metrica, `goalMode` para `weight_reps`, UX inline `SUG.`, precarga desde prescripcion actual, override de tipo de metrica por ejercicio y fallback bodyweight.
- Phase 11 bloque base implementado: `setType` y `defaultSetTypes` ya persisten en session/Dexie/sync/backup; PRs y progresion filtran `warmup`/`drop` desde helpers centralizados.
- Phase 11 segundo bloque implementado: `Workout` ya permite marcar tipos desde la primera columna con bottom sheet Hevy-like, badges coloreados y `Eliminar serie`.
- Phase 11 tercer bloque implementado: `RoutineDetail` ya soporta presets visuales por set y Home/Calendar/ExerciseDetail muestran badges en historial/revision.
- Phase 11 completada: verificación manual del usuario OK y `11-SUMMARY.md` agregado.

## Risks & Notes
- La evidencia sigue siendo mucho mas fuerte para `weight_reps` que para `time`/`distance`; esos dos dominios deben seguir tratandose como reglas conservadoras de producto y no como precision cientifica.
- El roadmap legacy de fases 4-7 sigue parcialmente desalineado con lo ya implementado; conviene normalizarlo al abrir la proxima fase.
- Sets avanzados ya tienen semantica analitica fija; el riesgo restante esta en no romper layout movil al introducir badges/menus en la primera columna del set.
- No hay fase activa. El siguiente paso natural es elegir la próxima fase del roadmap.
