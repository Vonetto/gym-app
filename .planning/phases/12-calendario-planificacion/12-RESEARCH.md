# Phase 12 Research — Calendario + Planificación

**Date:** 2026-03-04
**Status:** Researched

## Objective

Definir un modelo mínimo, consistente y sync-ready para planificar rutinas futuras desde el calendario, con recurrencia simple y estados por ocurrencia, sin romper el histórico actual ni el enfoque local-first.

## Current State

### UI actual

- `src/pages/Calendar.tsx` solo renderiza histórico de workouts por día.
- El calendario ya tiene detalle por día y modal/revisión de workouts realizados.
- La pantalla muestra un placeholder para planificación futura, pero no existe flujo de creación ni entidades de agenda.

### Datos locales actuales

- `src/data/db.ts` no tiene tablas de planificación.
- La app ya persiste:
  - `routines`
  - `exerciseDefaults`
  - `workouts`
  - `syncState`
- Las rutinas ya son suficientemente ricas como para ser la unidad referenciada por una agenda futura.

### Sync actual

- `src/data/sync.ts` ya replica entidades de usuario con patrón:
  - fila compacta por agregado
  - `updated_at`
  - `deleted_at`
  - estrategia LWW/tombstones
- No existe todavía sync de agenda.

## Research Findings

### 1) Tratar la planificación como fechas locales, no como datetimes UTC

- El producto está modelando “qué rutina toca tal día”, no una cita con hora exacta.
- Para ese caso, guardar `YYYY-MM-DD` local evita drift por zona horaria y cambios DST al navegar entre dispositivos.
- Esto es coherente con RFC 5545, que distingue `DATE` de `DATE-TIME`; `DATE` representa una fecha de calendario sin hora del día. También indica que un `DTSTART` desalineado con la regla de recurrencia deja el conjunto resultante indefinido. Fuente: RFC 5545, secciones 3.3.4 y 3.8.5.3. https://datatracker.ietf.org/doc/html/rfc5545

**Decisión recomendada**
- Guardar las fechas planificadas como strings locales `YYYY-MM-DD`.
- No introducir `Date.toISOString()` como fuente de verdad para ocurrencias futuras.

### 2) No materializar series infinitas

- El scope V1 solo necesita:
  - una vez
  - semanal
  - días específicos de la semana
- Materializar miles de ocurrencias futuras complica:
  - storage local
  - sync
  - edición de series
  - borrado
- RFC 5545 permite recurrencias sin fin cuando no existe `COUNT` ni `UNTIL`. Eso refuerza que el modelo debe soportar series abiertas sin expandirlas completas. Fuente: RFC 5545 sección 3.3.10. https://datatracker.ietf.org/doc/html/rfc5545

**Decisión recomendada**
- Persistir la definición de la serie.
- Expandir ocurrencias solo para el rango visible del calendario o el día seleccionado.

### 3) Separar serie y estado por ocurrencia

El usuario pidió:
- editar la recurrencia completa, no ocurrencias individuales
- marcar días concretos como `pendiente`, `completado` u `omitido`

Eso pide dos capas:

1. **Serie planificada**
   - define patrón
   - referencia rutina
   - vive estable en el tiempo

2. **Estado/override por ocurrencia**
   - captura qué pasó en un día concreto
   - permite marcar omitido
   - permite enlazar el workout real que completó el plan

**Decisión recomendada**
- Modelo de dos entidades:
  - `plannedWorkoutSeries`
  - `plannedWorkoutOccurrences`

### 4) No usar RRULE genérico ni dependencia externa en V1

- El scope V1 es demasiado acotado para justificar un motor RRULE completo.
- La app no necesita interoperabilidad ICS todavía.
- Una estructura propia para:
  - `once`
  - `weekly`
  - `weekdays`
  cubre el caso sin nueva dependencia.

**Decisión recomendada**
- No agregar `rrule` en esta fase.
- Implementar expansión con helpers propios y deterministas.

### 5) El calendario debe combinar agenda e histórico sin mezclar sus fuentes

- `workouts` realizados ya son el histórico.
- Los planes futuros no deben escribirse como pseudo-workouts.
- Al tocar un día, la UI debe agrupar:
  - `Planificados`
  - `Realizados`

**Decisión recomendada**
- El calendario compone dos fuentes:
  - workouts reales
  - ocurrencias expandidas para el rango visible

## Recommended Data Model

### Local Dexie

Agregar una nueva versión de DB con dos tablas.

#### `PlannedWorkoutSeriesRecord`

