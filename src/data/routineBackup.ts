import { db } from './db';
import { resolveCanonicalExerciseId } from './catalogNormalization';
import { getLastWorkoutForRoutine, getWorkoutExercises, getWorkoutSets } from './workouts';
import { normalizeName } from './normalizeText';

export interface RoutineBackupPayload {
  version: 1 | 2 | 3 | 4;
  createdAt: string;
  routine: {
    name: string;
    tags: string[];
    exercises: Array<{
      exerciseId: string;
      order: number;
      defaults?: {
        metricTypeOverride?: 'weight_reps' | 'reps' | 'time' | 'distance';
        defaultSetTypes?: Array<'normal' | 'warmup' | 'drop' | 'failure' | 'amrap'>;
        defaultSets?: number;
        defaultReps?: number;
        defaultWeight?: number;
        defaultDuration?: number;
        defaultDistance?: number;
        defaultRestSeconds?: number;
        goalMode?: 'auto' | 'strength' | 'hypertrophy' | 'endurance';
      };
    }>;
  };
  exercises: Array<{
    id: string;
    baseName: string;
    muscles: string[];
    secondaryMuscles?: string[];
    equipment: string[];
    metricType: string;
    isCustom: boolean;
    source: 'custom';
    translations: Array<{ language: string; name: string }>;
  }>;
}

export async function exportRoutineBackup(routineId: string): Promise<RoutineBackupPayload> {
  const routine = await db.routines.get(routineId);
  if (!routine || routine.deletedAt) throw new Error('routine-not-found');
  const tags = await db.routineTags.where('routineId').equals(routineId).toArray();
  const routineExercises = await db.routineExercises
    .where('routineId')
    .equals(routineId)
    .sortBy('order');
  const defaults = await db.exerciseDefaults.where('routineId').equals(routineId).toArray();
  const defaultsByExercise = new Map(
    defaults.map((item) => [
      resolveCanonicalExerciseId(item.exerciseId),
      {
        defaultSets: item.defaultSets,
        metricTypeOverride: item.metricTypeOverride,
        defaultSetTypes: item.defaultSetTypes,
        defaultReps: item.defaultReps,
        defaultWeight: item.defaultWeight,
        defaultDuration: item.defaultDuration,
        defaultDistance: item.defaultDistance,
        defaultRestSeconds: item.defaultRestSeconds,
        goalMode: item.goalMode
      }
    ])
  );

  const lastWorkout = await getLastWorkoutForRoutine(routineId);
  const lastSetsByExercise = new Map<
    string,
    Array<{
      setType?: 'normal' | 'warmup' | 'drop' | 'failure' | 'amrap';
      weight?: number;
      reps?: number;
    }>
  >();
  if (lastWorkout) {
    const workoutExercises = await getWorkoutExercises(lastWorkout.id);
    for (const workoutExercise of workoutExercises) {
      const sets = await getWorkoutSets(workoutExercise.id);
      lastSetsByExercise.set(
        resolveCanonicalExerciseId(workoutExercise.exerciseId),
        sets.map((set) => ({ setType: set.setType, weight: set.weight, reps: set.reps }))
      );
    }
  }

  const exerciseIds = routineExercises.map((entry) => entry.exerciseId);
  const customExercises = await db.exercises
    .where('id')
    .anyOf(exerciseIds)
    .filter((exercise) => exercise.isCustom)
    .toArray();
  const translations = await db.exerciseTranslations
    .where('exerciseId')
    .anyOf(customExercises.map((exercise) => exercise.id))
    .toArray();

  return {
    version: 4,
    createdAt: new Date().toISOString(),
    routine: {
      name: routine.name,
      tags: tags.map((tag) => tag.tag),
      exercises: routineExercises.map((entry) => {
        const canonicalExerciseId = resolveCanonicalExerciseId(entry.exerciseId);
        const baseDefaults = defaultsByExercise.get(canonicalExerciseId);
        const lastSets = lastSetsByExercise.get(canonicalExerciseId) ?? [];
        const lastSet = lastSets.length ? lastSets[lastSets.length - 1] : undefined;

        const mergedDefaults = {
          ...baseDefaults,
          defaultSetTypes:
            lastSets.length > 0 ? lastSets.map((set) => set.setType ?? 'normal') : baseDefaults?.defaultSetTypes,
          defaultSets: lastSets.length || baseDefaults?.defaultSets,
          defaultWeight: lastSet?.weight ?? baseDefaults?.defaultWeight,
          defaultReps: lastSet?.reps ?? baseDefaults?.defaultReps
        };

        return {
          exerciseId: canonicalExerciseId,
          order: entry.order,
          defaults: Object.values(mergedDefaults).some((value) => value !== undefined)
            ? mergedDefaults
            : undefined
        };
      })
    },
    exercises: customExercises.map((exercise) => ({
      id: exercise.id,
      baseName: exercise.baseName,
      muscles: exercise.muscles,
      secondaryMuscles: exercise.secondaryMuscles ?? [],
      equipment: exercise.equipment,
      metricType: exercise.metricType,
      isCustom: true,
      source: 'custom' as const,
      translations: translations
        .filter((item) => item.exerciseId === exercise.id)
        .map((item) => ({ language: item.language, name: item.name }))
    }))
  };
}

