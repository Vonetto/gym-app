import {
  ActiveWorkoutExercise,
  ActiveWorkoutSet,
  PreviousWorkoutSetValues,
  SetSuggestion
} from './activeSession';
import { ExerciseGoalMode } from './db';
import { CompletedExerciseSession } from './workouts';
import { countsForProgression } from './setTypes';

const BIG_INCREMENT_EQUIPMENT = ['barbell', 'sz-bar', 'machine', 'cable'];
const SMALL_INCREMENT_EQUIPMENT = [
  'dumbbell',
  'kettlebell',
  'resistance band',
  'pull-up bar',
  'none (bodyweight exercise)'
];

function roundToStep(value: number, step: number) {
  const rounded = Math.round(value / step) * step;
  return Number(rounded.toFixed(step < 1 ? 2 : 1));
}

function getWeightStep(equipment: string[] = []) {
  const normalized = equipment.map((item) => item.toLowerCase());
  if (normalized.some((item) => SMALL_INCREMENT_EQUIPMENT.includes(item))) {
    return 1;
  }
  if (normalized.some((item) => BIG_INCREMENT_EQUIPMENT.includes(item))) {
    return 2.5;
  }
  return 2.5;
}

function getIncreasePercent(goalMode: ExerciseGoalMode, equipment: string[] = []) {
  const normalized = equipment.map((item) => item.toLowerCase());
  if (goalMode === 'strength') return 0.05;
  if (goalMode === 'endurance') return 0.03;
  if (normalized.some((item) => SMALL_INCREMENT_EQUIPMENT.includes(item))) {
    return 0.04;
  }
  return 0.05;
}

function buildIncreaseWeight(currentWeight: number, goalMode: ExerciseGoalMode, equipment: string[] = []) {
  const step = getWeightStep(equipment);
  const increased = roundToStep(currentWeight * (1 + getIncreasePercent(goalMode, equipment)), step);
  if (increased > currentWeight) return increased;
  return Number((currentWeight + step).toFixed(step < 1 ? 2 : 1));
}

function matchesSuggestedValues(
  current: ActiveWorkoutSet | PreviousWorkoutSetValues | undefined,
  suggestion: SetSuggestion
) {
  return (
    current?.weight === suggestion.values.weight &&
    current?.reps === suggestion.values.reps &&
    current?.duration === suggestion.values.duration &&
    current?.distance === suggestion.values.distance
  );
}

function inferGoalModeFromReps(targetReps?: number): ExerciseGoalMode {
  if (!targetReps || targetReps <= 5) return 'strength';
  if (targetReps <= 12) return 'hypertrophy';
  return 'endurance';
}

function resolveGoalMode(goalMode: ExerciseGoalMode | undefined, targetReps?: number): ExerciseGoalMode {
  if (!goalMode || goalMode === 'auto') {
    return inferGoalModeFromReps(targetReps);
  }
  return goalMode;
}

function getRepCap(goalMode: ExerciseGoalMode, targetReps: number) {
  if (goalMode === 'strength') return Math.max(targetReps, 5);
  if (goalMode === 'endurance') return Math.max(targetReps, 20);
  return Math.max(targetReps, 12);
}

function formatWeightDelta(currentWeight: number, nextWeight: number) {
  const delta = Number((nextWeight - currentWeight).toFixed(1));
  return delta > 0 ? `+${delta}` : '=';
}

function formatRepDelta(currentReps: number, nextReps: number) {
  const delta = nextReps - currentReps;
  return delta > 0 ? `+${delta}r` : '=';
}

function formatWeightLabel(weight: number) {
  return `${Number(weight.toFixed(1))}kg`;
}

function createSuggestion(
  set: ActiveWorkoutSet,
  values: SetSuggestion['values'],
  label: string,
  explanation: string
): ActiveWorkoutSet {
  return {
    ...set,
    suggestion: {
      values,
      label,
      explanation,
      status: 'pending'
    }
  };
}

interface WeightRepsSessionSummary {
  weight?: number;
  targetReps: number;
  metCount: number;
  completedCount: number;
  totalSets: number;
  allMet: boolean;
  atCap: boolean;
}

interface SingleMetricSessionSummary {
  target: number;
  metCount: number;
  completedCount: number;
  totalSets: number;
  allMet: boolean;
}

