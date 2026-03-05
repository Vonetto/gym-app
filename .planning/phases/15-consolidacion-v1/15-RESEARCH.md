# Phase 15 Research - Consolidación V1 (Hardening + Cierre)

**Date:** 2026-03-05  
**Status:** Researched

## Objective

Definir una estrategia ejecutable para cerrar V1 con calidad defendible sin agregar features nuevas:

1. hardening core en `Sync`, `Notificaciones` y `Workout`
2. normalización de `ROADMAP/STATE/REQUIREMENTS` legacy
3. pulido UX acotado en `Workout`, `Ajustes` y `Home`
4. evidencia de cierre con checklist QA + pendientes explícitos

## Phase Context (locked decisions)

Desde `15-CONTEXT.md`:

- Cierre V1 exige `0 críticos / 0 altos`.
- Gate técnico: `npm run build` + tests locales.
- QA móvil: manual con checklist reproducible.
- Normalizar requirements legacy 4-7 ahora (sin `Pending` falso).
- UX final: solo regresiones + micro-ajustes (sin rediseños mayores).

## Current State

### Testing baseline

- No hay infraestructura de tests en `package.json` (solo `dev`, `build`, `preview`).
- No existe carpeta de tests ni scripts de cobertura.
- El proyecto es React + Vite + TypeScript + Dexie + Supabase, con bastante lógica de dominio en `src/data/*`.

### Riesgo actual para cierre V1

- La app funciona y compila, pero no existe red de seguridad automática para:
  - merges LWW/tombstones (`sync.ts`, `fullBackup.ts`)
  - flows de notificación (permisos, toggles, condiciones de envío)
  - reglas de sesión/workout en casos borde

### Documentación legacy

- `REQUIREMENTS.md` mezcla requirements implementados con estados `Pending`.
- `ROADMAP.md` conserva fases 4-7 como si fueran bloques independientes, aunque su alcance fue absorbido por fases posteriores.
- `STATE.md` ya reconoce esta desalineación; Phase 15 la formaliza.

## Standard Stack (recommended)

Para esta fase, usar stack mínimo y estable:

- **Vitest** para runner/asserciones unitarias e integración liviana.
  - https://vitest.dev/guide/
- **@testing-library/react** para comportamiento de UI en componentes críticos.
  - https://testing-library.com/docs/react-testing-library/intro/
- **fake-indexeddb** para tests deterministas de lógica Dexie en Node.
  - https://github.com/dumbmatter/fakeIndexedDB
- **No e2e móvil automatizado en esta fase** (queda QA manual por decisión de contexto).

## Architecture Patterns

### 1) Priorizar “testable core” antes de UI amplia

En esta fase conviene cubrir primero funciones con alta carga de reglas:

- `src/data/fullBackup.ts`
- `src/data/sync.ts`
- `src/data/notifications.ts`
- helpers de `src/data/workouts.ts` / `src/pages/Workout.tsx` que se puedan extraer

Patrón recomendado:
- tests de funciones puras/semipuras primero
- luego integration tests cortos para flujos clave

### 2) Casos de prueba orientados a riesgo

Matriz mínima obligatoria:

- **Backup/import**
  - payload válido (`merge`)
  - payload válido (`replace`)
  - archivo corrupto/incompleto
  - conflictos `updatedAt/deletedAt`
  - colisiones de nombre con sufijos `(2)`, `(3)`
- **Sync**
  - `local wins`, `remote wins`, `deleted wins`
  - idempotencia básica de corrida repetida
- **Notificaciones**
  - toggle global off bloquea envíos
  - toggle por tipo respeta categoría
  - permisos denegados no rompen flujo
- **Workout**
  - guardado descarta sesión con 0 sets completados
  - métrica correcta por tipo de ejercicio
  - sets especiales no contaminan resúmenes donde aplica

### 3) Cierre documental con trazabilidad explícita

No solo cambiar `Pending -> Complete`; también dejar equivalencia clara:

- requirement -> fase real de implementación
- requirement -> evidencia funcional (archivo o flujo)

Esto evita regresiones de interpretación al abrir V2/V3/V4.

## Don't Hand-Roll

1. No crear un runner de tests propio; usar Vitest.
2. No simular IndexedDB manualmente; usar `fake-indexeddb`.
3. No cerrar V1 solo con “build verde”; requiere suite mínima y checklist QA.
4. No “forzar” cambios de estado en docs sin tabla de equivalencias.
5. No meter rediseños UX grandes en esta fase de cierre.

## Common Pitfalls

1. **Cobertura superficial**
   - Tener pocos tests que pasan pero no cubren conflictos reales de merge.
2. **Tests frágiles de UI**
   - Aserciones de CSS/layout en vez de comportamiento observable.
3. **Falso cierre documental**
   - Marcar `Complete` sin traza de dónde quedó implementado.
4. **Scope creep**
   - Convertir micro-pulido UX en rediseño de pantallas.
5. **Falta de reproducibilidad QA**
   - QA manual sin checklist deja el cierre no defendible.

## Code Examples (target patterns)

### Example A - test unitario de conflicto LWW (sync/backup)

```ts
it('gana deletedAt mas nuevo sobre updatedAt anterior', () => {
  const incoming = { updatedAt: '2026-03-01T10:00:00.000Z', deletedAt: '2026-03-02T10:00:00.000Z' };
  const current = { updatedAt: '2026-03-02T09:00:00.000Z', deletedAt: null };
  expect(incomingWins(incoming.updatedAt, incoming.deletedAt, current.updatedAt, current.deletedAt)).toBe(true);
});
```

### Example B - test de parse/validación backup corrupto

```ts
it('rechaza archivo sin backupType valido', async () => {
  await expect(parseAndValidateFullBackupText('{"schemaVersion":1}'))
    .rejects
    .toMatchObject({ code: 'wrong-backup-type' });
});
```

### Example C - gate de cierre CI local

```bash
npm run build
npm run test
```

## Recommended Plan Inputs (for phase 15 planning)

1. Bootstrap de test infra (`vitest`, setup, scripts).
2. Suite core por riesgo (`sync`, `notifications`, `workout`, `fullBackup`).
3. Normalización completa `REQUIREMENTS.md` + tabla de equivalencias.
4. Ajuste `ROADMAP.md` para marcar 4-7 como `superseded/consolidated`.
5. QA checklist móvil/local y `15-SUMMARY.md` con pendientes.

## Confidence

- **Alta** en dirección general (hardening + docs + QA) porque está alineada con contexto y estado real del repo.
- **Media** en esfuerzo exacto de tests de UI, ya que depende de cuánto logic se extraiga de componentes durante ejecución.

