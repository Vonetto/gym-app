# Phase 11: Sets Avanzados - Context

**Gathered:** 2026-03-03
**Status:** Ready for research

<domain>
## Phase Boundary

Agregar soporte de sets avanzados dentro del flujo actual de workout sin romper historial, PRs, progresión, sync ni export/import.

Incluye:
- tipos de set `Normal`, `Warm-up`, `Drop`, `Fallo`, `AMRAP`
- marcado rápido desde la sesión activa
- persistencia del tipo en rutina, workout, historial, sync e import/export
- reglas claras de qué cuenta para volumen, PRs y progresión

No incluye:
- nuevos tipos fuera de esos cinco
- relaciones estructurales complejas entre sets (por ejemplo, ligar un `Drop` al set anterior como entidad compuesta)
- nuevas métricas fisiológicas o de fatiga

</domain>

<decisions>
## Implementation Decisions

### Semántica de tipos
- `Normal`: set estándar; muestra el número de serie
- `Warm-up`: set preparatorio registrado explícitamente como tal
- `Drop`: set normal con una marca especial, sin relación estructural obligatoria con el set anterior en V1
- `Fallo`: indica que el set se hizo al fallo; no cambia la métrica registrada
- `AMRAP`: indica “tantas reps como sea posible”; mantiene los valores reales que el usuario registre

### UX de marcado
- El tipo se cambia tocando el identificador del set en la primera columna
- Ese tap abre un menú / bottom sheet estilo Hevy
- Opciones disponibles en el menú:
  - `Serie Normal`
  - `Serie de Calentamiento`
  - `Serie Drop`
  - `Serie Fallada`
  - `Serie AMRAP`
  - `Eliminar Serie`
- El badge reemplaza el número del set; no lo acompaña
- Colores fijos:
  - `Warm-up`: amarillo
  - `Drop`: azul
  - `Fallo`: rojo
  - `AMRAP`: naranja
  - `Normal`: neutro con número

### Reglas analíticas
- `Warm-up`
  - cuenta para volumen: **sí**
  - cuenta para PRs: **no**
  - cuenta para progresión: **no**
- `Drop`
  - cuenta para volumen: **sí**
  - cuenta para PRs: **no**
  - cuenta para progresión: **no**
- `Fallo`
  - cuenta para volumen: **sí**
  - cuenta para PRs: **sí**
  - cuenta para progresión: **sí**
- `AMRAP`
  - cuenta para volumen: **sí**
  - cuenta para PRs: **sí**
  - cuenta para progresión: **sí**

### Rutinas, historial y persistencia
- Las rutinas pueden llevar tipos de set predefinidos
- El historial y la revisión de workouts deben mostrar los badges igual que la sesión activa
- Sync e import/export deben conservar el tipo exacto de cada set
- Duplicar una rutina debe copiar también los tipos predefinidos

### Claude's Discretion
- Diseño exacto del menú/bottom sheet y del badge para que sea claro en móvil sin ensanchar la tabla
- Qué copy usar en historial y revisión para explicar el tipo sin sobrecargar la UI
- Si volumen analítico debe mostrarse agregado o segmentado por tipo en futuras vistas, sin cambiar las reglas base fijadas aquí

</decisions>

<specifics>
## Specific Ideas

- Mantener la primera columna como superficie única de interacción para marcar tipo de set
- Persistir el tipo a nivel de set, no solo a nivel de ejercicio, para que rutinas y workouts mezclen tipos libremente
- Hacer que la progresión y los PRs filtren por tipo permitido en vez de duplicar la lógica por pantalla

</specifics>

<deferred>
## Deferred Ideas

- Relacionar `Drop` con el set inmediatamente anterior como una entidad compuesta
- Nuevos tipos de set adicionales
- Analíticas avanzadas separadas por tipo de set
- Reglas especiales de descanso automáticas por tipo de set

</deferred>

---

*Phase: 11-sets-avanzados*
*Context gathered: 2026-03-03*
