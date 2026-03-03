import { ActiveWorkoutSession } from './activeSession';
import { db, WorkoutExerciseRecord, WorkoutRecord, WorkoutSetRecord } from './db';

export type WorkoutSessionPayload = ActiveWorkoutSession;

export interface CompletedExerciseSession {
  workoutId: string;
  routineId: string | undefined;
  routineName: string;
  startedAt: string;
  endedAt: string;
  sets: WorkoutSetRecord[];
}

export async function saveWorkout(session: WorkoutSessionPayload) {
  const endedAt = new Date().toISOString();
  const routineName =
    session.routineName ?? (session.routineId ? undefined : 'Ejercicio Individual');
  const workout: WorkoutRecord = {
    id: session.id,
    routineId: session.routineId,
    routineName,
    tags: session.tags ?? [],
    startedAt: session.createdAt,
    endedAt,
    updatedAt: endedAt
  };

  const exerciseRecords: WorkoutExerciseRecord[] = [];
  const setRecords: WorkoutSetRecord[] = [];
  let completedSets = 0;

  session.exercises.forEach((exercise, exerciseIndex) => {
    const workoutExerciseId = `workout-exercise-${crypto.randomUUID()}`;
    exerciseRecords.push({
      id: workoutExerciseId,
      workoutId: session.id,
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      order: exerciseIndex,
      notes: exercise.notes
    });
    exercise.sets.forEach((set, setIndex) => {
      if (!set.completed) return;
      completedSets += 1;
      setRecords.push({
        id: `workout-set-${crypto.randomUUID()}`,
        workoutExerciseId,
        order: setIndex,
        weight: set.weight,
        reps: set.reps,
        duration: set.duration,
        distance: set.distance,
        rpe: set.rpe,
        completed: Boolean(set.completed)
      });
    });
  });

  if (completedSets === 0) {
    return;
  }

  await db.transaction('rw', [db.workouts, db.workoutExercises, db.workoutSets], async () => {
    await db.workouts.add(workout);
    if (exerciseRecords.length) {
      await db.workoutExercises.bulkAdd(exerciseRecords);
    }
    if (setRecords.length) {
      await db.workoutSets.bulkAdd(setRecords);
    }
  });
}

export async function listRecentWorkouts(limit = 8) {
  const workouts = await db.workouts.orderBy('endedAt').reverse().toArray();
  return workouts.filter((workout) => !workout.deletedAt).slice(0, limit);
}

export async function listAllWorkouts() {
  const workouts = await db.workouts.orderBy('endedAt').reverse().toArray();
  return workouts.filter((workout) => !workout.deletedAt);
}

export async function listWorkoutsSince(sinceIso: string) {
  const workouts = await db.workouts.where('endedAt').aboveOrEqual(sinceIso).toArray();
  return workouts.filter((workout) => !workout.deletedAt);
}

export async function getWorkoutById(workoutId: string) {
  const workout = await db.workouts.get(workoutId);
  if (!workout || workout.deletedAt) return undefined;
  return workout;
}

export async function getLastWorkoutForRoutine(routineId: string) {
  const workouts = await db.workouts.where('routineId').equals(routineId).toArray();
  const activeWorkouts = workouts.filter((workout) => !workout.deletedAt);
  if (!activeWorkouts.length) return undefined;
  return activeWorkouts.reduce((latest, current) =>
    new Date(current.endedAt).getTime() > new Date(latest.endedAt).getTime()
      ? current
      : latest
  );
}

export async function getWorkoutExercises(workoutId: string) {
  return db.workoutExercises.where('workoutId').equals(workoutId).sortBy('order');
}

export async function getWorkoutSets(workoutExerciseId: string) {
  return db.workoutSets.where('workoutExerciseId').equals(workoutExerciseId).sortBy('order');
}

export async function getLatestExerciseSets(exerciseId: string) {
  const workoutExercise = await db.workoutExercises
    .where('exerciseId')
    .equals(exerciseId)
    .reverse()
    .first();
  if (!workoutExercise) return [];
  return getWorkoutSets(workoutExercise.id);
}

export async function listExerciseHistory(exerciseId: string) {
  const workoutExercises = await db.workoutExercises
    .where('exerciseId')
    .equals(exerciseId)
    .toArray();
  if (!workoutExercises.length) return [];
  const workoutIds = Array.from(new Set(workoutExercises.map((exercise) => exercise.workoutId)));
  const workouts = await db.workouts.where('id').anyOf(workoutIds).toArray();
  const workoutMap = new Map(
    workouts.filter((workout) => !workout.deletedAt).map((workout) => [workout.id, workout])
  );
  const entries = await Promise.all(
    workoutExercises.map(async (exercise) => {
      const workout = workoutMap.get(exercise.workoutId);
      if (!workout) return null;
      const sets = await getWorkoutSets(exercise.id);
      return {
        workoutId: exercise.workoutId,
        routineName: workout?.routineName ?? 'Entreno',
        startedAt: workout?.startedAt ?? '',
        endedAt: workout?.endedAt ?? '',
        notes: exercise.notes,
        sets
      };
    })
  );
  return entries
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt));
}

export async function listCompletedExerciseSessions(exerciseId: string, limit = 3) {
  const workoutExercises = await db.workoutExercises.where('exerciseId').equals(exerciseId).toArray();
  if (!workoutExercises.length) return [] as CompletedExerciseSession[];

  const grouped = workoutExercises.reduce<Map<string, WorkoutExerciseRecord[]>>((acc, exercise) => {
    const current = acc.get(exercise.workoutId) ?? [];
    current.push(exercise);
    acc.set(exercise.workoutId, current);
    return acc;
  }, new Map());

  const workouts = await db.workouts.where('id').anyOf(Array.from(grouped.keys())).toArray();
  const workoutMap = new Map(
    workouts.filter((workout) => !workout.deletedAt).map((workout) => [workout.id, workout])
  );

  const entries = await Promise.all(
    Array.from(grouped.entries()).map(async ([workoutId, exerciseEntries]) => {
      const workout = workoutMap.get(workoutId);
      if (!workout) return null;
      const ordered = [...exerciseEntries].sort((a, b) => a.order - b.order);
      const sets = (
        await Promise.all(
          ordered.map(async (exercise) => {
            const exerciseSets = await getWorkoutSets(exercise.id);
            return exerciseSets.filter((set) => set.completed);
          })
        )
      ).flat();
      if (!sets.length) return null;
      return {
        workoutId,
        routineId: workout.routineId,
        routineName: workout.routineName ?? 'Entreno',
        startedAt: workout.startedAt,
        endedAt: workout.endedAt,
        sets
      };
    })
  );

  const filtered = entries.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  return filtered.sort((a, b) => b.endedAt.localeCompare(a.endedAt)).slice(0, limit);
}
