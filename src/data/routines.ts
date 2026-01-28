import { db, RoutineRecord, RoutineVersionRecord } from './db';

export interface RoutineSnapshot {
  routine: RoutineRecord;
  tags: string[];
  exercises: Array<{
    exerciseId: string;
    order: number;
    defaults?: {
      defaultSets?: number;
      defaultReps?: number;
      defaultWeight?: number;
      defaultDuration?: number;
      defaultDistance?: number;
      defaultRestSeconds?: number;
    };
  }>;
}

function buildRoutineSnapshot(routine: RoutineRecord, tags: string[], exercises: RoutineSnapshot['exercises']) {
  return JSON.stringify({ routine, tags, exercises });
}

export async function listRoutines() {
  return db.routines.orderBy('order').toArray();
}

export async function createRoutine(name: string, tags: string[]) {
  const now = new Date().toISOString();
  const lastOrder = await db.routines.orderBy('order').last();
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
  if (!routine) return;
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

export async function deleteRoutine(routineId: string) {
  await db.transaction(
    'rw',
    [db.routines, db.routineTags, db.routineExercises, db.exerciseDefaults, db.routineVersions],
    async () => {
      await db.routines.delete(routineId);
      await db.routineTags.where('routineId').equals(routineId).delete();
      await db.routineExercises.where('routineId').equals(routineId).delete();
      await db.exerciseDefaults.where('routineId').equals(routineId).delete();
      await db.routineVersions.where('routineId').equals(routineId).delete();
    }
  );
}

export async function duplicateRoutine(routineId: string) {
  const routine = await db.routines.get(routineId);
  if (!routine) return;
  const tags = await db.routineTags.where('routineId').equals(routineId).toArray();
  const exercises = await db.routineExercises.where('routineId').equals(routineId).toArray();
  const defaults = await db.exerciseDefaults.where('routineId').equals(routineId).toArray();
  const now = new Date().toISOString();
  const lastOrder = await db.routines.orderBy('order').last();
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
            defaultReps: item.defaultReps,
            defaultWeight: item.defaultWeight,
            defaultDuration: item.defaultDuration,
            defaultDistance: item.defaultDistance,
            defaultRestSeconds: item.defaultRestSeconds
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
  const routines = await db.routines.orderBy('order').toArray();
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
  const existing = await db.routineExercises
    .where({ routineId, exerciseId })
    .first();
  if (existing) return;
  const last = await db.routineExercises.where('routineId').equals(routineId).last();
  const order = last ? last.order + 1 : 0;
  await db.routineExercises.add({
    id: `routine-exercise-${crypto.randomUUID()}`,
    routineId,
    exerciseId,
    order
  });
}

export async function removeRoutineExercise(routineId: string, exerciseId: string) {
  const entry = await db.routineExercises.where({ routineId, exerciseId }).first();
  if (!entry) return;
  await db.routineExercises.delete(entry.id);
  await db.exerciseDefaults.where({ routineId, exerciseId }).delete();
}

export async function reorderRoutineExercise(
  routineId: string,
  exerciseId: string,
  direction: 'up' | 'down'
) {
  const exercises = await db.routineExercises.where('routineId').equals(routineId).sortBy('order');
  const index = exercises.findIndex((item) => item.exerciseId === exerciseId);
  if (index === -1) return;
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= exercises.length) return;
  const current = exercises[index];
  const swap = exercises[swapIndex];
  await db.transaction('rw', db.routineExercises, async () => {
    await db.routineExercises.update(current.id, { order: swap.order });
    await db.routineExercises.update(swap.id, { order: current.order });
  });
}

export async function updateExerciseDefaults({
  routineId,
  exerciseId,
  defaultReps,
  defaultSets,
  defaultWeight,
  defaultDuration,
  defaultDistance,
  defaultRestSeconds
}: {
  routineId: string;
  exerciseId: string;
  defaultSets?: number;
  defaultReps?: number;
  defaultWeight?: number;
  defaultDuration?: number;
  defaultDistance?: number;
  defaultRestSeconds?: number;
}) {
  const existing = await db.exerciseDefaults.where({ routineId, exerciseId }).first();
  const payload = {
    id: existing?.id ?? `default-${crypto.randomUUID()}`,
    routineId,
    exerciseId,
    defaultSets,
    defaultReps,
    defaultWeight,
    defaultDuration,
    defaultDistance,
    defaultRestSeconds
  };
  await db.exerciseDefaults.put(payload);
}

export async function getRoutineDetail(routineId: string) {
  const routine = await db.routines.get(routineId);
  if (!routine) return null;
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
