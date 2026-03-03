# Phase 10 Research: Progresion de Carga (Evidence + Product Direction)

## Standard Stack

**Prescriptive stack for this phase:**

- **Fuente de verdad: historial real de sets completados** (`completed = true`) por ejercicio y tipo de metrica. No usar sets no marcados ni valores planificados. Esto es una conclusion de producto apoyada por la alta variabilidad del rendimiento submaximo observada en la literatura; reaccionar a ruido o sets no completados empeora la prescripcion.
- **`weight_reps`: doble progresion + pequenos aumentos de carga**. La base mas defendible es el modelo de rango de repeticiones con aumentos de carga de **2-10%** cuando el usuario supera el objetivo actual por **1-2 repeticiones**. Fuente primaria: ACSM Position Stand 2009. https://pubmed.ncbi.nlm.nih.gov/19204579/
- **`reps`: progresion por repeticiones/volumen, no por formula de carga.** Cuando no existe carga externa, la sobrecarga debe ocurrir via mas repeticiones completadas (o mas volumen) tras exito repetido. Esto es una inferencia directa del modelo de progresion por rango de repeticiones de ACSM 2009, no una formula literal del paper. https://pubmed.ncbi.nlm.nih.gov/19204579/
- **`time` y `distance`: progresion gradual y conservadora.** En las fuentes primarias revisadas no aparece una formula universal equiparable al 2-10% de ACSM para fuerza. Lo que si aparece es la recomendacion de **modificar el programa segun actividad habitual, funcion fisica, respuestas al ejercicio y objetivos**, con **progresion gradual de intensidad y volumen**. Fuente primaria: ACSM Position Stand 2011. https://pubmed.ncbi.nlm.nih.gov/21694556/
- **e1RM solo como senal secundaria**, no como motor principal de la sugerencia. Las relaciones reps-%1RM cambian segun el ejercicio y existe amplia variabilidad interindividual, por lo que una formula unica de 1RM o una tabla global no deberia gobernar la prescripcion. Fuentes primarias: meta-regresion de Nuzzo 2024 + estudios de variabilidad por ejercicio. https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212/ https://pubmed.ncbi.nlm.nih.gov/17194239/ https://pmc.ncbi.nlm.nih.gov/articles/PMC3900316/

## Architecture Patterns

1. **Separar la logica por tipo de metrica.**
   - `weight_reps` necesita reglas distintas a `reps`, `time` o `distance`.
   - No conviene una sola formula global. La evidencia muestra que la relacion repeticiones-%1RM cambia segun el ejercicio; por ejemplo, el leg press y el bench press no se comportan igual bajo la misma carga relativa. Fuente primaria: Nuzzo 2024 meta-regression. https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212/

2. **Gatillar aumentos solo tras exito repetido, no por una sola sesion “buena”.**
   - ACSM 2009 recomienda subir 2-10% cuando se logra 1-2 reps por sobre el objetivo actual.
   - La variabilidad interindividual y entre ejercicios en reps a un %1RM dado es alta, asi que un umbral de dos exposiciones exitosas o exito consistente a nivel de sesion es una inferencia prudente para evitar sobre-prescribir. Fuentes: ACSM 2009, Hoeger 2006, variability study 2014. https://pubmed.ncbi.nlm.nih.gov/19204579/ https://pubmed.ncbi.nlm.nih.gov/17194239/ https://pmc.ncbi.nlm.nih.gov/articles/PMC3900316/

3. **Ajustar tamano de incremento segun el ejercicio, no solo segun el usuario.**
   - ACSM 2009 entrega un rango amplio (2-10%) en vez de una sola cifra.
   - La implementacion debe aterrizarlo con pasos pequenos y redondeo segun equipamiento: barra/maquina mas grandes; mancuerna/aislados mas chicos. Esta parte del redondeo es una inferencia de producto; el respaldo primario es el rango ACSM, no un paso exacto por implemento. https://pubmed.ncbi.nlm.nih.gov/19204579/

4. **No depender de RPE ni de entrenar al fallo.**
   - El usuario no usa RPE con constancia.
   - La literatura no exige fallo para progresar: una meta-analisis encontro que entrenar al fallo no es necesario para ganancias de fuerza e hipertrofia. Fuente primaria: Grgic et al. 2021. https://pubmed.ncbi.nlm.nih.gov/33497853/

5. **No usar composicion corporal como input central de V1.**
   - En las fuentes primarias revisadas, los modelos de progresion practicos se apoyan en rendimiento, reps conseguidas, tipo de ejercicio y respuesta reciente.
   - Existe al menos un trabajo reciente que predice 1RM de leg press con bioimpedancia, pero es un modelo transversal, especifico y no un sistema de progresion sesion-a-sesion. Fuente primaria: 2025 BIA leg press model. https://pmc.ncbi.nlm.nih.gov/articles/PMC12906961/
   - **Inferencia:** para V1, composicion corporal agrega complejidad sin evidencia suficiente de valor incremental en la prescripcion diaria.

6. **La UI debe ser inline y explicable.**
   - La sugerencia deberia vivir dentro de la tabla actual (p. ej. `SUG.`) o como CTA compacto por fila/set.
   - La aceptacion/rechazo debe ser un gesto pequeno (tap para aplicar), no un modal por set.
   - Esta es una decision de producto derivada del contexto de uso movil y de la UX actual tipo Hevy.

## Don't Hand-Roll

