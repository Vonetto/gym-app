import {
  AdvancedSetType,
  db,
  ExerciseGoalMode,
  ExerciseMetric,
  RoutineRecord,
  RoutineVersionRecord
} from './db';
import { resolveCanonicalExerciseId } from './catalogNormalization';
import { normalizeSetTypeArray } from './setTypes';

export interface RoutineSnapshot {
  routine: RoutineRecord;
  tags: string[];
  exercises: Array<{
    exerciseId: string;
    order: number;
    defaults?: {
      metricTypeOverride?: ExerciseMetric;
      defaultSetTypes?: AdvancedSetType[];
      defaultSets?: number;
      defaultReps?: number;
      defaultWeight?: number;
      defaultDuration?: number;
      defaultDistance?: number;
      defaultRestSeconds?: number;
      goalMode?: ExerciseGoalMode;
    };
  }>;
}

function buildRoutineSnapshot(routine: RoutineRecord, tags: string[], exercises: RoutineSnapshot['exercises']) {
  return JSON.stringify({ routine, tags, exercises });
}

export async function listRoutines() {
  const routines = await db.routines.orderBy('order').toArray();
  return routines.filter((routine) => !routine.deletedAt);
}

export async function createRoutine(name: string, tags: string[]) {
  const now = new Date().toISOString();
  const routines = await listRoutines();
  const lastOrder = routines.length ? routines[routines.length - 1] : undefined;
  const order = lastOrder ? lastOrder.order + 1 : 0;
  const routine: RoutineRecord = {
    id: `routine-${crypto.randomUUID()}`,
    name,
    createdAt: now,
    updatedAt: now,
    order
  };
  await db.transaction('rw', db.routines, db.routineTags, db.routineVersions, async () => {
    await db.routines.add(routine);
    if (tags.length) {
      await db.routineTags.bulkAdd(
        tags.map((tag) => ({ id: `${routine.id}-${tag}`, routineId: routine.id, tag }))
      );
    }
    await db.routineVersions.add({
      id: `${routine.id}-${now}`,
      routineId: routine.id,
      createdAt: now,
      name: routine.name,
      snapshot: buildRoutineSnapshot(routine, tags, [])
    });
  });
  return routine;
}

export async function updateRoutine(
  routineId: string,
  updates: { name: string; tags: string[] }
) {
  const routine = await db.routines.get(routineId);
  if (!routine || routine.deletedAt) return;
  const now = new Date().toISOString();
  const exercises = await db.routineExercises.where('routineId').equals(routineId).toArray();
  const defaults = await db.exerciseDefaults.where('routineId').equals(routineId).toArray();
  const snapshotExercises = exercises.map((exercise) => ({
    exerciseId: exercise.exerciseId,
    order: exercise.order,
    defaults: defaults.find((item) => item.exerciseId === exercise.exerciseId)
  }));
  const nextRoutine: RoutineRecord = {
    ...routine,
    name: updates.name,
    updatedAt: now
  };
  await db.transaction('rw', db.routines, db.routineTags, db.routineVersions, async () => {
    await db.routines.update(routineId, nextRoutine);
    await db.routineTags.where('routineId').equals(routineId).delete();
    if (updates.tags.length) {
      await db.routineTags.bulkAdd(
        updates.tags.map((tag) => ({ id: `${routineId}-${tag}`, routineId, tag }))
      );
    }
    const version: RoutineVersionRecord = {
      id: `${routineId}-${now}`,
      routineId,
      createdAt: now,
      name: updates.name,
      snapshot: buildRoutineSnapshot(nextRoutine, updates.tags, snapshotExercises)
    };
    await db.routineVersions.add(version);
  });
}

