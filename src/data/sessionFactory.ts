import {
  ActivePlannedOccurrenceRef,
  ActiveWorkoutSession
} from './activeSession';
import { getExerciseDisplayName, listExercises } from './exercises';
import { applyProgressionSuggestions, applySuggestedPrescription } from './progression';
import { getRoutineDetail } from './routines';
import {
  getLatestExerciseSets,
  getLastWorkoutForRoutine,
  getWorkoutExercises,
  getWorkoutSets,
  listProgressionExerciseSessions
} from './workouts';
import { getSetTypeAtIndex } from './setTypes';

interface BuildRoutineSessionOptions {
  routineId: string;
  language: 'es';
  plannedOccurrence?: ActivePlannedOccurrenceRef;
}

export async function buildRoutineSession({
  routineId,
  language,
  plannedOccurrence
}: BuildRoutineSessionOptions) {
  const detail = await getRoutineDetail(routineId);
  if (!detail) return null;

  const exercises = await listExercises();
  const exerciseMap = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const lastWorkout = await getLastWorkoutForRoutine(routineId);
  const previousNotesByExercise = new Map<string, string>();

  const session: ActiveWorkoutSession = {
    id: `session-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    routineId,
    routineName: detail.routine.name,
    tags: detail.tags,
    originalExerciseIds: detail.exercises.map((entry) => entry.exerciseId),
    plannedOccurrence,
    exercises: detail.exercises.map((entry) => {
      const exercise = exerciseMap.get(entry.exerciseId);
      const defaults = detail.defaults.find((item) => item.exerciseId === entry.exerciseId);
      const setsCount = defaults?.defaultSets ?? 3;
      const sets = Array.from({ length: setsCount }, (_, setIndex) => ({
        setType: getSetTypeAtIndex(defaults?.defaultSetTypes, setIndex),
        weight: defaults?.defaultWeight,
        reps: defaults?.defaultReps,
        duration: defaults?.defaultDuration,
        distance: defaults?.defaultDistance,
        completed: false
      }));
      return {
        exerciseId: entry.exerciseId,
        name: exercise ? getExerciseDisplayName(exercise, language) : 'Ejercicio',
        metricType: defaults?.metricTypeOverride ?? exercise?.metricType ?? 'weight_reps',
        catalogMetricType: exercise?.metricType ?? 'weight_reps',
        originalMetricType: defaults?.metricTypeOverride ?? exercise?.metricType ?? 'weight_reps',
        originalSetTypes: Array.from({ length: setsCount }, (_, setIndex) =>
          getSetTypeAtIndex(defaults?.defaultSetTypes, setIndex)
        ),
        goalMode: defaults?.goalMode ?? 'auto',
        notes: '',
        restSeconds: defaults?.defaultRestSeconds ?? 0,
        equipment: exercise?.equipment ?? [],
        previousSets: [],
        sets
      };
    })
  };

  const previousSetsByExercise = new Map<
    string,
    Array<{ weight?: number; reps?: number; duration?: number; distance?: number }>
  >();
  const workoutExerciseMap = new Map<
    string,
    Array<{ weight?: number; reps?: number; duration?: number; distance?: number }>
  >();

  if (lastWorkout) {
    const workoutExercises = await getWorkoutExercises(lastWorkout.id);
    for (const workoutExercise of workoutExercises) {
      const sets = await getWorkoutSets(workoutExercise.id);
      workoutExerciseMap.set(
        workoutExercise.exerciseId,
        sets.map((set) => ({
          weight: set.weight,
          reps: set.reps,
          duration: set.duration,
          distance: set.distance
        }))
      );
      if (workoutExercise.notes) {
        previousNotesByExercise.set(workoutExercise.exerciseId, workoutExercise.notes);
      }
    }
  }

  for (const entry of detail.exercises) {
    let sets = workoutExerciseMap.get(entry.exerciseId) ?? [];
    if (!sets.length) {
      const latestSets = await getLatestExerciseSets(entry.exerciseId);
      sets = latestSets.map((set) => ({
        weight: set.weight,
        reps: set.reps,
        duration: set.duration,
        distance: set.distance
      }));
    }
    previousSetsByExercise.set(entry.exerciseId, sets);
  }

  session.exercises = await Promise.all(
    session.exercises.map(async (exercise) => {
      const nextExercise = {
        ...exercise,
        previousSets: previousSetsByExercise.get(exercise.exerciseId) ?? [],
        notes: previousNotesByExercise.get(exercise.exerciseId) ?? exercise.notes
      };
      const history = await listProgressionExerciseSessions(exercise.exerciseId, 2);
      return applySuggestedPrescription(applyProgressionSuggestions(nextExercise, history));
    })
  );

  return session;
}
