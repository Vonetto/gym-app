# Phase 16 Research - Normalización del Catálogo de Ejercicios

**Date:** 2026-03-05  
**Status:** Researched

## Objective

Definir una estrategia segura y ejecutable para:

1. unificar nombres (canónico ES + aliases),
2. fusionar duplicados reales de catálogo base,
3. conservar variantes válidas por equipo/tipo de métrica,
4. remapear automáticamente referencias históricas a IDs canónicos sin pérdida de datos.

## Current State

### Modelo y lookup actual

- Catálogo base en `src/data/wgerExerciseSeed.json` (807 ejercicios).
- Persistencia local en Dexie (`db.exercises` + `db.exerciseTranslations`).
- Búsqueda actual (`listExercises`) usa `normalizedName` del `baseName`; no indexa aliases/traducciones.
- Nombre visible en UI se resuelve con `getExerciseDisplayName()` (es -> en fallback).

### Hallazgos de calidad de catálogo (muestreo local)

Resultados de inspección sobre `wgerExerciseSeed.json`:

- Total: **807**
- Métricas: `weight_reps` **766**, `time` **41**
- Idiomas presentes en traducciones: 22
- Ejercicios sin `equipment`: **285**
- Duplicados por nombre ES normalizado: **19 grupos**
- Duplicados estrictos (`nombre ES + equipo + métrica`): **13 grupos**
- Colisiones de mismo nombre con variantes reales (equipo/tipo distinto): **5 grupos**

Ejemplos reportados por producto:
- `"Abdominales"` duplicado en variantes inconsistentes.
- `"Press de pecho con máquina"` vs `"Press de Pecho en Máquina"` (misma familia, naming distinto).

### Superficie de impacto por `exerciseId`

El `exerciseId` se usa en múltiples dominios, no solo en catálogo:

- Rutinas: `routineExercises`, `exerciseDefaults`
- Historial: `workoutExercises`
- Preferencias: `exerciseFavorites`, `exerciseRecents`
- Tips: `wrkoutTips`
- Sync cloud: serialización y aplicación remota de rutinas/workouts/favoritos
- Import/export: backup total y rutina individual

Conclusión: normalizar IDs solo en catálogo **no alcanza**; debe incluir remap transversal.

## Research Findings

### 1) Se necesita un modelo canónico + alias explícito

Con la estructura actual (solo `baseName` + traducciones), no hay capa formal para:
- distinguir canónico vs alias,
- mapear IDs legacy,
- resolver búsqueda multilenguaje de forma estable.

Dirección:
- mantener `exercise.id` como ID canónico final,
- introducir mapping de aliases (incluyendo IDs legacy) hacia ese canónico.

### 2) La deduplicación debe ser determinística por familia + variante

Para cumplir la decisión 2A:
- **Familia**: nombre normalizado (ES canónico).
- **Variante válida**: combinación mínima de `metricType` + `equipment` normalizado.

Regla:
- misma familia + misma variante -> fusionar.
- misma familia + variante distinta -> conservar separado.

### 3) La migración debe ser one-shot, idempotente y transaccional

Dado el uso extendido de `exerciseId`, la migración debe:
- correr una sola vez por versión de normalización,
- usar transacción Dexie para evitar estados parciales,
- registrar remaps aplicados y conflictos.

Idempotencia sugerida:
- guardar marca `syncState` tipo `catalog-normalization-v1`.

### 4) Sync e import/export deben normalizar en frontera

Si se remapea solo en local, IDs antiguos pueden reaparecer desde cloud/backup.

Puntos obligatorios de normalización:
- `serializeRoutines`, `serializeWorkouts`, `serializeFavorites`
- `applyRemoteRoutines`, `applyRemoteWorkouts`, `applyRemoteFavorites`
- importadores de backup (`fullBackup`, `routineBackup`) antes de escribir.

### 5) Los personalizados deben quedar fuera de auto-fusión

Alineado con decisión 4A:
- `source: custom` no entra a merge automático.
- solo se conserva naming guardado por usuario y reglas actuales de duplicado custom.

