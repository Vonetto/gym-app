# Phase 4: Timers + Progresión - Context

**Gathered:** 2026-02-02
**Status:** Ready for research

<domain>
## Phase Boundary

Descansos configurables por ejercicio, timers persistentes entre vistas y aviso de fin de descanso fuera de la vista de entrenamiento.
Incluye base para notificaciones en segundo plano (iOS PWA) y diseño de backend para push en fases futuras.

</domain>

<decisions>
## Implementation Decisions

- El descanso debe persistir aunque el usuario salga de la vista de entrenamiento.
- Mostrar un banner global con la sesión activa (nombre + tiempo + CTA “Volver”).
- Al terminar un descanso fuera del workout, mostrar modal centrado dentro de la app (no solo toast).
- Para background real (iOS), se requiere Web Push + backend (no disponible sin servidor).

### Claude's Discretion
- Estilo exacto del modal y contenido de la lista de descansos.
- Política de agrupación de descansos múltiples (lista corta vs. resumen).

</decisions>

<specifics>
## Specific Ideas

- Usar timestamps `endAt` en `active-session` para que el timer reanude correctamente.
- Considerar ventana de retro‑notificación cuando la app vuelve al foreground.

</specifics>

<deferred>
## Deferred Ideas

- Push real en background (requiere backend + SW + VAPID).
- Sugerencias automáticas de progresión por set.

</deferred>

---

*Phase: 04-timers-progresion*
*Context gathered: 2026-02-02*
