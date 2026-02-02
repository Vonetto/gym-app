# Phase 3: Ejercicios (Directorio + Detalle) - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Construir el directorio de ejercicios (A‑Z, por músculo y por equipo) y el detalle de ejercicio con historial, 1RM y tips. Los tips se obtienen vía wrkout.xyz (texto) y los videos quedan fuera de alcance (futuro).

</domain>

<decisions>
## Implementation Decisions

### Entrada y navegación
- El directorio debe estar accesible desde el tab “Ejercicios” y también desde el card “Ejercicios” en Perfil.
- El detalle se abre con tap en un item del directorio y es una pantalla dedicada (no modal).

### Directorio (A‑Z / Músculo / Equipo)
- Se usan **tabs** para alternar entre A‑Z, Músculo y Equipo.
- A‑Z se muestra por **secciones de letra** (sin índice lateral).
- Músculo/Equipo: **chips arriba** + lista filtrada abajo.
- Item de lista: **nombre + músculo principal + equipo**.

### Detalle de ejercicio
- Historial: **lista cronológica de sets por sesión**.
- 1RM: **mostrar solo el mejor histórico**. Si no hay 1RM, mostrar el mayor peso levantado (independiente de reps).
- Tips: **texto corto + bullets**.

### wrkout.xyz (tips)
- Matching: usar **normalización/fuzzy** (no exact match); revisar nombres y normalizar.
- Si hay múltiples matches: usar el **primer match**.
- Cache local con refresco cada **180 días**.
- Si no hay tips: mostrar **“Sin tips disponibles”**.

### Claude's Discretion
- Layout exacto del listado y espaciados.
- Mensajes de empty state por tab.
- Detalles visuales del historial (agrupación y encabezados).

</decisions>

<specifics>
## Specific Ideas

- Tabs A‑Z / Músculo / Equipo como navegación principal del directorio.
- Chips para filtros de músculo/equipo.
- Tips como texto breve + bullets; videos quedan para futuro.

</specifics>

<deferred>
## Deferred Ideas

- Videos de ejercicios (fase futura).
- Selección manual cuando hay múltiples matches (por ahora primer match).

</deferred>

---

*Phase: 03-ejercicios-directorio*
*Context gathered: 2026-02-02*
