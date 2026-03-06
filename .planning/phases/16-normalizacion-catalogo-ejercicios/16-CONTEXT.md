# Phase 16: Normalización del Catálogo de Ejercicios - Context

**Gathered:** 2026-03-05
**Status:** Ready for research

<domain>
## Phase Boundary

Normalizar el catálogo base de ejercicios (nombres, duplicados, variantes y metadatos clave) para mejorar consistencia de UX, búsqueda y trazabilidad de datos, sin introducir nuevas features de entrenamiento.

</domain>

<decisions>
## Implementation Decisions

### Canonicalización de nombres e idioma
- Idioma canónico del catálogo: **español**.
- El catálogo debe mantener aliases en otros idiomas para búsqueda y matching.
- No se mostrará nombre bilingüe por defecto en cards/listas; el nombre visible principal será el canónico.

### Regla de deduplicación en catálogo base
- Fusionar por nombre normalizado cuando represente el mismo ejercicio.
- Mantener entradas separadas cuando existan variantes reales (por ejemplo, distinto equipo o tipo de métrica).
- El resultado debe evitar duplicados visuales obvios en el directorio.

### Migración de datos existentes
- Aplicar remap automático hacia IDs canónicos para datos ya existentes (rutinas, historial, planificación y referencias relacionadas).
- Registrar conflictos de migración para auditoría.
- Priorizar continuidad sin pérdida silenciosa de datos.

### Ejercicios personalizados
- Los ejercicios personalizados **no** se fusionan automáticamente con el catálogo base.
- Se preservan como entidades separadas del usuario.

### Claude's Discretion
- Estrategia exacta de normalización (ruleset, heurísticas y score de match) mientras respete las decisiones de negocio cerradas.
- Formato técnico del log de conflictos y superficie mínima de visibilidad en UI.
- Nivel de limpieza por lotes vs incremental siempre que no rompa datos existentes.

</decisions>

<specifics>
## Specific Ideas

- Problema principal reportado: catálogo con duplicados por idioma, variaciones leves de nombre y metadatos inconsistentes de músculo/equipo.
- Objetivo de producto: catálogo "profesional", limpio y estable para uso diario, evitando ruido al seleccionar ejercicios.

</specifics>

<deferred>
## Deferred Ideas

- Curación manual completa de toda taxonomía muscular avanzada.
- Localización multi-idioma en UI (mostrar nombre por idioma del usuario).
- Resolución asistida por IA para matching semántico complejo.

</deferred>

---

*Phase: 16-normalizacion-catalogo-ejercicios*
*Context gathered: 2026-03-05*
