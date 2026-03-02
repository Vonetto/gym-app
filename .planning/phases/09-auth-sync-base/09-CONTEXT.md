# Phase 9: Auth + Sync Base - Context

**Gathered:** 2026-02-27
**Status:** Ready for research

<domain>
## Phase Boundary

Agregar autenticación con Supabase y sincronización base de datos del usuario sin romper el modo local-first existente.

Incluye:
- login/signup con email + password
- modo invitado
- sincronización inicial de rutinas, ejercicios personalizados, favoritos y workouts/historial
- estrategia básica de conflictos

No incluye:
- reset de contraseña
- medidas
- planificación/calendario futuro
- push notifications
- sync de settings locales

</domain>

<decisions>
## Implementation Decisions

### Autenticación
- Método de auth: **email + password**
- La app tendrá **login + sign up**
- **No** se incluye reset password en esta fase
- El acceso a cuenta estará en **Perfil**, dentro de un card `Cuenta`

### Qué se sincroniza
- **Sí**: rutinas, ejercicios personalizados, workouts/historial
- **Sí**: favoritos
- **No**: recientes
- **No**: medidas
- **No**: planificación/calendario futuro
- El catálogo base de **wger** sigue siendo **local-only**
- Los **settings** (tema, statsRangeDays, etc.) siguen siendo **local-only**

### Modelo offline + conflictos
- Estrategia principal: **última edición gana** por timestamp
- Conflictos a nivel de **registro completo** en V1 (sin merge fino por campo)
- Si hay borrado vs edición, **gana el borrado** si es más nuevo
- UX de sync: **banner/estado discreto** si todo va bien; resolución manual solo si algo falla

### Onboarding y migración
- Primera apertura de la app: mostrar opciones **Crear cuenta**, **Iniciar sesión** o **Continuar como invitado**
- No se bloquea el uso local sin cuenta
- Si el usuario crea cuenta y la nube está vacía: **subir local → nube**
- Si hay datos en la nube y también en local: **preguntar**
- Si el usuario inicia sesión y existe cloud + local: preguntar **fusionar / reemplazar**

### Claude's Discretion
- Diseño exacto del card `Cuenta` y del CTA inicial
- Copy exacto de banners de sync, errores y diálogos de migración
- Modelo exacto de timestamps/versionado y shape SQL para conflicto por registro

</decisions>

<specifics>
## Specific Ideas

- Mantener una capa de sync incremental sobre el modelo local actual (IndexedDB primero, Supabase como réplica)
- Usar timestamps por registro y soft delete para aplicar conflictos de forma determinística
- Resolver onboarding desde una pantalla/modal inicial no bloqueante que permita continuar como invitado

</specifics>

<deferred>
## Deferred Ideas

- Reset password
- Merge fino por campo
- Sync de settings
- Sync de medidas
- Sync de planificación/calendario
- Multi-device conflict UX avanzada

</deferred>

---

*Phase: 09-auth-sync-base*
*Context gathered: 2026-02-27*