export async function overwriteRoutineExercises(
  routineId: string,
  exercises: Array<{
    exerciseId: string;
    order: number;
    defaults?: {
      metricTypeOverride?: ExerciseMetric;
      defaultSetTypes?: AdvancedSetType[];
      defaultSets?: number;
      defaultReps?: number;
      defaultWeight?: number;
      defaultDuration?: number;
      defaultDistance?: number;
      defaultRestSeconds?: number;
      goalMode?: ExerciseGoalMode;
    };
  }>
) {
  const routine = await db.routines.get(routineId);
  if (!routine || routine.deletedAt) return;
  const tags = await db.routineTags.where('routineId').equals(routineId).toArray();
  const now = new Date().toISOString();
  const nextRoutine: RoutineRecord = {
    ...routine,
    updatedAt: now
  };

  const normalizedExercises = exercises.map((exercise) => ({
    ...exercise,
    exerciseId: resolveCanonicalExerciseId(exercise.exerciseId)
  }));

  await db.transaction(
    'rw',
    [db.routines, db.routineTags, db.routineExercises, db.exerciseDefaults, db.routineVersions],
    async () => {
      await db.routines.update(routineId, nextRoutine);
      await db.routineExercises.where('routineId').equals(routineId).delete();
      await db.exerciseDefaults.where('routineId').equals(routineId).delete();
      if (normalizedExercises.length) {
        await db.routineExercises.bulkAdd(
          normalizedExercises.map((exercise) => ({
            id: `routine-exercise-${crypto.randomUUID()}`,
            routineId,
            exerciseId: exercise.exerciseId,
            order: exercise.order
          }))
        );
        const defaults = normalizedExercises
          .filter((exercise) => exercise.defaults)
          .map((exercise) => ({
            id: `default-${crypto.randomUUID()}`,
            routineId,
            exerciseId: exercise.exerciseId,
            ...exercise.defaults,
            defaultSetTypes:
              exercise.defaults?.defaultSetTypes || exercise.defaults?.defaultSets
                ? normalizeSetTypeArray(
                    exercise.defaults?.defaultSetTypes,
                    exercise.defaults?.defaultSets ?? 0
                  )
                : undefined
          }));
        if (defaults.length) {
          await db.exerciseDefaults.bulkAdd(defaults);
        }
      }
      await db.routineVersions.add({
        id: `${routineId}-${now}`,
        routineId,
        createdAt: now,
        name: routine.name,
        snapshot: buildRoutineSnapshot(nextRoutine, tags.map((tag) => tag.tag), normalizedExercises)
      });
    }
  );
}

export async function deleteRoutine(routineId: string) {
  const routine = await db.routines.get(routineId);
  if (!routine || routine.deletedAt) return;
  const now = new Date().toISOString();
  await db.transaction(
    'rw',
    [
      db.routines,
      db.routineTags,
      db.routineExercises,
      db.exerciseDefaults,
      db.routineVersions,
      db.plannedWorkoutSeries,
      db.plannedWorkoutOccurrences
    ],
    async () => {
      await db.routines.update(routineId, {
        updatedAt: now,
        deletedAt: now
      });
      await db.routineTags.where('routineId').equals(routineId).delete();
      await db.routineExercises.where('routineId').equals(routineId).delete();
      await db.exerciseDefaults.where('routineId').equals(routineId).delete();
      await db.routineVersions.where('routineId').equals(routineId).delete();
      const plannedSeries = await db.plannedWorkoutSeries.where('routineId').equals(routineId).toArray();
      if (plannedSeries.length) {
        await Promise.all(
          plannedSeries.map((series) =>
            db.plannedWorkoutSeries.update(series.id, {
              updatedAt: now,
              deletedAt: now
            })
          )
        );
        const seriesIds = plannedSeries.map((series) => series.id);
        const occurrenceRows = await db.plannedWorkoutOccurrences
          .where('seriesId')
          .anyOf(seriesIds)
          .toArray();
        if (occurrenceRows.length) {
          await Promise.all(
            occurrenceRows.map((row) =>
              db.plannedWorkoutOccurrences.update(row.id, {
                updatedAt: now,
                deletedAt: now
              })
            )
          );
        }
      }
    }
  );
}