function getBaseTargetReps(exercise: ActiveWorkoutExercise, latest?: CompletedExerciseSession) {
  const currentReps = exercise.sets
    .filter((set) => countsForProgression(set.setType))
    .map((set) => set.reps)
    .filter((value): value is number => value !== undefined && value > 0);
  if (currentReps.length) {
    return Math.min(...currentReps);
  }

  const previousReps = (exercise.previousSets ?? [])
    .map((set) => set.reps)
    .filter((value): value is number => value !== undefined && value > 0);
  if (previousReps.length) {
    return Math.min(...previousReps);
  }

  const latestReps = (latest?.sets ?? [])
    .map((set) => set.reps)
    .filter((value): value is number => value !== undefined && value > 0);
  if (latestReps.length) {
    return Math.min(...latestReps);
  }

  return undefined;
}

function getRepresentativeWeight(sets: CompletedExerciseSession['sets']) {
  const positives = sets
    .map((set) => set.weight)
    .filter((value): value is number => value !== undefined && value > 0);
  if (!positives.length) {
    return undefined;
  }

  const counts = new Map<number, number>();
  positives.forEach((value) => {
    const normalized = Number(value.toFixed(1));
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });

  let selected = positives[0];
  let selectedCount = counts.get(Number(selected.toFixed(1))) ?? 0;
  counts.forEach((count, weight) => {
    if (count > selectedCount || (count === selectedCount && weight > selected)) {
      selected = weight;
      selectedCount = count;
    }
  });

  return selected;
}

function getBaseMetricTarget(
  exercise: ActiveWorkoutExercise,
  field: 'reps' | 'duration' | 'distance',
  latest?: CompletedExerciseSession
) {
  const currentValues = exercise.sets
    .filter((set) => countsForProgression(set.setType))
    .map((set) => set[field])
    .filter((value): value is number => value !== undefined && value > 0);
  if (currentValues.length) {
    return Math.min(...currentValues);
  }

  const previousValues = (exercise.previousSets ?? [])
    .map((set) => set[field])
    .filter((value): value is number => value !== undefined && value > 0);
  if (previousValues.length) {
    return Math.min(...previousValues);
  }

  const latestValues = (latest?.sets ?? [])
    .map((set) => set[field])
    .filter((value): value is number => value !== undefined && value > 0);
  if (latestValues.length) {
    return Math.min(...latestValues);
  }

  return undefined;
}

function summarizeSingleMetricSession(
  sets: CompletedExerciseSession['sets'],
  field: 'reps' | 'duration' | 'distance',
  baseTarget: number,
  plannedSetCount: number
): SingleMetricSessionSummary {
  const consideredSets = sets.slice(0, plannedSetCount);
  const actualValues = consideredSets
    .map((set) => set[field])
    .filter((value): value is number => value !== undefined && value > 0);
  const workingTarget = actualValues.length
    ? Math.max(baseTarget, Math.max(...actualValues))
    : baseTarget;
  const completedCount = actualValues.length;
  const metCount = consideredSets.filter((set) => {
    const value = set[field];
    return value !== undefined && value >= workingTarget;
  }).length;

  return {
    target: workingTarget,
    metCount,
    completedCount,
    totalSets: plannedSetCount,
    allMet: completedCount >= plannedSetCount && metCount >= plannedSetCount
  };
}

function shouldTreatWeightRepsAsBodyweight(
  exercise: ActiveWorkoutExercise,
  history: CompletedExerciseSession[]
) {
  const weights = [
    ...exercise.sets.filter((set) => countsForProgression(set.setType)).map((set) => set.weight),
    ...(exercise.previousSets ?? []).map((set) => set.weight),
    ...history.flatMap((session) => session.sets.map((set) => set.weight))
  ].filter((value): value is number => value !== undefined);

  return weights.length > 0 && weights.every((value) => value <= 0);
}

function getTimeStepSeconds(targetSeconds: number) {
  if (targetSeconds < 60) return 10;
  if (targetSeconds < 180) return 15;
  return 30;
}

function getDistanceStepMeters(targetMeters: number) {
  if (targetMeters < 400) return 50;
  if (targetMeters < 2000) return 100;
  return 200;
}

