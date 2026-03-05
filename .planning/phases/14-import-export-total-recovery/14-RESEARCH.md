# Phase 14 Research — Import/Export Total + Recovery

**Date:** 2026-03-05
**Status:** Researched

## Objective

Definir una arquitectura de backup/restore total que sea portable, versionada y segura, separada del flujo existente de rutina individual, con import atómico y resolución de conflictos predecible (`Fusionar` / `Reemplazar`).

## Current State

### Flujo actual de backup

- Existe solo import/export de rutina individual en `Ajustes` (`src/pages/Settings.tsx`), soportado por `src/data/routineBackup.ts`.
- Ese flujo exporta un payload acotado (rutina + defaults + ejercicios custom relacionados) y actualmente usa `version: 4`.
- No existe backup total de cuenta local (rutinas + workouts + calendario + ajustes + favoritos/recientes).

### Persistencia local actual

La app usa Dexie con tablas principales en `src/data/db.ts`:

- `settings`
- `routines`, `routineTags`, `routineExercises`, `exerciseDefaults`, `routineVersions`
- `exercises`, `exerciseTranslations`, `exerciseFavorites`, `exerciseRecents`
- `workouts`, `workoutExercises`, `workoutSets`
- `plannedWorkoutSeries`, `plannedWorkoutOccurrences`
- `syncState`, `wrkoutTips` (metadatos/auxiliares)

### Restricciones ya acordadas (discuss)

- El backup total debe vivir en `Ajustes > Datos`, separado de “Importar/Exportar rutina”.
- Excluir sesión activa en curso (`localStorage: active-session`) y suscripciones push del dispositivo.
- Siempre mostrar elección `Fusionar` vs `Reemplazar` al importar.
- Import inválido debe fallar completo, sin escritura parcial.
- Antes de importar: crear auto-backup local de seguridad.

## Research Findings

### 1) El import debe ser transaccional y atómico en IndexedDB

- IndexedDB maneja commit/abort por transacción y aborta todo ante error.
- Dexie recomienda encapsular operaciones relacionadas en una sola `db.transaction(...)` para conservar atomicidad.

Fuentes:
- MDN `IDBTransaction` — atomicidad y `abort()`: https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction
- Dexie `transaction()`: https://dexie.org/docs/Dexie/Dexie.transaction%28%29

**Dirección de producto**
- Todo `restore` (merge o replace) debe ejecutarse dentro de una única transacción de Dexie sobre todas las tablas afectadas.
- Si falla validación o integridad, `throw` y rollback total.

### 2) La lectura de archivo JSON requiere validación temprana y límites explícitos

- APIs de lectura (`File.text()`, `FileReader.readAsText`) cargan el contenido completo en memoria.
- Para móviles, esto obliga a validar tamaño y estructura antes de iniciar escrituras.

Fuentes:
- MDN `Blob.text()`: https://developer.mozilla.org/en-US/docs/Web/API/Blob/text
- MDN `FileReader.readAsText()` (nota sobre carga completa en memoria): https://developer.mozilla.org/en-US/docs/Web/API/FileReader/readAsText

**Dirección de producto**
- En paso 1 (seleccionar archivo), validar:
  - tipo (`application/json` o extensión `.json`)
  - tamaño máximo configurable (ej. 10-20 MB para V1)
- Luego parsear y validar estructura antes de mostrar preview.

### 3) Schema versioning debe ser explícito y migrable por pasos

- El backup debe tener `schemaVersion` obligatorio y tipo de payload (`backupType`), para distinguirlo del export de rutina.
- Migraciones seguras deben ser funciones puras por versión (`v1 -> v2 -> ...`) y ejecutarse antes de aplicar merge/replace.

Fuente:
- JSON Schema (concepto de validación estructural/versionado): https://json-schema.org/

**Dirección de producto**
- Definir `schemaVersion` inicial para backup total (independiente de `version` de rutina individual).
- Rechazar versiones futuras no soportadas con mensaje explícito.