export async function importRoutineBackup(payload: RoutineBackupPayload) {
  if (
    !payload ||
    (payload.version !== 1 &&
      payload.version !== 2 &&
      payload.version !== 3 &&
      payload.version !== 4)
  ) {
    throw new Error('invalid-backup');
  }

  const now = new Date().toISOString();
  const routineId = `routine-${crypto.randomUUID()}`;
  const activeRoutines = (await db.routines.orderBy('order').toArray()).filter(
    (routine) => !routine.deletedAt
  );
  const lastOrder = activeRoutines.length
    ? activeRoutines[activeRoutines.length - 1]
    : undefined;
  const order = lastOrder ? lastOrder.order + 1 : 0;

  const customExerciseMap = new Map<string, string>();
  await db.transaction('rw', db.exercises, db.exerciseTranslations, async () => {
    for (const exercise of payload.exercises ?? []) {
      const newId = `custom-${crypto.randomUUID()}`;
      customExerciseMap.set(exercise.id, newId);
      await db.exercises.add({
        id: newId,
        baseName: exercise.baseName,
        normalizedName: normalizeName(exercise.baseName),
        muscles: exercise.muscles,
        secondaryMuscles: exercise.secondaryMuscles ?? [],
        equipment: exercise.equipment,
        metricType: exercise.metricType as any,
        isCustom: true,
        source: 'custom',
        createdAt: now,
        updatedAt: now
      });
      if (exercise.translations?.length) {
        await db.exerciseTranslations.bulkAdd(
          exercise.translations.map((item) => ({
            id: `${newId}-${item.language}`,
            exerciseId: newId,
            language: item.language,
            name: item.name
          }))
        );
      }
    }
  });

  await db.transaction(
    'rw',
    [db.routines, db.routineTags, db.routineExercises, db.exerciseDefaults, db.routineVersions],
    async () => {
      await db.routines.add({
        id: routineId,
        name: payload.routine.name,
        createdAt: now,
        updatedAt: now,
        order
      });

      if (payload.routine.tags?.length) {
        await db.routineTags.bulkAdd(
          payload.routine.tags.map((tag) => ({
            id: `${routineId}-${tag}`,
            routineId,
            tag
          }))
        );
      }

      if (payload.routine.exercises?.length) {
        await db.routineExercises.bulkAdd(
          payload.routine.exercises.map((entry) => ({
            id: `routine-exercise-${crypto.randomUUID()}`,
            routineId,
            exerciseId: resolveCanonicalExerciseId(
              customExerciseMap.get(entry.exerciseId) ?? entry.exerciseId
            ),
            order: entry.order
          }))
        );
        await db.exerciseDefaults.bulkAdd(
          payload.routine.exercises
            .filter((entry) => entry.defaults)
            .map((entry) => ({
              id: `default-${crypto.randomUUID()}`,
              routineId,
              exerciseId: resolveCanonicalExerciseId(
                customExerciseMap.get(entry.exerciseId) ?? entry.exerciseId
              ),
              ...entry.defaults
            }))
        );
      }

      await db.routineVersions.add({
        id: `${routineId}-${now}`,
        routineId,
        createdAt: now,
        name: payload.routine.name,
        snapshot: JSON.stringify(payload.routine)
      });
    }
  );

  return routineId;
}