function formatDurationValue(seconds: number) {
  if (seconds % 60 === 0) {
    return `${seconds / 60}m`;
  }
  if (seconds > 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
  return `${seconds}s`;
}

function formatDurationDelta(currentSeconds: number, nextSeconds: number) {
  const delta = nextSeconds - currentSeconds;
  return delta > 0 ? `+${delta}s` : `${nextSeconds}s`;
}

function formatDistanceDelta(currentMeters: number, nextMeters: number) {
  const delta = nextMeters - currentMeters;
  return delta > 0 ? `+${delta}m` : `${nextMeters}m`;
}

function summarizeWeightRepsSession(
  sets: CompletedExerciseSession['sets'],
  baseTargetReps: number,
  plannedSetCount: number,
  repCap: number
): WeightRepsSessionSummary {
  const consideredSets = sets.slice(0, plannedSetCount);
  const representativeWeight = getRepresentativeWeight(consideredSets);
  const actualReps = consideredSets
    .map((set) => set.reps)
    .filter((value): value is number => value !== undefined && value >= 0);
  const workingTargetReps = actualReps.length
    ? Math.max(baseTargetReps, Math.max(...actualReps))
    : baseTargetReps;

  const completedCount = consideredSets.filter(
    (set) => set.reps !== undefined && set.weight !== undefined && set.weight > 0
  ).length;
  const metCount = representativeWeight === undefined
    ? 0
    : consideredSets.filter(
        (set) =>
          set.reps !== undefined &&
          set.reps >= workingTargetReps &&
          set.weight !== undefined &&
          Math.abs(set.weight - representativeWeight) < 0.001
      ).length;

  return {
    weight: representativeWeight,
    targetReps: workingTargetReps,
    metCount,
    completedCount,
    totalSets: plannedSetCount,
    allMet: completedCount >= plannedSetCount && metCount >= plannedSetCount,
    atCap: completedCount >= plannedSetCount && metCount >= plannedSetCount && workingTargetReps >= repCap
  };
}

function applyUniformSuggestion(
  exercise: ActiveWorkoutExercise,
  values: SetSuggestion['values'],
  label: string,
  explanation: string
) {
  const sets = exercise.sets.map((set) =>
    countsForProgression(set.setType)
      ? createSuggestion(set, values, label, explanation)
      : { ...set, suggestion: undefined }
  );
  return {
    ...exercise,
    suggestionExplanation: explanation,
    sets
  };
}

function buildWeightRepsSuggestions(
  exercise: ActiveWorkoutExercise,
  history: CompletedExerciseSession[]
) {
  const latest = history[0];
  if (!latest?.sets.length) {
    return exercise;
  }

  const baseTargetReps = getBaseTargetReps(exercise, latest);
  if (baseTargetReps === undefined) {
    return exercise;
  }

  const plannedSetCount =
    exercise.sets.filter((set) => countsForProgression(set.setType)).length || exercise.sets.length;
  const resolvedGoalMode = resolveGoalMode(exercise.goalMode, baseTargetReps);
  const repCap = getRepCap(resolvedGoalMode, baseTargetReps);
  const latestSummary = summarizeWeightRepsSession(
    latest.sets,
    baseTargetReps,
    plannedSetCount,
    repCap
  );
  const previous = history[1];
  const previousSummary = previous
    ? summarizeWeightRepsSession(previous.sets, baseTargetReps, plannedSetCount, repCap)
    : undefined;

  if (latestSummary.weight === undefined) {
    return exercise;
  }

  const sameWeight =
    previousSummary?.weight !== undefined &&
    Math.abs(previousSummary.weight - latestSummary.weight) < 0.001;
  const heavierThanPrevious =
    previousSummary?.weight !== undefined &&
    latestSummary.weight > previousSummary.weight + 0.001;
  const partialFail =
    latestSummary.metCount > 0 && latestSummary.metCount < latestSummary.totalSets;
  const nearMiss =
    partialFail && latestSummary.metCount === latestSummary.totalSets - 1;

  if (heavierThanPrevious) {
    if (latestSummary.allMet) {
      if (latestSummary.targetReps < repCap) {
        const nextTarget = latestSummary.targetReps + 1;
        return applyUniformSuggestion(
          exercise,
          { weight: latestSummary.weight, reps: nextTarget },
          formatRepDelta(latestSummary.targetReps, nextTarget),
          `Progreso válido: consolidaste ${latestSummary.weight} kg. Ahora busca ${nextTarget} reps en todas las series.`
        );
      }

      return applyUniformSuggestion(
        exercise,
        { weight: latestSummary.weight, reps: latestSummary.targetReps },
        `${formatWeightLabel(latestSummary.weight)} x ${latestSummary.targetReps}`,
        `Consolida ${latestSummary.weight} kg con ${latestSummary.targetReps} reps antes de volver a subir carga.`
      );
    }

    if (nearMiss || partialFail) {
      return applyUniformSuggestion(
        exercise,
        { weight: latestSummary.weight, reps: latestSummary.targetReps },
        `${formatWeightLabel(latestSummary.weight)} x ${latestSummary.targetReps}`,
        `Fallo parcial: cerraste ${latestSummary.metCount}/${latestSummary.totalSets} series. Repite ${latestSummary.weight} kg con ${latestSummary.targetReps} reps hasta completar todas.`
      );
    }

    if (previousSummary?.weight !== undefined) {
      return applyUniformSuggestion(
        exercise,
        { weight: previousSummary.weight, reps: previousSummary.targetReps },
        `${formatWeightLabel(previousSummary.weight)} x ${previousSummary.targetReps}`,
        'El salto fue demasiado grande; vuelve a tu base anterior y reconstruye desde ahí.'
      );
    }
  }

  if (latestSummary.allMet) {
    if (
      sameWeight &&
      previousSummary?.allMet &&
      latestSummary.atCap &&
      previousSummary.atCap
    ) {
      const nextWeight = buildIncreaseWeight(latestSummary.weight, resolvedGoalMode, exercise.equipment);
      return applyUniformSuggestion(
        exercise,
        { weight: nextWeight, reps: baseTargetReps },
        formatWeightDelta(latestSummary.weight, nextWeight),
        `Cumpliste el tope del rango dos sesiones seguidas. Sube a ${nextWeight} kg y vuelve a ${baseTargetReps} reps.`
      );
    }

    if (latestSummary.targetReps < repCap) {
      const nextTarget = latestSummary.targetReps + 1;
      return applyUniformSuggestion(
        exercise,
        { weight: latestSummary.weight, reps: nextTarget },
        formatRepDelta(latestSummary.targetReps, nextTarget),
        `Sesión sólida. Mantén ${latestSummary.weight} kg y busca ${nextTarget} reps en todas las series.`
      );
    }

    return applyUniformSuggestion(
      exercise,
      { weight: latestSummary.weight, reps: latestSummary.targetReps },
      `${formatWeightLabel(latestSummary.weight)} x ${latestSummary.targetReps}`,
      'Aún falta una segunda sesión completa en el tope del rango antes de subir carga.'
    );
  }

  if (partialFail) {
    return applyUniformSuggestion(
      exercise,
      { weight: latestSummary.weight, reps: latestSummary.targetReps },
      `${formatWeightLabel(latestSummary.weight)} x ${latestSummary.targetReps}`,
      `Aún no se cerró el bloque completo: ${latestSummary.metCount}/${latestSummary.totalSets} series. Repite ${latestSummary.weight} kg con ${latestSummary.targetReps} reps hasta completar todas.`
    );
  }

  return applyUniformSuggestion(
    exercise,
    { weight: latestSummary.weight, reps: baseTargetReps },
    `${formatWeightLabel(latestSummary.weight)} x ${baseTargetReps}`,
    `Mantén ${latestSummary.weight} kg y vuelve a construir desde ${baseTargetReps} reps.`
  );
}

function buildRepsSuggestions(
  exercise: ActiveWorkoutExercise,
  history: CompletedExerciseSession[]
) {
  const latest = history[0];
  if (!latest?.sets.length) {
    return exercise;
  }

  const baseTarget = getBaseMetricTarget(exercise, 'reps', latest);
  if (baseTarget === undefined) {
    return exercise;
  }

  const latestSummary = summarizeSingleMetricSession(
    latest.sets,
    'reps',
    baseTarget,
    exercise.sets.filter((set) => countsForProgression(set.setType)).length || exercise.sets.length
  );
  if (latestSummary.allMet) {
    const nextTarget = latestSummary.target + 1;
    return applyUniformSuggestion(
      exercise,
      { reps: nextTarget },
      formatRepDelta(latestSummary.target, nextTarget),
      `Sesión sólida. Busca ${nextTarget} reps en todas las series.`
    );
  }

  if (latestSummary.metCount > 0) {
    return applyUniformSuggestion(
      exercise,
      { reps: latestSummary.target },
      `${latestSummary.target}r`,
      `Aún no se cerró el bloque completo: ${latestSummary.metCount}/${latestSummary.totalSets} series. Repite ${latestSummary.target} reps hasta completar todas.`
    );
  }

  return applyUniformSuggestion(
    exercise,
    { reps: baseTarget },
    `${baseTarget}r`,
    `Mantén ${baseTarget} reps hasta volver a cerrar el bloque completo.`
  );
}

function buildTimeSuggestions(
  exercise: ActiveWorkoutExercise,
  history: CompletedExerciseSession[]
) {
  const latest = history[0];
  if (!latest?.sets.length) {
    return exercise;
  }

  const baseTarget = getBaseMetricTarget(exercise, 'duration', latest);
  if (baseTarget === undefined) {
    return exercise;
  }

  const latestSummary = summarizeSingleMetricSession(
    latest.sets,
    'duration',
    baseTarget,
    exercise.sets.filter((set) => countsForProgression(set.setType)).length || exercise.sets.length
  );
  if (latestSummary.allMet) {
    const nextTarget = latestSummary.target + getTimeStepSeconds(latestSummary.target);
    return applyUniformSuggestion(
      exercise,
      { duration: nextTarget },
      formatDurationDelta(latestSummary.target, nextTarget),
      `Sesión sólida. Busca ${formatDurationValue(nextTarget)} en todas las series.`
    );
  }

  if (latestSummary.metCount > 0) {
    return applyUniformSuggestion(
      exercise,
      { duration: latestSummary.target },
      formatDurationValue(latestSummary.target),
      `Aún no se cerró el bloque completo: ${latestSummary.metCount}/${latestSummary.totalSets} series. Repite ${formatDurationValue(latestSummary.target)} hasta completar todas.`
    );
  }

  return applyUniformSuggestion(
    exercise,
    { duration: baseTarget },
    formatDurationValue(baseTarget),
    `Mantén ${formatDurationValue(baseTarget)} hasta volver a cerrar el bloque completo.`
  );
}

function buildDistanceSuggestions(
  exercise: ActiveWorkoutExercise,
  history: CompletedExerciseSession[]
) {
  const latest = history[0];
  if (!latest?.sets.length) {
    return exercise;
  }

  const baseTarget = getBaseMetricTarget(exercise, 'distance', latest);
  if (baseTarget === undefined) {
    return exercise;
  }

  const latestSummary = summarizeSingleMetricSession(
    latest.sets,
    'distance',
    baseTarget,
    exercise.sets.filter((set) => countsForProgression(set.setType)).length || exercise.sets.length
  );
  if (latestSummary.allMet) {
    const nextTarget = latestSummary.target + getDistanceStepMeters(latestSummary.target);
    return applyUniformSuggestion(
      exercise,
      { distance: nextTarget },
      formatDistanceDelta(latestSummary.target, nextTarget),
      `Sesión sólida. Busca ${nextTarget} m en todas las series.`
    );
  }

  if (latestSummary.metCount > 0) {
    return applyUniformSuggestion(
      exercise,
      { distance: latestSummary.target },
      `${latestSummary.target}m`,
      `Aún no se cerró el bloque completo: ${latestSummary.metCount}/${latestSummary.totalSets} series. Repite ${latestSummary.target} m hasta completar todas.`
    );
  }

  return applyUniformSuggestion(
    exercise,
    { distance: baseTarget },
    `${baseTarget}m`,
    `Mantén ${baseTarget} m hasta volver a cerrar el bloque completo.`
  );
}

export function applyProgressionSuggestions(
  exercise: ActiveWorkoutExercise,
  history: CompletedExerciseSession[]
) {
  if (exercise.metricType === 'weight_reps') {
    if (shouldTreatWeightRepsAsBodyweight(exercise, history)) {
      return buildRepsSuggestions({ ...exercise, metricType: 'reps' }, history);
    }
    return buildWeightRepsSuggestions(exercise, history);
  }
  if (exercise.metricType === 'reps') {
    return buildRepsSuggestions(exercise, history);
  }
  if (exercise.metricType === 'time') {
    return buildTimeSuggestions(exercise, history);
  }
  if (exercise.metricType === 'distance') {
    return buildDistanceSuggestions(exercise, history);
  }
  return exercise;
}

export function applySuggestedPrescription(exercise: ActiveWorkoutExercise) {
  return {
    ...exercise,
    sets: exercise.sets.map((set) => {
      if (!set.suggestion) return set;
      return {
        ...set,
        ...set.suggestion.values,
        suggestion: {
          ...set.suggestion,
          status: 'accepted' as const
        }
      };
    })
  };
}

export function applySuggestionToSet(set: ActiveWorkoutSet): ActiveWorkoutSet {
  if (!set.suggestion) return set;
  return {
    ...set,
    ...set.suggestion.values,
    suggestion: {
      ...set.suggestion,
      status: 'accepted'
    }
  };
}

export function syncSuggestionStatus(set: ActiveWorkoutSet): ActiveWorkoutSet {
  if (!set.suggestion) return set;
  const matchesSuggestion = matchesSuggestedValues(set, set.suggestion);
  let nextStatus = set.suggestion.status ?? 'pending';
  if (nextStatus === 'accepted') {
    nextStatus = matchesSuggestion ? 'accepted' : 'ignored';
  } else {
    nextStatus = matchesSuggestion ? 'pending' : 'ignored';
  }
  return {
    ...set,
    suggestion: {
      ...set.suggestion,
      status: nextStatus
    }
  };
}
