# Phase 8: Backend Foundation - Context

**Gathered:** 2026-02-18
**Status:** Ready for execution

<domain>
## Phase Boundary

Crear la base backend para:
- Resolver CORS de integraciones externas (wrkout).
- Mover secretos (API keys) fuera del cliente.
- Dejar contrato API estable para futuras capacidades cloud (auth/sync/push).

Esta fase NO incluye login completo, sync multi-dispositivo, ni push en background end-to-end.

</domain>

<decisions>
## Implementation Decisions

- Mantener frontend local-first (IndexedDB) y sumar backend como capa incremental.
- Implementar BFF inicial con endpoint `/api/wrkout/*`.
- La API key de wrkout vive en backend (`WRKOUT_API_KEY`), no en frontend.
- Frontend usa backend por defecto (`/api`) y solo mantiene fallback legacy.
- Objetivo cloud posterior: Supabase (Auth + Postgres + Functions), partiendo desde plan gratuito.

### Claude's Discretion
- Forma exacta de scripts de desarrollo (`dev:all`, proxy Vite).
- Formato final de errores de API para mapear a estados UI.

</decisions>

<specifics>
## Specific Ideas

- Endpoint health (`/health`) para diagnóstico rápido.
- Proxy de Vite para desarrollo local (`/api -> :8787`).
- Mensajes UI explícitos cuando backend no está configurado.

</specifics>

<deferred>
## Deferred Ideas

- Persistencia cloud de rutinas/workouts.
- Login de usuarios.
- Push notifications reales en background iOS.
- Webhooks/jobs para notificaciones programadas.

</deferred>

---

*Phase: 08-backend-foundation*
*Context gathered: 2026-02-18*
