import { AdvancedSetType, ExerciseGoalMode, ExerciseMetric } from './db';
import { DEFAULT_SET_TYPE, normalizeSetType } from './setTypes';

export const ACTIVE_SESSION_STORAGE_KEY = 'active-session';

export interface PreviousWorkoutSetValues {
  weight?: number;
  reps?: number;
  duration?: number;
  distance?: number;
}

export interface SetSuggestion {
  values: {
    weight?: number;
    reps?: number;
    duration?: number;
    distance?: number;
  };
  label: string;
  explanation: string;
  status?: 'pending' | 'accepted' | 'ignored';
}

export interface ActiveWorkoutSet {
  setType?: AdvancedSetType;
  weight?: number;
  reps?: number;
  duration?: number;
  distance?: number;
  rpe?: number;
  completed?: boolean;
  suggestion?: SetSuggestion;
}

export interface ActiveWorkoutExercise {
  exerciseId: string;
  name: string;
  metricType: ExerciseMetric;
  catalogMetricType?: ExerciseMetric;
  originalMetricType?: ExerciseMetric;
  originalSetTypes?: AdvancedSetType[];
  goalMode?: ExerciseGoalMode;
  notes?: string;
  previousSets?: PreviousWorkoutSetValues[];
  restSeconds?: number;
  equipment?: string[];
  suggestionExplanation?: string;
  sets: ActiveWorkoutSet[];
}

export interface ActiveSessionRestTimer {
  endAt: string;
  totalSeconds: number;
  exerciseName: string;
}

export interface ActiveWorkoutSession {
  id: string;
  createdAt: string;
  routineId?: string;
  routineName?: string;
  tags?: string[];
  originalExerciseIds?: string[];
  restTimers?: Record<string, ActiveSessionRestTimer>;
  exercises: ActiveWorkoutExercise[];
}

export function emitActiveSessionChange() {
  window.dispatchEvent(new Event('active-session'));
}

export function readActiveSession() {
  const stored = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as ActiveWorkoutSession;
    return {
      ...parsed,
      exercises: (parsed.exercises ?? []).map((exercise) => ({
        ...exercise,
        originalSetTypes: (exercise.originalSetTypes ?? []).map((setType) =>
          normalizeSetType(setType ?? DEFAULT_SET_TYPE)
        ),
        sets: (exercise.sets ?? []).map((set) => ({
          ...set,
          setType: normalizeSetType(set.setType ?? DEFAULT_SET_TYPE)
        }))
      }))
    } as ActiveWorkoutSession;
  } catch {
    return null;
  }
}

export function writeActiveSession(session: ActiveWorkoutSession) {
  localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(session));
  emitActiveSessionChange();
}

export function clearActiveSession() {
  localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
  emitActiveSessionChange();
}