## Standard Stack

Mantener stack actual, agregando capa de normalización de dominio (sin dependencias pesadas):

1. **Dexie** (migración + transacciones).
2. **Artefactos estáticos versionados**:
   - `catalogCanonicalMap` (`legacyId -> canonicalId`)
   - `catalogAliasIndex` (aliases por ejercicio canónico)
   - `catalogNormalizationOverrides` (casos manuales controlados)
3. **Helpers dedicados**:
   - `resolveCanonicalExerciseId(id)`
   - `buildFamilyKey(nameEs)`
   - `buildVariantKey(metricType, equipment[])`
4. **Tests Vitest** para remap transversal y no-regresión.

## Architecture Patterns

### Pattern A - Canonical-first + alias index

- Mantener un único registro “dueño” por ejercicio canónico.
- Aliases y legacy IDs se resuelven por tabla/helper, no por heurística en runtime UI.

### Pattern B - Boundary remap

- Toda entrada/salida que lea/escriba `exerciseId` pasa por `resolveCanonicalExerciseId`.
- Esto evita “recontaminar” catálogo desde sync/backup.

### Pattern C - Migración transversal por lotes

Dentro de una sola transacción:
- actualizar referencias en `routineExercises`, `exerciseDefaults`, `workoutExercises`, `favorites`, `recents`, `wrkoutTips`,
- deduplicar colisiones resultantes (ej. favoritos duplicados),
- limpiar ejercicios legacy fusionados y traducciones redundantes.

### Pattern D - Merge policy explícita

Para grupos fusionables:
- elegir canónico determinísticamente (prioridad override manual > calidad ES > estabilidad ID),
- todo lo demás va a alias legacy.

## Don't Hand-Roll

1. No hacer dedupe “en vivo” en componentes de UI.
2. No depender de fuzzy matching no determinístico para reglas finales de merge.
3. No borrar IDs legacy sin remap previo de referencias.
4. No aplicar normalización solo en seed inicial (debe cubrir bases ya existentes).
5. No mezclar personalizados con base wger en auto-fusión.

## Common Pitfalls

1. **Referencias huérfanas** en rutinas/workouts tras fusión de IDs.
2. **Reintroducción de IDs viejos** desde cloud por falta de remap en sync.
3. **Colisiones secundarias** (`favorites/recents/tips`) al converger varios IDs en uno.
4. **Inconsistencia de búsqueda** si aliases existen pero no se indexan.
5. **Migración no idempotente** que vuelve a tocar datos en cada arranque.

## Code Examples (target patterns)

### 1) Resolución canónica

```ts
export function resolveCanonicalExerciseId(exerciseId: string): string {
  return catalogCanonicalMap[exerciseId] ?? exerciseId;
}
```

### 2) Remap defensivo al persistir referencias

```ts
const canonicalId = resolveCanonicalExerciseId(entry.exerciseId);
await db.routineExercises.put({ ...entry, exerciseId: canonicalId });
```

### 3) Búsqueda con aliases

```ts
// query normalizada -> ids canónicos candidatos
const candidateIds = aliasIndex.search(normalizedQuery);
const exercises = await db.exercises.where('id').anyOf(candidateIds).toArray();
```

## Recommended Plan Inputs (for phase 16 planning)

1. Generar artefactos de normalización (`legacy -> canonical`, aliases, overrides).
2. Implementar helper único `resolveCanonicalExerciseId`.
3. Agregar migración Dexie v8 transaccional + marca de idempotencia.
4. Aplicar remap en sync, backup total y backup de rutina.
5. Adaptar búsqueda/listado para aliases manteniendo nombre visible canónico ES.
6. Agregar tests de remap transversal (rutinas/workouts/favoritos/recientes/sync/import).
7. QA manual focalizado en catálogo, creación de rutina y detalle de ejercicio.

## Confidence

- **Alta** en dirección arquitectónica (canónico + alias + remap transversal).
- **Media** en esfuerzo exacto de limpieza semántica fina (requiere overrides manuales para casos ambiguos).

---
