# Phase 11 Research: Sets Avanzados (Evidence + Product Direction)

## Standard Stack

**Prescriptive stack for this phase:**

- **Persistir el tipo de set como enum a nivel de set, no como inferencia UI.** La fuente de verdad debe vivir en `ActiveWorkoutSet`, `WorkoutSetRecord`, payloads de sync y backup. No inferir `warm-up`, `drop`, `fallo` o `AMRAP` por peso bajo, orden o reps. Esa inferencia sería frágil y contaminaría historial y progresión.
- **Reutilizar el stack actual React + Dexie + Supabase sync sin introducir nuevas tablas SQL.** En cloud ya existen `user_routines.exercises jsonb` y `user_workouts.exercises jsonb`; extender esos objetos anidados con `setType` / presets de set es suficiente. No hay señal de que una tabla relacional extra entregue valor proporcional al costo en esta fase.
- **Usar un enum interno estable y mapear labels/colores en UI.** Recomendación: `normal | warmup | drop | failure | amrap`. Los labels en español y badges se resuelven aparte. Esto evita meter strings visuales en backups, sync y lógica analítica.
- **Guardar presets de tipos por rutina como array alineado por orden de set.** La forma más simple y consistente con el modelo actual es extender `ExerciseDefaultRecord` con algo tipo `defaultSetTypes?: AdvancedSetType[]`. Con eso:
  - bootstrap de sesión usa `defaultSets` + `defaultSetTypes`
  - duplicar rutina copia presets sin trabajo extra
  - import/export solo necesita versionar el array
  - no hace falta una tabla extra por set template
- **Centralizar filtros analíticos por tipo de set.** Volumen, PRs y progresión no deben decidir por su cuenta. Debe existir un helper único del estilo:
  - `countsForVolume(type) -> boolean`
  - `countsForPr(type) -> boolean`
  - `countsForProgression(type) -> boolean`
  y toda pantalla o cálculo debe pasar por esos helpers.

## Research Findings

1. **Warm-up es preparatorio y mejora el rendimiento posterior, pero no equivale semánticamente a working sets.**
   - La literatura de warm-up lo trata como preparación aguda para mejorar rendimiento, no como la parte principal del estímulo entrenable. Una revisión narrativa reciente resume efectos positivos sobre fuerza, potencia y velocidad cuando el warm-up está bien diseñado. Fuente primaria/revisión académica: Blazevich & Babault 2019 / revisiones posteriores de warm-up en rendimiento. https://pubmed.ncbi.nlm.nih.gov/30787647/ https://pubmed.ncbi.nlm.nih.gov/32990449/
   - **Dirección de producto:** mantener `warm-up` registrado y contarlo en volumen bruto es defendible, pero excluirlo de PRs y progresión es coherente con su rol preparatorio.

2. **Drop sets son una técnica distinta, basada en reducir carga y continuar con fatiga acumulada.**
   - La definición operativa más común en la literatura: realizar un set a fallo o cerca del fallo y luego reducir la carga inmediatamente para seguir acumulando reps. Revisión sistemática/meta-analysis 2024: https://pubmed.ncbi.nlm.nih.gov/37523092/
   - Esa misma línea de evidencia sugiere que drop sets pueden producir hipertrofia comparable de forma eficiente en tiempo, pero la carga y el contexto de fatiga dejan de ser comparables con un set normal para fines de PR o progresión directa.
   - **Dirección de producto:** en V1 conviene tratarlo como set con badge especial, contar su volumen, pero excluirlo de PRs y progresión.

3. **Entrenar al fallo no es obligatorio para progresar, pero sigue siendo una observación válida del rendimiento real.**
   - Meta-analysis 2021: entrenar al fallo muscular no es necesario para fuerza e hipertrofia. https://pubmed.ncbi.nlm.nih.gov/33497853/
   - Eso no implica que un set al fallo “no valga”; implica que no debe ser requisito. Si el usuario registra un set al fallo, el dato sigue siendo una muestra válida de rendimiento y puede contar para PRs o progresión si el producto así lo define.
   - **Dirección de producto:** contar `failure` para volumen, PRs y progresión es defendible siempre que se use el resultado real del set y no un supuesto adicional.