### 4) LWW + tombstones es consistente con el motor de sync actual

- El proyecto ya usa estrategia LWW por `updatedAt` y `deletedAt` en sync cloud (`src/data/sync.ts`).
- Reusar la misma regla reduce sorpresas entre “import local” y “sync cloud”.

**Dirección de producto (inferencia del repo)**
- `Fusionar` debe reutilizar semántica existente:
  - `latestTs = max(updatedAt, deletedAt)`
  - gana timestamp más nuevo
  - borrado más nuevo gana
- Para entidades sin `updatedAt` fuerte (ej. settings global), agregar timestamp explícito de registro para merge confiable.

### 5) Auto-backup local es útil, pero no reemplaza export manual

- IndexedDB está sujeto a cuotas/evicción según navegador/dispositivo.
- Auto-backups locales son capa de seguridad inmediata, no respaldo definitivo.

Fuente:
- MDN Storage quotas & eviction: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria

**Dirección de producto**
- Crear auto-backup previo al import y retener N copias recientes (ej. 3).
- Mantener CTA de export manual para respaldo externo portable.

### 6) No conviene usar import/export de DB completo “raw” para este caso

- `dexie-export-import` es útil para clon completo, pero aquí necesitamos:
  - preview semántica por conteos
  - modos `fusionar/reemplazar`
  - reglas de colisión por nombre
  - validación de integridad de dominio

Fuente:
- Dexie export/import add-on: https://dexie.org/docs/ExportImport/dexie-export-import

**Dirección de producto**
- Implementar backup total de dominio (payload controlado), no dump raw de IndexedDB.

## Recommended Backup Scope

### Incluir

- Ajustes de app (`settings`, incluyendo preferencias de notificación de producto).
- Ejercicios custom + traducciones.
- Favoritos y recientes.
- Rutinas + tags + ejercicios + defaults.
- Historial de entrenamientos (`workouts` + `workoutExercises` + `workoutSets`).
- Planificación (`plannedWorkoutSeries` + `plannedWorkoutOccurrences`).

### Excluir

- Sesión activa (`active-session` en localStorage).
- Suscripciones push del dispositivo (estado de navegador/OS).
- Cache de PWA/service worker.
- Metadatos operativos (`syncState`) y cache efímera (`wrkoutTips`).

## Recommended Payload Shape (V1)

```json
{
  "backupType": "gym-app-full",
  "schemaVersion": 1,
  "exportedAt": "2026-03-05T15:20:00.000Z",
  "appBuild": "web-<optional>",
  "data": {
    "settings": { "...": "..." },
    "customExercises": [],
    "exerciseFavorites": [],
    "exerciseRecents": [],
    "routines": [],
    "workouts": [],
    "plannedWorkoutSeries": [],
    "plannedWorkoutOccurrences": []
  }
}
```

Notas:
- Mantener `id`, `updatedAt` y `deletedAt` cuando existan.
- No mezclar este payload con `RoutineBackupPayload`.

## Conflict Model (Import)

### `Fusionar`

- Resolver por entidad y `id` con LWW + tombstones.
- Si llega un registro eliminado con timestamp más nuevo, se respeta borrado.
- Colisión de nombre con distinto `id`:
  - mantener coexistencia y renombrar importado con sufijo incremental (`Nombre (2)`, `Nombre (3)`).
- Entidades hijas de agregados (ej. rutina + defaults) se tratan como “registro completo” del agregado cuando gane remoto/local.

### `Reemplazar`

- Limpiar todos los datos funcionales locales y restaurar desde backup.
- Preservar/resembrar catálogo base no custom (wger) para no perder ejercicios por defecto.
- Exigir confirmación fuerte (`REEMPLAZAR`).

## Validation Strategy

Orden recomendado:

