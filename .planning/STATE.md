# Project State: Gym Tracker PWA (Hevy-inspired)

**Date:** 2026-03-05
**Status:** Phase 16 en ejecución (slice 1 completado).

## Current Phase
- Phase 16: Normalización del Catálogo de Ejercicios (en ejecución)

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
- Phase 13 abierta: el siguiente foco es recordatorios/notificaciones sobre ocurrencias planificadas y timers relevantes, apoyándose en la base de agenda ya cerrada.
- Phase 13 discutida: se definieron recordatorios de rutina planificada, descanso terminado y sesión activa en background, con toggles en `Ajustes`, hora global configurable, ayuda para iPhone/PWA y objetivo explícito de soportar push robusta en esta fase.
- Phase 13 investigada: push robusta es defendible para rutinas planificadas usando service worker + subscriptions + backend scheduler, pero descanso/background session deben tratarse como foreground o best-effort salvo que se amplíe el scope con sync en tiempo real y jobs one-shot.
- Phase 13 planificada: la ejecución se divide en settings/capabilities, base service-worker, UX local para descanso/sesión activa, sync cloud de agenda y preferencias, schema/subscriptions en Supabase, flujo cliente de `PushSubscription` y scheduler backend para recordatorios de rutinas planificadas.
- Phase 13 bloque cliente implementado: `Ajustes` ya expone toggles globales y por tipo, hora/offset global, delay de `¿Sigues entrenando?`, estado de soporte/permisos y flujo explícito de permiso/suscripción push; `rest finished` y background-session reminders ya usan `showNotification()` y el `service worker`.
- Phase 13 bloque cloud desplegado: sync ya incluye agenda futura + preferencias de notificación; Supabase tiene tablas de schedule/preferences/push subscriptions/delivery log, `planned-reminders` está desplegada, el cron quedó configurado y la function respondió `200` en `dryRun`.
- Phase 13 completada: validación manual del usuario reportada OK, cierre formal con `13-SUMMARY.md` y hardening UX móvil (refresh PWA, modal de reloj estilo Hevy, sync inmediato de preferencias de notificación).
- Phase 14 abierta: siguiente foco definido en backup/restore total versionado y UX de recuperación (`fusionar` vs `reemplazar`) con validaciones robustas.
- Phase 14 discutida: alcance y UX acordados (separar rutina individual vs backup total, modos `fusionar/reemplazar`, `schemaVersion` obligatorio, import atómico con preview, confirmación fuerte `REEMPLAZAR` y auto-backup previo).
- Phase 14 investigada: se definió arquitectura para backup total versionado, validación por etapas, import atómico Dexie y estrategia de conflictos LWW+tombstones alineada con sync.
- Phase 14 planificada: se definieron bloques ejecutables para schema/migraciones de backup total, exporter, validación+preview, auto-backup previo, modos `fusionar/reemplazar` y UX final en `Ajustes > Datos`.
- Phase 14 completada: backup total versionado ya operativo con validación robusta, preview de import, auto-backup previo, modos `fusionar/reemplazar` y cierre formal en `14-SUMMARY.md`.
- Phase 15 abierta: foco en consolidación final de V1 (hardening + saneamiento docs + pulido UX acotado).
- Phase 15 discutida: definido criterio de cierre (0 críticos/altos), módulos core de hardening (Sync/Notificaciones/Workout), normalización completa de `REQUIREMENTS.md` legacy y alcance UX final en Workout/Ajustes/Home.
- Phase 15 investigada: definido stack mínimo de hardening (Vitest + Testing Library + fake-indexeddb), matriz de casos obligatorios por riesgo (backup/sync/notificaciones/workout) y estrategia de normalización documental con trazabilidad requirement -> fase real.
- Phase 15 planificada: definido plan ejecutable con bootstrap de tests, suites core de riesgo, normalización legacy 4-7, pulido UX acotado y checklist formal de cierre V1.
- Phase 15 ejecución (slice 1): stack de tests agregado (`vitest`, `@testing-library/react`, `fake-indexeddb`), nuevos scripts `test/test:watch/test:coverage`, suites core para `fullBackup`, `sync`, `notifications` y `workouts`; `npm run test` y `npm run build` pasan.
- Phase 15 ejecución (slice 2): normalización legacy aplicada en docs (`ROADMAP` fases 4-7 como `Consolidated`, y `REQUIREMENTS` sin `Pending` falsos + tabla de equivalencias requirement -> fase real).
- Phase 15 cerrada: QA manual completado, micro-fix UX móvil aplicado al tab bar, y cierre formal documentado en `15-SUMMARY.md` + `15-VERIFICATION.md`.
- Phase 16 abierta/discutida: cierre de decisiones base para normalización de catálogo (canónico en español + aliases, fusión por nombre normalizado con variantes reales separadas, remap automático a IDs canónicos con log de conflictos y preservación de personalizados sin auto-fusión).
- Phase 16 investigada: definido enfoque canonical-first con alias index, migración Dexie transaccional/idempotente y normalización obligatoria en fronteras de sync/backup para evitar reintroducción de IDs legacy.
- Phase 16 planificada: definido `16-PLAN.md` con 8 bloques de ejecución (artefactos canónicos, resolver único, normalización de búsqueda/listado, migración Dexie one-shot, boundary remap en sync/backup, tests de regresión y cierre QA).
- Phase 16 ejecución (slice 1): implementada capa `catalogNormalization` (canonical map + aliases + resolver), seed canónico, migración local idempotente con marker y remap transaccional en rutinas/workouts/favoritos/recientes/tips; además remap en fronteras de sync/backup/routine-backup y tests iniciales de canonicalización.

## Risks & Notes
- La evidencia sigue siendo mucho mas fuerte para `weight_reps` que para `time`/`distance`; esos dos dominios deben seguir tratandose como reglas conservadoras de producto y no como precision cientifica.
- Sets avanzados ya tienen semantica analitica fija; el riesgo restante esta en no romper layout movil al introducir badges/menus en la primera columna del set.
- El pulido UX acotado de Phase 15 debe mantenerse en fixes menores para evitar scope creep.
- La validación local del Edge Function queda limitada porque `supabase functions serve` requiere Docker Desktop; el frontend sí sigue compilando con `npm run build`.
- V1 ya cerró funcionalmente; cualquier feature nueva debe entrar por fase nueva (evitar mezclar cierre con expansión de alcance).