4. **AMRAP funciona mejor como flag semántico sobre un set con resultado observado, no como fórmula aparte.**
   - En práctica y literatura aplicada, los sets tipo AMRAP suelen usarse como exposición de rendimiento con una carga fija y reps reales observadas. No encontramos una regla primaria estándar para software que exija tratar AMRAP con una fórmula distinta.
   - **Dirección de producto:** modelarlo como un set normal con tipo `amrap` y valores reales registrados. Luego decidir su elegibilidad analítica con helpers, no con un motor aparte.

5. **El “volumen” es una agregación amplia; separar “volumen total” de “working sets comparables” es una decisión de producto, no una obligación única de la literatura.**
   - En resistencia/fuerza, el volumen suele modelarse como combinaciones de sets, reps y carga, pero la literatura no impone una única semántica de software para excluir warm-ups o técnicas avanzadas del “volumen total”. ACSM trata sets/reps/load como variables del programa, no como un estándar de tracking de apps. https://pubmed.ncbi.nlm.nih.gov/19204579/
   - **Dirección de producto:** contar todo set completado para volumen bruto, y filtrar aparte PRs/progresión, es una regla simple y defendible para V1.

## Architecture Patterns

1. **Agregar `setType` de manera aditiva en todo el pipeline existente.**
   - `src/data/activeSession.ts` → `ActiveWorkoutSet`
   - `src/data/db.ts` → `WorkoutSetRecord`
   - `src/data/workouts.ts` → save/load/list helpers
   - `src/data/sync.ts` → JSON nested de workouts/routines
   - `src/data/routineBackup.ts` → bump de versión y serialización
   - `src/pages/Home.tsx` / `src/pages/Calendar.tsx` → revisión/historial
   - `src/pages/Profile.tsx` / `src/pages/Stats.tsx` / `src/data/progression.ts` → filtros analíticos

2. **Persistir presets por rutina como metadata por índice de set.**
   - Recomendación: extender defaults por ejercicio con `defaultSetTypes?: AdvancedSetType[]`.
   - Al iniciar workout:
     - si existe `defaultSetTypes[index]`, usarlo
     - si no existe, asumir `normal`
   - Al agregar o eliminar series:
     - re-normalizar el array por orden
   - Esto calza mejor con el modelo actual que una entidad nueva tipo `RoutineSetTemplateRecord`.

3. **Implementar una capa única de elegibilidad analítica.**
   - `normal`, `failure`, `amrap` → cuentan para PRs y progresión
   - `warmup`, `drop` → no cuentan para PRs ni progresión
   - todos los tipos completados → cuentan para volumen
   - Ese filtro debe vivir en helpers reutilizados por:
     - PRs en `Profile` y `Stats`
     - progresión en `src/data/progression.ts`
     - cualquier resumen futuro

4. **Default backward-compatible: todo set viejo = `normal`.**
   - La migración Dexie y la lectura de cloud/backups deben asumir `normal` si `setType` no existe.
   - Eso evita migraciones destructivas y mantiene historial previo estable.

5. **UI mobile-first: reusar la primera columna como trigger y superficie de badge.**
   - No abrir una columna nueva.
   - El badge reemplaza el número solo cuando el tipo no es `normal`.
   - El menú/bottom sheet debe reutilizar el patrón ya usado para menús de ejercicio y cambio de tipo, no inventar un sistema nuevo.

## Don't Hand-Roll

1. **No inferir tipos de set desde datos numéricos.**
   - Un set con poco peso no siempre es warm-up.
   - Un set con menos reps no siempre es fallo.
   - Un set tras otro con menos carga no siempre es drop.

2. **No duplicar la regla de exclusión en cada pantalla.**
   - Si PRs, Stats y progresión implementan filtros distintos, el comportamiento se desalineará rápido.
   - La elegibilidad debe centralizarse en helpers.

3. **No modelar drop sets como relación padre-hijo en V1.**
   - La literatura sí los define como secuencia con reducción de carga, pero el producto ya decidió una marca simple.
   - Forzar un modelo compuesto aquí agrega complejidad de UI, sync e import/export sin valor proporcional.

4. **No crear una migración SQL separada si el dato ya vive en JSONB.**
   - En Supabase actual, rutinas y workouts ya guardan `exercises` como `jsonb`.
   - Extender el shape del JSON es suficiente.