export async function duplicateRoutine(routineId: string) {
  const routine = await db.routines.get(routineId);
  if (!routine || routine.deletedAt) return;
  const tags = await db.routineTags.where('routineId').equals(routineId).toArray();
  const exercises = await db.routineExercises.where('routineId').equals(routineId).toArray();
  const defaults = await db.exerciseDefaults.where('routineId').equals(routineId).toArray();
  const now = new Date().toISOString();
  const routines = await listRoutines();
  const lastOrder = routines.length ? routines[routines.length - 1] : undefined;
  const order = lastOrder ? lastOrder.order + 1 : 0;
  const newRoutine: RoutineRecord = {
    id: `routine-${crypto.randomUUID()}`,
    name: `${routine.name} (Copia)`,
    createdAt: now,
    updatedAt: now,
    order
  };
  await db.transaction(
    'rw',
    [db.routines, db.routineTags, db.routineExercises, db.exerciseDefaults, db.routineVersions],
    async () => {
      await db.routines.add(newRoutine);
      if (tags.length) {
        await db.routineTags.bulkAdd(
          tags.map((tag) => ({ id: `${newRoutine.id}-${tag.tag}`, routineId: newRoutine.id, tag: tag.tag }))
        );
      }
      if (exercises.length) {
        await db.routineExercises.bulkAdd(
          exercises.map((exercise) => ({
            id: `routine-exercise-${crypto.randomUUID()}`,
            routineId: newRoutine.id,
            exerciseId: exercise.exerciseId,
            order: exercise.order
          }))
        );
      }
      if (defaults.length) {
        await db.exerciseDefaults.bulkAdd(
          defaults.map((item) => ({
            id: `default-${crypto.randomUUID()}`,
            routineId: newRoutine.id,
            exerciseId: item.exerciseId,
            metricTypeOverride: item.metricTypeOverride,
            defaultSetTypes: item.defaultSetTypes,
            defaultReps: item.defaultReps,
            defaultWeight: item.defaultWeight,
            defaultDuration: item.defaultDuration,
            defaultDistance: item.defaultDistance,
            defaultRestSeconds: item.defaultRestSeconds,
            goalMode: item.goalMode
          }))
        );
      }
      await db.routineVersions.add({
        id: `${newRoutine.id}-${now}`,
        routineId: newRoutine.id,
        createdAt: now,
        name: newRoutine.name,
        snapshot: buildRoutineSnapshot(
          newRoutine,
          tags.map((tag) => tag.tag),
          exercises.map((exercise) => ({
            exerciseId: exercise.exerciseId,
            order: exercise.order,
            defaults: defaults.find((item) => item.exerciseId === exercise.exerciseId)
          }))
        )
      });
    }
  );
  return newRoutine;
}

export async function reorderRoutine(routineId: string, direction: 'up' | 'down') {
  const routines = await listRoutines();
  const index = routines.findIndex((routine) => routine.id === routineId);
  if (index === -1) return;
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= routines.length) return;
  const current = routines[index];
  const swap = routines[swapIndex];
  await db.transaction('rw', db.routines, async () => {
    await db.routines.update(current.id, { order: swap.order });
    await db.routines.update(swap.id, { order: current.order });
  });
}

export async function addRoutineExercise(routineId: string, exerciseId: string) {
  const canonicalExerciseId = resolveCanonicalExerciseId(exerciseId);
  const routine = await db.routines.get(routineId);
  if (!routine || routine.deletedAt) return;
  const existing = await db.routineExercises
    .where({ routineId, exerciseId: canonicalExerciseId })
    .first();
  if (existing) return;
  const last = await db.routineExercises.where('routineId').equals(routineId).last();
  const order = last ? last.order + 1 : 0;
  await db.transaction('rw', db.routineExercises, db.routines, async () => {
    await db.routineExercises.add({
      id: `routine-exercise-${crypto.randomUUID()}`,
      routineId,
      exerciseId: canonicalExerciseId,
      order
    });
    await db.routines.update(routineId, {
      updatedAt: new Date().toISOString()
    });
  });
}