1. **Formato:** JSON parseable.
2. **Envelope:** `backupType` + `schemaVersion` + `data`.
3. **Schema/enum:** tipos y valores válidos.
4. **Integridad referencial mínima:**
   - ejercicios de rutina apuntan a ejercicio existente o custom presente en backup.
   - workout sets apuntan a workoutExercise existente.
   - occurrences apuntan a `seriesId` existente (o tombstone más nuevo).
5. **Preview:** conteos por sección y estimación de cambios antes de confirmar.

Si falla cualquier paso:
- no escribir nada
- mostrar error específico (`Archivo corrupto`, `Archivo incompleto`, `Versión no soportada`).

## UX Flow (Ajustes > Datos)

1. **Exportar backup total**
   - botón único “Exportar backup total”.
   - descarga `.json` con timestamp.

2. **Importar backup total**
   - Paso 1: seleccionar archivo.
   - Paso 2: preview + selector `Fusionar` / `Reemplazar`.
   - Paso 3: confirmación final (en reemplazo, input `REEMPLAZAR`).

3. **Resultado**
   - toast corto + panel expandible con conteos:
     - importados
     - fusionados
     - omitidos
     - renombrados
   - link rápido para exportar auto-backup previo si existe.

## Implementation Pattern (suggested)

### Módulos

- `src/data/fullBackup.ts`
  - `exportFullBackup()`
  - `validateFullBackup()`
  - `importFullBackup(payload, mode)`
  - `previewFullBackup(payload)`
  - `createPreImportAutoBackup()`

- `src/data/fullBackupMigrations.ts`
  - registry de migraciones por `schemaVersion`

- `src/data/backupNaming.ts`
  - util de sufijos ` (2)`, ` (3)`

### Ajustes UI

- Extender `src/pages/Settings.tsx` en card `Datos` con:
  - bloque de rutina individual (existente)
  - bloque de backup total (nuevo)

## Don’t Hand-Roll

1. No mezclar backup total y rutina individual en el mismo parser.
2. No escribir por secciones fuera de transacción (evita estados parciales).
3. No aplicar merge “a ciegas” sin preview y sin validar integridad.
4. No confiar en `name` como identificador primario (usar `id`; nombre solo para UX/renombrado).
5. No usar `syncState` o cachés efímeras como fuente de verdad restaurable.

## Common Pitfalls

1. **Settings sin timestamp global de merge**
   - Riesgo: decisiones no deterministas al fusionar.
   - Mitigación: agregar `updatedAt`/`settingsUpdatedAt`.

2. **Referencias huérfanas tras merge**
   - Riesgo: rutinas o workouts apuntando a ejercicios inexistentes.
   - Mitigación: validar referencias antes de commit.

3. **Replace que borra catálogo base**
   - Riesgo: app queda sin ejercicios default.
   - Mitigación: re-seed wger tras limpieza o excluir base de limpieza.

4. **Archivo grande en móvil**
   - Riesgo: memory pressure o UX lenta.
   - Mitigación: límite de tamaño + feedback de progreso + parse previo a transacción.

## Confidence Levels

- **High:** Import atómico con Dexie/IndexedDB para evitar corrupción parcial.
- **High:** Separar payload total vs rutina individual es necesario para evitar ambigüedad de parser.
- **High:** Reusar LWW+tombstones del sync actual reduce inconsistencias de comportamiento.
- **Medium-High:** Retener auto-backups locales (N copias) es útil, pero depende de cuotas/evicción del navegador.
- **Medium:** Conviene agregar timestamp global de settings para merge determinista; hoy el modelo no lo cubre de forma uniforme.

## Bottom Line for Planning

- Implementar un backup total versionado (`schemaVersion`) en módulo dedicado.
- Añadir validación estricta + preview de cambios antes de importar.
- Ejecutar restore en una sola transacción con dos modos: `fusionar` y `reemplazar`.
- Crear auto-backup previo al import y retención corta local.
- Mantener intacto el flujo existente de import/export por rutina.
