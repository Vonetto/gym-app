# Project State: Gym Tracker PWA (Hevy-inspired)

**Date:** 2026-03-04
**Status:** No active phase. Phase 12 completed.

## Current Phase
- None active

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
- Phase 12 discutida: la planificación vive en Calendar, con CTA canónico `Planificar rutina` y atajo secundario `Programar esta rutina` desde `RoutineDetail`.
- Phase 12 investigada: el modelo recomendado separa series planificadas de estados por ocurrencia, usa fechas locales `YYYY-MM-DD` y expande recurrencias solo para el rango visible del calendario.
- Phase 12 planificada: la ejecución se divide en modelo Dexie local, motor de recurrencia por rango visible, composición Calendar + day detail, flujo de planificación desde Calendar/RoutineDetail y transición plan → workout → occurrence status.
- Phase 12 bloque inicial implementado: Dexie ya soporta `plannedWorkoutSeries` y `plannedWorkoutOccurrences`, existen helpers de fecha local/expansión de recurrencia, `Calendar` ya muestra planes por día y permite crear planificaciones simples desde un bottom sheet.
- Phase 12 bloque de transición implementado: las ocurrencias ya se pueden abrir en detalle, iniciar como workout real, marcar `omitido`, y al finalizar una sesión iniciada desde un plan se persiste `completed` con vínculo al `workoutId`.
- Phase 12 completada: el calendario ahora permite planificar rutinas futuras con recurrencia simple, abrir detalle por día, iniciar rutinas desde planes, omitir/desprogramar ocurrencias y navegar desde `Home` con preview de agenda sin abrir detalles erróneos.

## Risks & Notes
- La evidencia sigue siendo mucho mas fuerte para `weight_reps` que para `time`/`distance`; esos dos dominios deben seguir tratandose como reglas conservadoras de producto y no como precision cientifica.
- El roadmap legacy de fases 4-7 sigue parcialmente desalineado con lo ya implementado; conviene normalizarlo al abrir la proxima fase.
- Sets avanzados ya tienen semantica analitica fija; el riesgo restante esta en no romper layout movil al introducir badges/menus en la primera columna del set.
- La planificación futura local ya está cerrada para V1; el siguiente paso lógico es conectar recordatorios/notificaciones sobre ocurrencias planificadas.
- Lo pendiente de mayor impacto ya no es el modelo base, sino el pulido fino: más UX alrededor de ocurrencias completadas/omitidas, posibles atajos desde otras pantallas y eventual preparación de sync para agenda futura.
