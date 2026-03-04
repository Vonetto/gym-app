# Project State: Gym Tracker PWA (Hevy-inspired)

**Date:** 2026-03-03
**Status:** Phase 10 completed; roadmap listo para abrir la siguiente fase.

## Current Phase
- No active phase. Ultima fase cerrada: Phase 10 (Progresion de Carga).

## Progress Summary
- Phase 1 completed: PWA shell, offline indicator, theme toggle, reset flow, local persistence.
- Phase 2 completed: rutinas, catalogo, workouts, historial, perfil, calendario, y export/import local.
- Phase 3 completed: directorio de ejercicios, detalle con historial/1RM, tips con cache wrkout.
- Phase 8 completed: BFF local, Supabase `wrkout-proxy`, y frontend Vercel operativos en produccion.
- Phase 9 completed: Supabase Auth email/password, onboarding invitado/cuenta, sync local-first con LWW+tombstones, y RLS en cloud.
- Phase 10 completed: motor de progresion explicable por tipo de metrica, `goalMode` para `weight_reps`, UX inline `SUG.`, precarga desde prescripcion actual, override de tipo de metrica por ejercicio y fallback bodyweight.

## Risks & Notes
- La evidencia sigue siendo mucho mas fuerte para `weight_reps` que para `time`/`distance`; esos dos dominios deben seguir tratandose como reglas conservadoras de producto y no como precision cientifica.
- El roadmap legacy de fases 4-7 sigue parcialmente desalineado con lo ya implementado; conviene normalizarlo al abrir la proxima fase.
- Siguientes candidatos naturales: sets avanzados, planificacion/calendario futuro o notificaciones/push reales.
