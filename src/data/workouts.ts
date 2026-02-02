import { db, WorkoutExerciseRecord, WorkoutRecord, WorkoutSetRecord } from './db';

export interface WorkoutSessionPayload {
  id: string;
  createdAt: string;
  routineId?: string;
  routineName?: string;
  tags?: string[];
  exercises: Array<{
    exerciseId: string;
    name: string;
    metricType: string;
    notes?: string;
    restSeconds?: number;
    sets: Array<{
      weight?: number;
      reps?: number;
      duration?: number;
      distance?: number;
      rpe?: number;
      completed?: boolean;
    }>;
  }>;
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
    endedAt
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
  const workouts = await db.workouts.orderBy('endedAt').reverse().limit(limit).toArray();
  return workouts;
}

export async function listAllWorkouts() {
  return db.workouts.orderBy('endedAt').reverse().toArray();
}

export async function listWorkoutsSince(sinceIso: string) {
  return db.workouts.where('endedAt').aboveOrEqual(sinceIso).toArray();
}

export async function getWorkoutById(workoutId: string) {
  return db.workouts.get(workoutId);
}

export async function getLastWorkoutForRoutine(routineId: string) {
  const workouts = await db.workouts.where('routineId').equals(routineId).toArray();
  if (!workouts.length) return undefined;
  return workouts.reduce((latest, current) =>
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