## Common Pitfalls

1. **Contaminar PRs actuales.**
   - Hoy `Profile.tsx` y `Stats.tsx` calculan PRs recorriendo todos los sets con `weight > 0` y `reps > 0`.
   - Si no se filtra `drop` y `warmup`, los PRs quedarán sesgados.

2. **Contaminar progresión existente.**
   - `src/data/progression.ts` usa historial de sets completados. Si `warmup` o `drop` entran ahí, el motor de Phase 10 se rompe conceptualmente.

3. **Perder presets al agregar/eliminar series.**
   - Si `defaultSetTypes` no se re-alinea por orden, la rutina quedará con badges corridos respecto del set visual.

4. **Perder `setType` en una sola capa del pipeline.**
   - El cambio debe atravesar:
     - sesión activa
     - Dexie
     - sync cloud
     - import/export
     - revisión/historial
   - Si falta una capa, el usuario verá el badge en vivo pero no en historial, o viceversa.

5. **Dejar el badge sin contraste o demasiado ancho en móvil.**
   - El badge vive en la columna más sensible del grid. Debe ser corto (`W`, `D`, `F`, `A`) y con color fuerte, no una etiqueta larga.

6. **Confundir “volumen total” con “working set comparable”.**
   - Para esta fase, volumen puede seguir contando todo set completado.
   - PRs y progresión deben usar filtros más estrictos. Si se mezcla eso en una sola función, el modelo se vuelve incoherente.

## Code Examples

```ts
type AdvancedSetType = 'normal' | 'warmup' | 'drop' | 'failure' | 'amrap';

function countsForVolume(type: AdvancedSetType) {
  return true;
}

function countsForPr(type: AdvancedSetType) {
  return type === 'normal' || type === 'failure' || type === 'amrap';
}

function countsForProgression(type: AdvancedSetType) {
  return type === 'normal' || type === 'failure' || type === 'amrap';
}
```

```ts
// preset alineado por índice de set dentro del ejercicio de rutina
type ExerciseDefaults = {
  defaultSets?: number;
  defaultReps?: number;
  defaultWeight?: number;
  defaultSetTypes?: AdvancedSetType[];
};

function getSeedSetType(defaults: ExerciseDefaults | undefined, index: number): AdvancedSetType {
  return defaults?.defaultSetTypes?.[index] ?? 'normal';
}
```

```ts
// migración backward-compatible
const persistedType = set.setType ?? 'normal';
```

## Confidence Levels

- **High:** Warm-up debe tratarse como preparación separada de los working sets; la literatura de warm-up lo ubica como intervención aguda para mejorar rendimiento posterior. https://pubmed.ncbi.nlm.nih.gov/30787647/ https://pubmed.ncbi.nlm.nih.gov/32990449/
- **High:** Drop sets son una técnica distinta basada en reducción inmediata de carga y fatiga elevada; excluirlas de PRs/progresión mientras se las mantiene en volumen es una dirección de producto prudente. https://pubmed.ncbi.nlm.nih.gov/37523092/
- **High:** El fallo muscular no es requisito para progresar, pero eso no invalida el set registrado; usar `failure` como dato válido para PRs/progresión es coherente con la evidencia si se toma el rendimiento real. https://pubmed.ncbi.nlm.nih.gov/33497853/
- **Medium:** Tratar AMRAP como flag sobre un set normal con reps observadas es una inferencia de producto razonable; no encontramos una norma primaria de software que obligue a otra cosa.
- **High:** Centralizar elegibilidad analítica y persistir `setType` por set son decisiones de arquitectura sólidas dadas las rutas actuales de Dexie/sync/backup del proyecto.

## Bottom Line for Planning

- Implementar `setType` como enum persistido por set en todo el pipeline actual.
- Guardar presets por rutina como array alineado por índice (`defaultSetTypes`).
- Reusar la primera columna del workout para abrir un menú/bottom sheet y mostrar el badge corto.
- Centralizar filtros de volumen/PRs/progresión antes de tocar UI secundaria.
- Mantener `drop` como flag simple en V1, aunque la literatura lo describa como secuencia con reducción de carga.
