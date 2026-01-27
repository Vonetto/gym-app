# Phase 2: Rutinas + Catálogo de Ejercicios - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Plantillas de entrenamiento y catálogo editable listos para usarse. Incluye creación/edición de rutinas, ejercicios personalizados y búsqueda/selección de ejercicios.

</domain>

<decisions>
## Implementation Decisions

### Modelo de Rutina
- Campos obligatorios: nombre, ejercicios, duración estimada.
- La duración real se mide desde “Comenzar entrenamiento” hasta “Finalizar entrenamiento”.
- Orden default guardado, pero reordenable en sesión.
- Valores por ejercicio: vacíos la primera vez; luego pre‑relleno con últimos valores (sets/reps/peso/descanso). Progresión se integra más adelante.
- Rutinas con días/etiquetas.

### Ejercicios personalizados
- Obligatorios: nombre, músculos principales/secundarios, equipamiento, tipo de métrica.
- Opcionales: notas/variantes (y otros campos no críticos).
- Nombre único (sin duplicados).
- Ediciones afectan solo a sesiones futuras, no al historial.

### Búsqueda/selección de ejercicios
- Mostrar recientes y favoritos.
- Filtros por músculo y equipamiento en V1.
- Orden alfabético.
- Crear ejercicio nuevo desde el mismo buscador.

### Duplicar/editar rutinas
- Duplicar copia estructura y últimos valores.
- Edición de rutina no afecta historial pasado.
- Mantener historial de cambios/versionado de rutinas.
- Permitir “guardar sesión como nueva rutina” con nombre sugerido.

### Claude's Discretion
- UX exacta de filtros y favoritos (chips, tabs, etc.).
- Representación visual del historial de cambios (lista simple vs. snapshots).

</decisions>

<specifics>
## Specific Ideas

- UX móvil y flujo inspirado en Hevy; paridad documentada en `.planning/UX_PARITY.md`.

</specifics>

<deferred>
## Deferred Ideas

- Integración de progresión automática (Phase 4).
- Calorías quemadas por ejercicio/entreno (V4).
- Duración real del entrenamiento se valida en Phase 3 (sesión en vivo).

</deferred>

---

*Phase: 02-rutinas-catalogo-ejercicios*
*Context gathered: 2026-01-27*