1. **No inventar una formula “magica” que mezcle peso corporal, composicion corporal y entrenamientos pasados para todos los ejercicios.**
   - No vimos una fuente primaria que respalde una formula general de ese tipo para prescripcion diaria en adultos sanos.
   - Para V1, eso seria pseudo-precision.

2. **No usar una tabla global de %1RM -> reps como unico cerebro de la sugerencia.**
   - La evidencia muestra diferencias por ejercicio y alta dispersion individual. Fuentes: Nuzzo 2024, Hoeger 2006, variability study 2014. https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212/ https://pubmed.ncbi.nlm.nih.gov/17194239/ https://pmc.ncbi.nlm.nih.gov/articles/PMC3900316/

3. **No exigir RPE, RIR ni fallo muscular para que la feature funcione.**
   - Seria incompatible con tu uso real y no esta respaldado como requisito para progresar. https://pubmed.ncbi.nlm.nih.gov/33497853/

4. **No fingir exactitud cientifica en `time` y `distance`.**
   - Para cardio/tiempo/distancia, las fuentes primarias revisadas apoyan progresion gradual individualizada, pero no entregan una formula universal tipo “sube X exacto siempre”.

## Common Pitfalls

1. **Tomar una sesion excepcional como nueva capacidad estable.**
   - La variabilidad del rendimiento submaximo es real. Si se progresa por un unico outlier, se sobre-prescribe facil. https://pmc.ncbi.nlm.nih.gov/articles/PMC3900316/

2. **Aplicar el mismo salto a bench press, curl y leg press.**
   - La literatura muestra diferencias por ejercicio/musculo involucrado. https://pubmed.ncbi.nlm.nih.gov/17194239/ https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212/

3. **Contar sets no completados como si fueran exposiciones exitosas.**
   - Eso sesga la sugerencia al alza y contradice el objetivo de usar desempeno real.

4. **Sobrecargar la tabla en movil.**
   - Si `SUG.` obliga a scroll horizontal, la integracion esta mal resuelta. La sugerencia debe comprimir o reutilizar espacio existente.

5. **Hacer que la sugerencia sea una caja negra.**
   - Debe poder explicarse con una frase corta del tipo “sube porque completaste el objetivo dos sesiones seguidas”.

## Code Examples

```ts
// weight_reps: doble progresion conservadora (inferencia de producto
// basada en ACSM 2009 + estudios de variabilidad)
function suggestWeightReps(input: ExerciseHistory) {
  const recent = getLastCompletedSessions(input.exerciseId, 2);
  if (recent.length === 0) return null;

  const metTargetTwice = recent.every((session) =>
    session.workSets.every((set) => set.completed && set.reps >= set.targetReps),
  );

  const exceededTarget = recent.every((session) =>
    session.workSets.every((set) => set.completed && set.reps >= set.targetReps + 1),
  );

  if (metTargetTwice && exceededTarget) {
    const pct = pickIncrementPercent(input.exerciseProfile); // 2-10% ACSM envelope
    return roundToEquipmentStep(input.lastLoadKg * (1 + pct));
  }

  return input.lastLoadKg;
}
```

```ts
// time/distance: progresion gradual conservadora
// (inferencia de producto basada en ACSM 2011; no encontramos formula primaria universal)
function suggestTimeOrDistance(input: MetricHistory) {
  const recent = getLastCompletedSessions(input.exerciseId, 2);
  if (recent.length < 2) return input.lastCompletedValue;

  const succeededTwice = recent.every((session) => session.allTargetsCompleted);
  if (!succeededTwice) return input.lastCompletedValue;

  const next = Math.max(
    input.lastCompletedValue * 1.05,
    input.lastCompletedValue + metricFloorStep(input.metricType),
  );

  return roundMetric(next, input.metricType);
}
```

## Confidence Levels

- **High:** ACSM 2009 respalda subir la carga **2-10%** cuando el usuario puede hacer **1-2 reps por sobre el objetivo** con la carga actual. https://pubmed.ncbi.nlm.nih.gov/19204579/
- **High:** La relacion reps-%1RM no es universal; cambia por ejercicio y presenta dispersion individual relevante. https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212/ https://pubmed.ncbi.nlm.nih.gov/17194239/ https://pmc.ncbi.nlm.nih.gov/articles/PMC3900316/
- **High:** El fallo muscular no es requisito para fuerza/hipertrofia; por tanto la feature no necesita RPE/RIR/fallo para ser util. https://pubmed.ncbi.nlm.nih.gov/33497853/
- **Medium:** Usar e1RM solo como senal secundaria es una sintesis razonable, pero no encontramos una fuente primaria que la proponga exactamente como regla de producto para apps de tracking.
- **Medium:** Para `time` y `distance`, la recomendacion mas defendible es progresion gradual e individualizada; no encontramos una formula primaria universal equivalente al caso `weight_reps`. La propuesta de +5-10% o +15/+30 s es una **inferencia de producto**, no un estandar clinico cerrado. https://pubmed.ncbi.nlm.nih.gov/21694556/

## Bottom Line for Planning

- La primera implementacion debe concentrarse en `weight_reps` con un motor de **doble progresion conservadora**, basado en sets completados y aumentos pequenos redondeados por equipamiento.
- `reps`, `time` y `distance` deben entrar en la misma fase, pero con una version mas simple y explicitamente conservadora.
- La UI no debe usar popups por set. La mejor direccion es una integracion inline compacta en la tabla actual (`SUG.` o equivalente) con aplicacion por tap.
- La logica debe ser explicable en una linea corta; si no se puede explicar, probablemente esta demasiado compleja.