- `id: string`
- `routineId: string`
- `kind: 'once' | 'weekly' | 'weekdays'`
- `startDate: string` (`YYYY-MM-DD`)
- `weekdays?: number[]` (`1-7`, lunes-domingo o `0-6`, pero consistente en toda la app)
- `endDate?: string`
- `createdAt: string`
- `updatedAt: string`
- `deletedAt?: string`

#### `PlannedWorkoutOccurrenceRecord`

- `id: string` (`${seriesId}:${date}`)
- `seriesId: string`
- `occurrenceDate: string` (`YYYY-MM-DD`)
- `status: 'pending' | 'completed' | 'omitted'`
- `workoutId?: string`
- `createdAt: string`
- `updatedAt: string`
- `deletedAt?: string`

## Why this model fits the product

- Una planificación única es solo una serie con `kind = 'once'`.
- Una serie recurrente queda compacta.
- `completed` y `omitted` se guardan por fecha concreta, no mutando la regla base.
- Permite enlazar un workout real al plan completado sin duplicar datos.
- Mantiene abierta la puerta a notificaciones futuras por ocurrencia.

## Recommended Expansion Strategy

### Range expansion

Implementar un helper del tipo:

- `expandPlannedOccurrences(series[], occurrenceStates[], rangeStart, rangeEnd)`

Responsabilidad:
- producir las ocurrencias visibles del mes o del día seleccionado
- mezclar la regla base con el override de estado por fecha
- ignorar series borradas y ocurrencias borradas

### Reglas mínimas

- `once`
  - solo existe en `startDate`
- `weekly`
  - repite cada 7 días desde `startDate`
- `weekdays`
  - usa `weekdays[]` y solo genera fechas dentro de ese set
- `endDate`
  - corta inclusivamente
- sin `endDate`
  - la serie sigue abierta

## Workout Link Semantics

- Completar un workout desde el detalle del plan debe:
  - iniciar la rutina referenciada
  - al finalizar, crear/actualizar `plannedWorkoutOccurrence.status = 'completed'`
  - guardar `workoutId`
- Hacer un workout no planificado ese día:
  - no completa automáticamente ningún plan pendiente
- Omitir un plan:
  - crea/actualiza la ocurrencia con `status = 'omitted'`

## Sync Strategy

La fase actual ya usa LWW/tombstones. Conviene mantener la misma convención.

### Nuevas tablas cloud recomendadas

- `user_schedule_series`
- `user_schedule_occurrences`

Campos esperados:
- `user_id`
- `id`
- `updated_at`
- `deleted_at`
- payload estructurado equivalente al modelo local

### Regla de sync

- Sync de series:
  - igual que rutinas/workouts: snapshot paginado + LWW
- Sync de ocurrencias:
  - igual patrón, pero por fecha concreta
- No sincronizar ocurrencias “virtuales” expandidas.
- Solo sincronizar:
  - definición de serie
  - estados explícitos por ocurrencia

## Visual Model Implications

El calendario debe derivar los adornos del día desde dos datasets:

- `workoutsByDate`
- `plannedOccurrencesByDate`

Semántica visual acordada:
- realizado = punto azul sólido
- pendiente = aro/outline
- completado planificado = variante con check/color distinto
- omitido = gris tenue

Si un día tiene varios estados, el resumen del day-cell debe priorizar:
1. completado planificado
2. realizado
3. pendiente
4. omitido

Y al abrir el día:
- lista agrupada en `Planificados` y `Realizados`

## Risks

1. **Zona horaria**
   - si se mezcla `Date` JS con `toISOString()` al calcular celdas, pueden correrse fechas.
   - Mitigación: helpers centrados en `YYYY-MM-DD`.

2. **Series infinitas**
   - si se expanden sin rango, el calendario se degrada rápido.
   - Mitigación: expansión solo para el mes visible.

3. **Rutina borrada**
   - una serie puede apuntar a una rutina eliminada.
   - Mitigación recomendada: mantener la serie pero marcarla como inválida/no iniciable hasta resolver.

4. **Auto-completado ambiguo**
   - vincular automáticamente cualquier workout del día a un plan puede producir falsos positivos.
   - Mitigación: solo completar automáticamente cuando el entreno se inicia desde el detalle del plan.

## Conclusion

La implementación V1 debe:

- usar fechas locales `YYYY-MM-DD`
- separar serie y estado por ocurrencia
- expandir recurrencias solo para el rango visible
- mantener agenda y workouts como fuentes distintas
- sincronizar solo entidades persistidas, no ocurrencias virtuales

Esto deja una base correcta para:
- recordatorios futuros
- sync cloud
- notificaciones nativas
- planificación recurrente más rica sin rehacer el modelo

## Sources

- RFC 5545 — iCalendar (DATE, RECUR, recurrence set semantics): https://datatracker.ietf.org/doc/html/rfc5545
