# Phase 12 Context — Calendario + Planificación

**Date:** 2026-03-04
**Status:** Discussed

## Objective

Convertir el calendario actual en una herramienta de planificación real para rutinas futuras, manteniendo el histórico ya existente y preparando el terreno para recordatorios/notificaciones más adelante.

## Decisions

### 1) Qué se puede planificar

- Solo se pueden planificar `rutinas existentes` en V1.
- Cada plan guarda una `referencia a la rutina`, no una copia congelada.
- No hay renombre manual del evento planificado en V1.
- Puede haber `más de un plan` el mismo día.

### 2) Recurrencia

- Tipos de recurrencia V1:
  - `una vez`
  - `semanal`
  - `días específicos de la semana`
- La recurrencia puede tener `fecha de fin opcional`.
- También puede ser `sin fin`.
- Si se edita una recurrencia, el cambio aplica a `toda la serie`.

### 3) Relación plan → workout real

- Tocar un evento planificado abre un detalle con CTA `Empezar rutina`.
- El copy esperado puede ser del estilo: `Hoy te toca X entrenamiento`.
- Si el usuario completa la rutina desde ese flujo, el plan queda `completado`.
- Si el usuario entrena otra cosa, el plan sigue `pendiente`, pero se puede marcar como `omitido`.
- Estados explícitos V1:
  - `pendiente`
  - `completado`
  - `omitido`

### 4) UX del calendario

- Diferenciación visual:
  - entrenos realizados = `punto azul sólido`
  - planes pendientes = `aro / outline`
  - completado planificado = `punto + check` o color distinto
  - omitido = `gris tenue`
- Si un día tiene planes y entrenos realizados, se muestran juntos en una misma vista, agrupados por:
  - `Planificados`
  - `Realizados`
- Crear plan:
  - CTA principal `Planificar rutina`
  - luego elegir `rutina + fecha + recurrencia + fecha fin opcional` en modal/bottom sheet
- Origen del flujo:
  - principal: `Calendar`
  - secundario: atajo `Programar esta rutina` desde `RoutineDetail`
- Importante:
  - no se mezcla la recurrencia dentro del editor de rutina
  - `Rutina` sigue siendo plantilla reusable
  - `Planificación` es un evento/serie que referencia una rutina

## Constraints

- Mantener el flujo local-first y compatible con la base actual.
- No introducir aún notificaciones reales; solo preparar una UX/modelo que luego las soporte bien.
- Evitar mezclar el modelo de rutina con el modelo de agenda.

## Open Questions for Research

- Modelo de datos mínimo para ocurrencias únicas vs series recurrentes.
- Qué conviene persistir localmente para expandir recurrencias sin complejidad excesiva.
- Cómo representar en UI los estados `pendiente/completado/omitido` sin ensuciar el calendario.
- Qué parte del modelo debe quedar lista para sync futuro desde el día 1 de implementación.