export async function removeRoutineExercise(routineId: string, exerciseId: string) {
  const canonicalExerciseId = resolveCanonicalExerciseId(exerciseId);
  const routine = await db.routines.get(routineId);
  if (!routine || routine.deletedAt) return;
  const entry = await db.routineExercises.where({ routineId, exerciseId: canonicalExerciseId }).first();
  if (!entry) return;
  const now = new Date().toISOString();
  await db.transaction('rw', db.routineExercises, db.exerciseDefaults, db.routines, async () => {
    await db.routineExercises.delete(entry.id);
    await db.exerciseDefaults.where({ routineId, exerciseId: canonicalExerciseId }).delete();
    await db.routines.update(routineId, {
      updatedAt: now
    });
  });
}

export async function reorderRoutineExercise(
  routineId: string,
  exerciseId: string,
  direction: 'up' | 'down'
) {
  const canonicalExerciseId = resolveCanonicalExerciseId(exerciseId);
  const routine = await db.routines.get(routineId);
  if (!routine || routine.deletedAt) return;
  const exercises = await db.routineExercises.where('routineId').equals(routineId).sortBy('order');
  const index = exercises.findIndex((item) => item.exerciseId === canonicalExerciseId);
  if (index === -1) return;
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= exercises.length) return;
  const current = exercises[index];
  const swap = exercises[swapIndex];
  await db.transaction('rw', db.routineExercises, db.routines, async () => {
    await db.routineExercises.update(current.id, { order: swap.order });
    await db.routineExercises.update(swap.id, { order: current.order });
    await db.routines.update(routineId, {
      updatedAt: new Date().toISOString()
    });
  });
}

export async function updateExerciseDefaults({
  routineId,
  exerciseId,
  defaultReps,
  defaultSets,
  defaultSetTypes,
  defaultWeight,
  defaultDuration,
  defaultDistance,
  defaultRestSeconds,
  goalMode,
  metricTypeOverride
}: {
  routineId: string;
  exerciseId: string;
  metricTypeOverride?: ExerciseMetric;
  defaultSetTypes?: AdvancedSetType[];
  defaultSets?: number;
  defaultReps?: number;
  defaultWeight?: number;
  defaultDuration?: number;
  defaultDistance?: number;
  defaultRestSeconds?: number;
  goalMode?: ExerciseGoalMode;
}) {
  const canonicalExerciseId = resolveCanonicalExerciseId(exerciseId);
  const routine = await db.routines.get(routineId);
  if (!routine || routine.deletedAt) return;
  const existing = await db.exerciseDefaults.where({ routineId, exerciseId: canonicalExerciseId }).first();
  const now = new Date().toISOString();
  const payload = {
    id: existing?.id ?? `default-${crypto.randomUUID()}`,
    routineId,
    exerciseId: canonicalExerciseId,
    metricTypeOverride,
    defaultSetTypes:
      defaultSetTypes || defaultSets
        ? normalizeSetTypeArray(
            defaultSetTypes ?? existing?.defaultSetTypes,
            defaultSets ?? existing?.defaultSets ?? 0
          )
        : undefined,
    defaultSets,
    defaultReps,
    defaultWeight,
    defaultDuration,
    defaultDistance,
    defaultRestSeconds,
    goalMode
  };
  await db.transaction('rw', db.exerciseDefaults, db.routines, async () => {
    await db.exerciseDefaults.put(payload);
    await db.routines.update(routineId, {
      updatedAt: now
    });
  });
}

export async function getRoutineDetail(routineId: string) {
  const routine = await db.routines.get(routineId);
  if (!routine || routine.deletedAt) return null;
  const tags = await db.routineTags.where('routineId').equals(routineId).toArray();
  const exercises = await db.routineExercises.where('routineId').equals(routineId).sortBy('order');
  const defaults = await db.exerciseDefaults.where('routineId').equals(routineId).toArray();
  return {
    routine,
    tags: tags.map((tag) => tag.tag),
    exercises,
    defaults
  };
}
