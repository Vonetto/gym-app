import { ExerciseGoalMode, ExerciseMetric } from './db';

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
    return JSON.parse(stored) as ActiveWorkoutSession;
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
