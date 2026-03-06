import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listExercises,
  getExerciseDisplayName,
  normalizeName,
  listFavorites
} from '../data/exercises';
import {
  ActiveWorkoutExercise,
  ActiveWorkoutSession,
  ActiveWorkoutSet,
  clearActiveSession,
  readActiveSession,
  writeActiveSession
} from '../data/activeSession';
import {
  applyProgressionSuggestions,
  applySuggestedPrescription,
  applySuggestionToSet,
  syncSuggestionStatus
} from '../data/progression';
import { useSettings } from '../data/SettingsProvider';
import {
  getLatestExerciseSets,
  listProgressionExerciseSessions,
  saveWorkout
} from '../data/workouts';
import { getRoutineDetail, overwriteRoutineExercises } from '../data/routines';
import { AdvancedSetType, ExerciseMetric } from '../data/db';
import { upsertPlannedWorkoutOccurrence } from '../data/plans';
import { showAppNotification } from '../data/notifications';
import {
  countsForProgression,
  DEFAULT_SET_TYPE,
  getSetTypeMeta,
  SET_TYPE_OPTIONS,
  normalizeSetType,
  normalizeSetTypeArray
} from '../data/setTypes';

interface ExerciseOption {
  id: string;
  label: string;
  metricType: ExerciseMetric;
  muscles: string[];
  equipment: string[];
  normalizedLabel: string;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

function formatClockValue(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function getMetricTypeLabel(metricType: ExerciseMetric) {
  if (metricType === 'weight_reps') return 'Peso + reps';
  if (metricType === 'reps') return 'Solo reps';
  if (metricType === 'time') return 'Tiempo';
  return 'Distancia';
}

function getRestLabel(restSeconds?: number) {
  if (restSeconds === -1) return 'CRONÓMETRO';
  if (!restSeconds || restSeconds <= 0) return 'APAGADO';
  return formatDuration(restSeconds);
}

function getDefaultValueForMetricType(
  metricType: ExerciseMetric,
  field: 'reps' | 'duration' | 'distance'
) {
  if (metricType === 'reps' && field === 'reps') return 10;
  if (metricType === 'time' && field === 'duration') return 60;
  if (metricType === 'distance' && field === 'distance') return 100;
  return undefined;
}

async function refreshExerciseSuggestions(exercise: ActiveWorkoutExercise) {
  if (!exercise.sets.length || !exercise.sets.some((set) => countsForProgression(set.setType))) {
    return {
      ...exercise,
      suggestionExplanation: undefined,
      sets: exercise.sets.map((set) => ({ ...set, suggestion: undefined }))
    };
  }
  const history = await listProgressionExerciseSessions(exercise.exerciseId, 2);
  return applyProgressionSuggestions(exercise, history);
}

function normalizedSetTypes(sets: ActiveWorkoutSet[]) {
  return normalizeSetTypeArray(
    sets.map((set) => set.setType),
    sets.length
  );
}

function sameSetTypePlan(current: ActiveWorkoutSet[], original?: AdvancedSetType[]) {
  const currentTypes = normalizedSetTypes(current);
  const originalTypes = normalizeSetTypeArray(original, current.length);
  return (
    currentTypes.length === originalTypes.length &&
    currentTypes.every((setType, index) => setType === originalTypes[index])
  );
}

export function Workout() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [session, setSession] = useState<ActiveWorkoutSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [metricTypeTarget, setMetricTypeTarget] = useState<{ exerciseId: string; index: number } | null>(
    null
  );
  const [restTarget, setRestTarget] = useState<number | null>(null);
  const [setTypeTarget, setSetTypeTarget] = useState<{ exerciseIndex: number; setIndex: number } | null>(
    null
  );
  const [replaceTarget, setReplaceTarget] = useState<{ exerciseId: string; index: number } | null>(
    null
  );
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [showFinishPrompt, setShowFinishPrompt] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setSession(readActiveSession());
  }, []);

  useEffect(() => {
    if (!session) return;
    writeActiveSession(session);
  }, [session]);

  useEffect(() => {
    const loadExercises = async () => {
      const exercises = await listExercises();
      setExerciseOptions(
        exercises.map((exercise) => {
          const label = getExerciseDisplayName(exercise, settings.language);
          return {
            id: exercise.id,
            label,
            metricType: exercise.metricType,
            muscles: [...exercise.muscles, ...(exercise.secondaryMuscles ?? [])],
            equipment: exercise.equipment,
            normalizedLabel: normalizeName(label)
          };
        })
      );
    };
    loadExercises();
  }, [settings.language]);

  useEffect(() => {
    if (!session || !exerciseOptions.length) return;
    const needsBackfill = session.exercises.some(
      (exercise) =>
        exercise.sets.some(
          (set) => countsForProgression(set.setType) && !set.suggestion
        )
    );
    const missingEquipment = session.exercises.some(
      (exercise) => exercise.metricType === 'weight_reps' && !(exercise.equipment?.length)
    );
    if (!needsBackfill && !missingEquipment) return;

    let cancelled = false;
    const optionMap = new Map(exerciseOptions.map((option) => [option.id, option]));

    const backfill = async () => {
      const nextExercises = await Promise.all(
        session.exercises.map(async (exercise) => {
          const option = optionMap.get(exercise.exerciseId);
          const withEquipment = {
            ...exercise,
            equipment: exercise.equipment?.length ? exercise.equipment : option?.equipment ?? []
          };
          if (
            exercise.sets.every(
              (set) => !countsForProgression(set.setType) || set.suggestion
            )
          ) {
            return withEquipment;
          }
          return refreshExerciseSuggestions(withEquipment);
        })
      );
      if (cancelled) return;
      setSession((prev) => (prev ? { ...prev, exercises: nextExercises } : prev));
    };

    void backfill();
    return () => {
      cancelled = true;
    };
  }, [exerciseOptions, session]);

  useEffect(() => {
    const loadFavorites = async () => {
      const data = await listFavorites();
      setFavoriteIds(data.map((item) => item.exerciseId));
    };
    loadFavorites();
  }, [showAddExercise]);

  useEffect(() => {
    if (!session) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (!session?.restTimers) return;
    const entries = Object.entries(session.restTimers);
    if (!entries.length) return;
    const expired: Array<{ key: string; exerciseName: string }> = [];
    entries.forEach(([key, timer]) => {
      const mode = timer.mode ?? (timer.totalSeconds <= 0 ? 'stopwatch' : 'countdown');
      if (mode !== 'countdown' || !timer.endAt) return;
      const endAt = new Date(timer.endAt).getTime();
      if (endAt <= now) {
        expired.push({ key, exerciseName: timer.exerciseName });
      }
    });
    if (!expired.length) return;
    expired.forEach((item) => notifyRestComplete(item.exerciseName));
    setSession((prev) => {
      if (!prev?.restTimers) return prev;
      const nextTimers = { ...prev.restTimers };
      expired.forEach((item) => {
        delete nextTimers[item.key];
      });
      return { ...prev, restTimers: nextTimers };
    });
  }, [now, session]);

  const handleAddSet = (exerciseIndex: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;
        return {
          ...exercise,
          sets: [...exercise.sets, { completed: false, setType: DEFAULT_SET_TYPE }]
        };
      });
      return { ...prev, exercises };
    });
  };

  const handleSetChange = (
    exerciseIndex: number,
    setIndex: number,
    field: keyof ActiveWorkoutSet,
    value: string
  ) => {
    setSession((prev) => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;
        const sets = [...exercise.sets];
        let numeric: number | undefined;
        if (field === 'rpe') {
          numeric = value === '' ? undefined : Number(value);
        } else if (field === 'weight' || field === 'reps') {
          numeric = value === '' ? 0 : Number(value);
        } else {
          numeric = value === '' ? undefined : Number(value);
        }
        const nextValue =
          field === 'rpe' && numeric !== undefined
            ? Math.min(10, Math.max(1, numeric))
            : numeric;
        const updated = syncSuggestionStatus({ ...sets[setIndex], [field]: nextValue });
        sets[setIndex] = updated;
        return { ...exercise, sets };
      });
      return { ...prev, exercises };
    });
  };

  const handleNotesChange = (exerciseIndex: number, value: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;
        return { ...exercise, notes: value };
      });
      return { ...prev, exercises };
    });
  };

  const updateRestForExercise = (exerciseIndex: number, restSeconds: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const targetExercise = prev.exercises[exerciseIndex];
      if (!targetExercise) return prev;
      const exercises = prev.exercises.map((exercise, index) =>
        index === exerciseIndex ? { ...exercise, restSeconds } : exercise
      );
      const restTimers = prev.restTimers ? { ...prev.restTimers } : undefined;
      if (restTimers && targetExercise.exerciseId in restTimers) {
        delete restTimers[targetExercise.exerciseId];
      }
      return { ...prev, exercises, restTimers };
    });
  };

  const handleRestAdjust = (exerciseIndex: number, deltaSeconds: number) => {
    const current = session?.exercises[exerciseIndex]?.restSeconds ?? 0;
    const base = current > 0 ? current : 90;
    const next = Math.max(15, Math.min(600, base + deltaSeconds));
    updateRestForExercise(exerciseIndex, next);
  };

  const toggleComplete = (exerciseIndex: number, setIndex: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;
        const sets = [...exercise.sets];
        const nextCompleted = !sets[setIndex].completed;
        const nextSet: ActiveWorkoutSet = {
          ...sets[setIndex],
          completed: nextCompleted,
          weight:
            nextCompleted && sets[setIndex].weight === undefined
              ? 0
              : sets[setIndex].weight,
          reps:
            nextCompleted && sets[setIndex].reps === undefined
              ? 0
              : sets[setIndex].reps
        };
        sets[setIndex] = syncSuggestionStatus(nextSet);
        if (nextCompleted && (exercise.restSeconds ?? 0) !== 0) {
          void startRestTimer(exercise.exerciseId, exercise.name, exercise.restSeconds ?? 0);
        }
        return { ...exercise, sets };
      });
      return { ...prev, exercises };
    });
  };

  const handleSetTypeChange = async (
    exerciseIndex: number,
    setIndex: number,
    setType: AdvancedSetType
  ) => {
    if (!session) return;
    const targetExercise = session.exercises[exerciseIndex];
    const nextExercise = await refreshExerciseSuggestions({
      ...targetExercise,
      sets: targetExercise.sets.map((set, index) =>
        index === setIndex
          ? {
              ...set,
              setType
            }
          : set
      )
    });
    setSession((prev) => {
      if (!prev) return prev;
      const exercises = [...prev.exercises];
      exercises[exerciseIndex] = nextExercise;
      return { ...prev, exercises };
    });
    setSetTypeTarget(null);
  };

  const handleRemoveSet = async (exerciseIndex: number, setIndex: number) => {
    if (!session) return;
    const targetExercise = session.exercises[exerciseIndex];
    const nextExercise = await refreshExerciseSuggestions({
      ...targetExercise,
      sets: targetExercise.sets.filter((_, index) => index !== setIndex)
    });
    setSession((prev) => {
      if (!prev) return prev;
      const exercises = [...prev.exercises];
      exercises[exerciseIndex] = nextExercise;
      return { ...prev, exercises };
    });
    setSetTypeTarget(null);
  };

  const finalizeWorkout = async (updateRoutine: boolean) => {
    let completedSetCount = 0;
    if (session) {
      const sanitizedSession: ActiveWorkoutSession = {
        ...session,
        exercises: session.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.filter((set) => set.completed)
        }))
      };
      completedSetCount = sanitizedSession.exercises.reduce(
        (total, exercise) => total + exercise.sets.length,
        0
      );
      await saveWorkout(sanitizedSession);
      if (completedSetCount > 0 && session.plannedOccurrence) {
        await upsertPlannedWorkoutOccurrence(
          session.plannedOccurrence.seriesId,
          session.plannedOccurrence.occurrenceDate,
          'completed',
          session.id
        );
      }
    }

    if (updateRoutine && session?.routineId) {
      const detail = await getRoutineDetail(session.routineId);
      const defaultsByExercise = new Map(
        detail?.defaults.map((item) => [item.exerciseId, item]) ?? []
      );
      const exercises = session.exercises.map((exercise, index) => {
        const existingDefaults = defaultsByExercise.get(exercise.exerciseId);
        const typeChanged = exercise.metricType !== (exercise.originalMetricType ?? exercise.metricType);
        const setTypeChanged = !sameSetTypePlan(exercise.sets, existingDefaults?.defaultSetTypes);
        const lastSet = exercise.sets[exercise.sets.length - 1];
        if (existingDefaults) {
          if (typeChanged) {
            return {
              exerciseId: exercise.exerciseId,
              order: index,
              defaults: {
                metricTypeOverride:
                  exercise.metricType !== (exercise.catalogMetricType ?? exercise.metricType)
                    ? exercise.metricType
                    : undefined,
                defaultSets: exercise.sets.length,
                defaultReps: lastSet?.reps,
                defaultWeight: lastSet?.weight,
                defaultDuration: lastSet?.duration,
                defaultDistance: lastSet?.distance,
                defaultRestSeconds: exercise.restSeconds ?? 0,
                defaultSetTypes: normalizeSetTypeArray(
                  exercise.sets.map((set) => set.setType),
                  exercise.sets.length
                ),
                goalMode: exercise.metricType === 'weight_reps' ? exercise.goalMode ?? 'auto' : undefined
              }
            };
          }
          if (setTypeChanged) {
            return {
              exerciseId: exercise.exerciseId,
              order: index,
              defaults: {
                metricTypeOverride: existingDefaults.metricTypeOverride,
                defaultSets: exercise.sets.length,
                defaultReps: existingDefaults.defaultReps,
                defaultWeight: existingDefaults.defaultWeight,
                defaultDuration: existingDefaults.defaultDuration,
                defaultDistance: existingDefaults.defaultDistance,
                defaultRestSeconds: existingDefaults.defaultRestSeconds,
                defaultSetTypes: normalizedSetTypes(exercise.sets),
                goalMode: existingDefaults.goalMode
              }
            };
          }
          return {
            exerciseId: exercise.exerciseId,
            order: index,
            defaults: {
              metricTypeOverride: existingDefaults.metricTypeOverride,
              defaultSets: existingDefaults.defaultSets,
              defaultReps: existingDefaults.defaultReps,
              defaultWeight: existingDefaults.defaultWeight,
              defaultDuration: existingDefaults.defaultDuration,
              defaultDistance: existingDefaults.defaultDistance,
              defaultRestSeconds: existingDefaults.defaultRestSeconds,
              defaultSetTypes: normalizeSetTypeArray(
                existingDefaults.defaultSetTypes,
                existingDefaults.defaultSets ?? exercise.sets.length
              ),
              goalMode: existingDefaults.goalMode
            }
          };
        }
        return {
          exerciseId: exercise.exerciseId,
          order: index,
          defaults: {
            metricTypeOverride:
              exercise.metricType !== (exercise.catalogMetricType ?? exercise.metricType)
                ? exercise.metricType
                : undefined,
            defaultSets: exercise.sets.length,
            defaultReps: lastSet?.reps,
            defaultWeight: lastSet?.weight,
            defaultDuration: lastSet?.duration,
            defaultDistance: lastSet?.distance,
            defaultRestSeconds: exercise.restSeconds ?? 0,
            defaultSetTypes: normalizeSetTypeArray(
              exercise.sets.map((set) => set.setType),
              exercise.sets.length
            ),
            goalMode: exercise.metricType === 'weight_reps' ? exercise.goalMode ?? 'auto' : undefined
          }
        };
      });
      await overwriteRoutineExercises(session.routineId, exercises);
    }

    clearActiveSession();
    setSession(null);
    setShowFinishPrompt(false);
    navigate('/');
  };

  const handleFinish = () => {
    if (session) {
      const original = session.originalExerciseIds ?? [];
      const current = session.exercises.map((exercise) => exercise.exerciseId);
      const hasChanges =
        original.length > 0 &&
        (original.length !== current.length ||
          original.some((exerciseId, index) => exerciseId !== current[index]));
      const hasTypeChanges = session.exercises.some(
        (exercise) => exercise.metricType !== (exercise.originalMetricType ?? exercise.metricType)
      );
      const hasSetTypeChanges = session.exercises.some(
        (exercise) => !sameSetTypePlan(exercise.sets, exercise.originalSetTypes)
      );
      if (session.routineId && (hasChanges || hasTypeChanges || hasSetTypeChanges)) {
        setShowFinishPrompt(true);
        return;
      }
    }
    void finalizeWorkout(false);
  };

  const handleDiscard = () => {
    clearActiveSession();
    setSession(null);
    navigate('/');
  };

  const buildWorkoutExercise = async (option: ExerciseOption): Promise<ActiveWorkoutExercise> => {
    const previousSets = await getLatestExerciseSets(option.id);
    const nextExercise: ActiveWorkoutExercise = {
      exerciseId: option.id,
      name: option.label,
      metricType: option.metricType,
      catalogMetricType: option.metricType,
      originalMetricType: option.metricType,
      originalSetTypes: normalizeSetTypeArray(undefined, 3),
      goalMode: 'auto',
      notes: '',
      equipment: option.equipment,
      previousSets: previousSets.map((set) => ({
        weight: set.weight,
        reps: set.reps,
        duration: set.duration,
        distance: set.distance
      })),
      restSeconds: 0,
      sets: Array.from({ length: 3 }, () => ({
        completed: false,
        setType: DEFAULT_SET_TYPE
      }))
    };
    return applySuggestedPrescription(await refreshExerciseSuggestions(nextExercise));
  };

  const handleAddExercise = async (optionId: string) => {
    if (!session) return;
    const selected = exerciseOptions.find((option) => option.id === optionId);
    if (!selected) return;
    const nextExercise = await buildWorkoutExercise(selected);
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: [...prev.exercises, nextExercise]
      };
    });
    setExerciseQuery('');
    setShowAddExercise(false);
  };

  const handleRemoveExercise = (exerciseIndex: number) => {
    if (!session) return;
    if (!window.confirm('¿Eliminar este ejercicio del entreno?')) return;
    const exercise = session.exercises[exerciseIndex];
    setSession((prev) => {
      if (!prev) return prev;
      const nextExercises = prev.exercises.filter((_, index) => index !== exerciseIndex);
      const nextTimers = { ...(prev.restTimers ?? {}) };
      delete nextTimers[exercise.exerciseId];
      return { ...prev, exercises: nextExercises, restTimers: nextTimers };
    });
    setOpenMenuId(null);
  };

  const handleMoveExercise = (exerciseIndex: number, direction: 'up' | 'down') => {
    if (!session) return;
    setSession((prev) => {
      if (!prev) return prev;
      const nextExercises = [...prev.exercises];
      const swapIndex = direction === 'up' ? exerciseIndex - 1 : exerciseIndex + 1;
      if (swapIndex < 0 || swapIndex >= nextExercises.length) return prev;
      const temp = nextExercises[swapIndex];
      nextExercises[swapIndex] = nextExercises[exerciseIndex];
      nextExercises[exerciseIndex] = temp;
      return { ...prev, exercises: nextExercises };
    });
    setOpenMenuId(null);
  };

  const handleReplaceExercise = async (exerciseIndex: number, optionId: string) => {
    if (!session) return;
    const selected = exerciseOptions.find((option) => option.id === optionId);
    if (!selected) return;
    const nextExercise = await buildWorkoutExercise(selected);
    const oldExercise = session.exercises[exerciseIndex];
    setSession((prev) => {
      if (!prev) return prev;
      const nextExercises = [...prev.exercises];
      nextExercises[exerciseIndex] = nextExercise;
      const nextTimers = { ...(prev.restTimers ?? {}) };
      delete nextTimers[oldExercise.exerciseId];
      return { ...prev, exercises: nextExercises, restTimers: nextTimers };
    });
    setReplaceTarget(null);
    setReplaceQuery('');
  };

  const handleApplySuggestion = (exerciseIndex: number, setIndex: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;
        const sets = [...exercise.sets];
        sets[setIndex] = applySuggestionToSet(sets[setIndex]);
        return { ...exercise, sets };
      });
      return { ...prev, exercises };
    });
  };

  const handleChangeMetricType = async (exerciseIndex: number, metricType: ExerciseMetric) => {
    if (!session) return;
    const targetExercise = session.exercises[exerciseIndex];
    const nextExercise = applySuggestedPrescription(
      await refreshExerciseSuggestions(
        {
          ...targetExercise,
          metricType,
          sets: targetExercise.sets.map((set) => ({
            setType: set.setType ?? DEFAULT_SET_TYPE,
            completed: set.completed,
            weight:
              metricType === 'weight_reps'
                ? set.weight
                : metricType === 'reps'
                ? 0
                : undefined,
            reps:
              metricType === 'weight_reps' || metricType === 'reps'
                ? set.reps ?? getDefaultValueForMetricType(metricType, 'reps')
                : undefined,
            duration:
              metricType === 'time'
                ? set.duration ?? getDefaultValueForMetricType(metricType, 'duration')
                : undefined,
            distance:
              metricType === 'distance'
                ? set.distance ?? getDefaultValueForMetricType(metricType, 'distance')
                : undefined
          })),
          previousSets: (targetExercise.previousSets ?? []).map((set) => ({
            weight:
              metricType === 'weight_reps'
                ? set.weight
                : metricType === 'reps'
                ? 0
                : undefined,
            reps:
              metricType === 'weight_reps' || metricType === 'reps'
                ? set.reps
                : undefined,
            duration: metricType === 'time' ? set.duration : undefined,
            distance: metricType === 'distance' ? set.distance : undefined
          }))
        }
      )
    );
    setSession((prev) => {
      if (!prev) return prev;
      const exercises = [...prev.exercises];
      exercises[exerciseIndex] = nextExercise;
      return { ...prev, exercises };
    });
    setMetricTypeTarget(null);
    setOpenMenuId(null);
  };

  const buildPreviousMatches = (
    metricType: string,
    previous: Array<{ weight?: number; reps?: number; duration?: number; distance?: number }>,
    current: ActiveWorkoutSet[]
  ) => {
    if (!previous.length) return current.map(() => null);
    if (metricType === 'time' || metricType === 'distance') {
      return current.map((_, index) => previous[index] ?? null);
    }
    const remaining = previous.map((set, index) => ({ ...set, index }));
    return current.map((set, index) => {
      if (!remaining.length) return null;
      let bestIndex = 0;
      let bestScore = Number.POSITIVE_INFINITY;
      for (let i = 0; i < remaining.length; i += 1) {
        const candidate = remaining[i];
        const weightScore =
          metricType === 'weight_reps'
            ? set.weight !== undefined && candidate.weight !== undefined
              ? Math.abs(set.weight - candidate.weight) * 2
              : set.weight !== undefined || candidate.weight !== undefined
              ? 5
              : 0
            : 0;
        const repsScore =
          set.reps !== undefined && candidate.reps !== undefined
            ? Math.abs(set.reps - candidate.reps)
            : set.reps !== undefined || candidate.reps !== undefined
            ? 3
            : 0;
        const orderScore = Math.abs(index - candidate.index) * 0.25;
        const score = weightScore + repsScore + orderScore;
        if (score < bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
      const [match] = remaining.splice(bestIndex, 1);
      return match;
    });
  };

  const exerciseOptionMap = useMemo(
    () => new Map(exerciseOptions.map((option) => [option.id, option])),
    [exerciseOptions]
  );

  const filteredExercises = useMemo(() => {
    const query = normalizeName(exerciseQuery);
    const list = exerciseOptions.filter((option) => {
      if (onlyFavorites && !favoriteIds.includes(option.id)) return false;
      return !query || option.normalizedLabel.includes(query);
    });
    return list.slice(0, 8);
  }, [exerciseOptions, exerciseQuery, favoriteIds, onlyFavorites]);

  const replaceOptions = useMemo(() => {
    if (!replaceTarget) return [];
    const target = exerciseOptionMap.get(replaceTarget.exerciseId);
    const query = normalizeName(replaceQuery);
    const candidates = exerciseOptions.filter((option) => option.id !== replaceTarget.exerciseId);
    if (query) {
      return candidates
        .filter((option) => option.normalizedLabel.includes(query))
        .slice(0, 8);
    }
    if (!target) {
      return candidates.slice(0, 8);
    }
    const targetMuscles = new Set(target.muscles);
    const targetEquipment = new Set(target.equipment);
    const scored = candidates
      .map((option) => {
        const muscleScore = option.muscles.filter((muscle) => targetMuscles.has(muscle)).length;
        const equipmentScore = option.equipment.filter((item) => targetEquipment.has(item)).length;
        return {
          option,
          score: muscleScore * 3 + equipmentScore * 2
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.option.label.localeCompare(b.option.label));
    return (scored.length ? scored.map((item) => item.option) : candidates).slice(0, 8);
  }, [exerciseOptions, exerciseOptionMap, replaceQuery, replaceTarget]);

  const ensureAudioContext = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  };

  const playWhistle = () => {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.2);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  };

  const notifyRestComplete = (exerciseName: string) => {
    if (settings.notificationsEnabled && settings.restFinishedNotificationsEnabled) {
      void showAppNotification({
        title: 'Descanso terminado',
        body: `Continúa con ${exerciseName}.`,
        tag: `rest-${exerciseName}`,
        url: '/workout'
      });
      playWhistle();
    }
  };

  const startRestTimer = async (exerciseId: string, exerciseName: string, restSeconds: number) => {
    if (restSeconds === 0) return;
    const mode: 'countdown' | 'stopwatch' =
      restSeconds === -1 ? 'stopwatch' : 'countdown';
    if (mode === 'countdown' && settings.notificationsEnabled && settings.restFinishedNotificationsEnabled) {
      await ensureAudioContext();
    }
    const startedAt = new Date().toISOString();
    const endAt =
      mode === 'countdown' ? new Date(Date.now() + restSeconds * 1000).toISOString() : undefined;
    setSession((prev) => {
      if (!prev) return prev;
      const restTimers = {
        ...(prev.restTimers ?? {}),
        [exerciseId]: { startedAt, endAt, mode, totalSeconds: restSeconds, exerciseName }
      };
      return { ...prev, restTimers };
    });
  };

  const workoutTitle = useMemo(() => session?.routineName ?? 'Entreno', [session?.routineName]);
  const elapsed = useMemo(() => {
    if (!session) return 0;
    const createdAt = new Date(session.createdAt).getTime();
    return Math.max(0, Math.floor((now - createdAt) / 1000));
  }, [now, session]);
  const getRestSecondsLeft = (exerciseId: string) => {
    const timer = session?.restTimers?.[exerciseId];
    if (!timer) return null;
    const mode = timer.mode ?? (timer.totalSeconds <= 0 ? 'stopwatch' : 'countdown');
    if (mode === 'stopwatch') {
      const startedAt = new Date(timer.startedAt ?? timer.endAt ?? session?.createdAt ?? Date.now()).getTime();
      return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    }
    if (!timer.endAt) return null;
    const endAt = new Date(timer.endAt).getTime();
    return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  };

  if (!session) {
    return (
      <section className="card">
        <h1>No hay una sesión activa</h1>
        <p className="muted">Elige una rutina para comenzar un entrenamiento.</p>
        <button className="ghost-button" type="button" onClick={() => navigate('/')}>
          Volver
        </button>
      </section>
    );
  }

  return (
    <section className="stack wide">
      <div className="workout-header">
        <div>
          <p className="overline">Entreno</p>
          <h1>{workoutTitle}</h1>
        </div>
        <div className="workout-actions">
          <span className="workout-timer">{formatDuration(elapsed)}</span>
          <button className="primary-button" type="button" onClick={handleFinish}>
            Terminar
          </button>
        </div>
      </div>

      {session.exercises.length === 0 ? (
        <div className="card">
          <p className="muted">No hay ejercicios en esta sesión.</p>
        </div>
      ) : (
        session.exercises.map((exercise, exerciseIndex) => {
          const matches = buildPreviousMatches(
            exercise.metricType,
            exercise.previousSets ?? [],
            exercise.sets
          );
          const firstSuggestion = exercise.sets.find((set) => set.suggestion)?.suggestion;
          const suggestionSummary = firstSuggestion
            ? `Sugerido: ${firstSuggestion.label}.`
            : null;
          const metricType = exercise.metricType;
          const showWeight = metricType === 'weight_reps';
          const showReps = metricType === 'weight_reps' || metricType === 'reps';
          const showDistance = metricType === 'distance';
          const showTime = metricType === 'time';
          const isMenuOpen = openMenuId === exercise.exerciseId;
          const restSecondsLeft = getRestSecondsLeft(exercise.exerciseId);
          return (
            <div key={exercise.exerciseId} className="exercise-card">
              <div className="exercise-header">
                <div className="exercise-header-left">
                  <div className="avatar">{exercise.name.charAt(0)}</div>
                  <div>
                    <h2 className="exercise-title">{exercise.name}</h2>
                    <textarea
                      className="exercise-notes"
                      placeholder="Agregar notas aquí..."
                      rows={2}
                      value={exercise.notes ?? ''}
                      onChange={(event) => handleNotesChange(exerciseIndex, event.target.value)}
                    />
                    <button className="rest" type="button" onClick={() => setRestTarget(exerciseIndex)}>
                      Descanso: {getRestLabel(exercise.restSeconds)}
                      {restSecondsLeft
                        ? ` · ${exercise.restSeconds === -1 ? '+' : ''}${formatDuration(restSecondsLeft)}`
                        : ''}
                    </button>
                    {suggestionSummary ? (
                      <p className="exercise-suggestion-summary">{suggestionSummary}</p>
                    ) : null}
                    {exercise.suggestionExplanation ? (
                      <p className="exercise-helper">{exercise.suggestionExplanation}</p>
                    ) : null}
                  </div>
                </div>
                <div className="exercise-menu-wrapper">
                  <button
                    className="menu-button"
                    type="button"
                    onClick={() =>
                      setOpenMenuId((prev) => (prev === exercise.exerciseId ? null : exercise.exerciseId))
                    }
                  >
                    ⋯
                  </button>
                  {isMenuOpen ? (
                    <div className="exercise-menu">
                      <p className="exercise-menu-meta">
                        Tipo actual: {getMetricTypeLabel(exercise.metricType)}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setReplaceTarget({ exerciseId: exercise.exerciseId, index: exerciseIndex });
                          setReplaceQuery('');
                          setOpenMenuId(null);
                        }}
                      >
                        Reemplazar ejercicio
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMetricTypeTarget({ exerciseId: exercise.exerciseId, index: exerciseIndex });
                          setOpenMenuId(null);
                        }}
                      >
                        Cambiar tipo ({getMetricTypeLabel(exercise.metricType)})
                      </button>
                      <button
                        type="button"
                        disabled={exerciseIndex === 0}
                        onClick={() => handleMoveExercise(exerciseIndex, 'up')}
                      >
                        Mover arriba
                      </button>
                      <button
                        type="button"
                        disabled={exerciseIndex === session.exercises.length - 1}
                        onClick={() => handleMoveExercise(exerciseIndex, 'down')}
                      >
                        Mover abajo
                      </button>
                      <button
                        className="danger"
                        type="button"
                        onClick={() => handleRemoveExercise(exerciseIndex)}
                      >
                        Eliminar ejercicio
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className={`set-table metric-${metricType}`}>
                <div className="set-row set-header">
                  <span>Serie</span>
                  <span>Anterior</span>
                  {showWeight ? <span>KG</span> : null}
                  {showReps ? <span>Reps</span> : null}
                  {showDistance ? <span>Distancia</span> : null}
                  {showTime ? <span>Tiempo</span> : null}
                  <span className="set-header-suggestion">Sug.</span>
                  <span />
                </div>
                {exercise.sets.map((set, setIndex) => {
                  const match = matches[setIndex];
                  const suggestion = set.suggestion;
                  const previousLabel = (() => {
                    if (!match) return '-';
                    if (showWeight || showReps) {
                      if (showWeight && showReps) {
                        return match.weight !== undefined && match.reps !== undefined
                          ? `${match.weight} x ${match.reps}`
                          : '-';
                      }
                      return match.reps !== undefined ? `${match.reps}` : '-';
                    }
                    if (showDistance) {
                      return match.distance !== undefined ? `${match.distance} m` : '-';
                    }
                    if (showTime) {
                      return match.duration !== undefined ? formatDuration(match.duration) : '-';
                    }
                    return '-';
                  })();
                  const setTypeMeta = getSetTypeMeta(set.setType, setIndex);
                  return (
                    <div key={`${exercise.exerciseId}-${setIndex}`} className="set-row">
                      <button
                        className={`set-index-button ${setTypeMeta.type}`}
                        type="button"
                        onClick={() => setSetTypeTarget({ exerciseIndex, setIndex })}
                        aria-label={`Cambiar tipo de serie (${setTypeMeta.label})`}
                      >
                        {setTypeMeta.badge}
                      </button>
                      <button
                        className="previous-button"
                        type="button"
                        onClick={() => {
                          if (!match) return;
                          if (showWeight) {
                            handleSetChange(
                              exerciseIndex,
                              setIndex,
                              'weight',
                              String(match.weight ?? 0)
                            );
                          }
                          if (showReps) {
                            handleSetChange(
                              exerciseIndex,
                              setIndex,
                              'reps',
                              String(match.reps ?? 0)
                            );
                          }
                          if (showDistance) {
                            handleSetChange(
                              exerciseIndex,
                              setIndex,
                              'distance',
                              String(match.distance ?? 0)
                            );
                          }
                          if (showTime) {
                            handleSetChange(
                              exerciseIndex,
                              setIndex,
                              'duration',
                              String(match.duration ?? 0)
                            );
                          }
                        }}
                      >
                        {previousLabel}
                      </button>
                      {showWeight ? (
                        <input
                          type="number"
                          value={set.weight ?? ''}
                          onChange={(event) =>
                            handleSetChange(exerciseIndex, setIndex, 'weight', event.target.value)
                          }
                        />
                      ) : null}
                      {showReps ? (
                        <input
                          type="number"
                          value={set.reps ?? ''}
                          onChange={(event) =>
                            handleSetChange(exerciseIndex, setIndex, 'reps', event.target.value)
                          }
                        />
                      ) : null}
                      {showDistance ? (
                        <input
                          type="number"
                          value={set.distance ?? ''}
                          onChange={(event) =>
                            handleSetChange(exerciseIndex, setIndex, 'distance', event.target.value)
                          }
                        />
                      ) : null}
                      {showTime ? (
                        <input
                          type="number"
                          value={set.duration ?? ''}
                          onChange={(event) =>
                            handleSetChange(exerciseIndex, setIndex, 'duration', event.target.value)
                          }
                        />
                      ) : null}
                      <button
                        className={`suggestion-button ${suggestion?.status ?? 'empty'}`}
                        type="button"
                        disabled={!suggestion}
                        onClick={() => handleApplySuggestion(exerciseIndex, setIndex)}
                      >
                        {suggestion?.label ?? '—'}
                      </button>
                      <input
                        className="set-check"
                        type="checkbox"
                        checked={Boolean(set.completed)}
                        onChange={() => toggleComplete(exerciseIndex, setIndex)}
                      />
                    </div>
                  );
                })}
              </div>

              <button className="ghost-button full" type="button" onClick={() => handleAddSet(exerciseIndex)}>
                + Agregar serie
              </button>
            </div>
          );
        })
      )}

      <button className="ghost-button full" type="button" onClick={() => setShowAddExercise(true)}>
        + Agregar ejercicio
      </button>
      <div className="actions">
        <button className="danger-button" type="button" onClick={handleDiscard}>
          Descartar entreno
        </button>
      </div>

      {showAddExercise ? (
        <div className="modal-overlay bottom" onClick={() => setShowAddExercise(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h2>Agregar ejercicio</h2>
              <button className="ghost-button" type="button" onClick={() => setShowAddExercise(false)}>
                Cerrar
              </button>
            </div>
            <div className="field">
              <label className="label" htmlFor="workout-exercise-search">
                Buscar ejercicio
              </label>
              <input
                id="workout-exercise-search"
                type="search"
                placeholder="Ej: Sentadilla, remo..."
                value={exerciseQuery}
                onChange={(event) => setExerciseQuery(event.target.value)}
              />
              <label className="inline compact">
                <input
                  type="checkbox"
                  checked={onlyFavorites}
                  onChange={(event) => setOnlyFavorites(event.target.checked)}
                />
                Solo favoritos
              </label>
              {filteredExercises.length ? (
                <div className="exercise-search-list">
                  {filteredExercises.map((exercise) => (
                    <button
                      key={exercise.id}
                      className="exercise-search-item"
                      type="button"
                      onClick={() => handleAddExercise(exercise.id)}
                    >
                      <span>{exercise.label}</span>
                      <span className="muted">
                        {exercise.muscles.length
                          ? exercise.muscles.slice(0, 2).join(', ')
                          : 'Sin grupo'}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">No hay ejercicios que coincidan.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {replaceTarget ? (
        <div
          className="modal-overlay bottom"
          onClick={() => {
            setReplaceTarget(null);
            setReplaceQuery('');
          }}
        >
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h2>Reemplazar ejercicio</h2>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setReplaceTarget(null);
                  setReplaceQuery('');
                }}
              >
                Cerrar
              </button>
            </div>
            <div className="field">
              <label className="label" htmlFor="replace-exercise-search">
                Buscar ejercicio
              </label>
              <input
                id="replace-exercise-search"
                type="search"
                placeholder="Busca un reemplazo..."
                value={replaceQuery}
                onChange={(event) => setReplaceQuery(event.target.value)}
              />
              {replaceOptions.length ? (
                <div className="exercise-search-list">
                  {replaceOptions.map((exercise) => (
                    <button
                      key={exercise.id}
                      className="exercise-search-item"
                      type="button"
                      onClick={() => handleReplaceExercise(replaceTarget.index, exercise.id)}
                    >
                      <span>{exercise.label}</span>
                      <span className="muted">
                        {exercise.muscles.length
                          ? exercise.muscles.slice(0, 2).join(', ')
                          : 'Sin grupo'}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">No hay ejercicios para reemplazar.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {metricTypeTarget ? (
        <div
          className="modal-overlay bottom"
          onClick={() => {
            setMetricTypeTarget(null);
          }}
        >
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            {(() => {
              const targetExercise = session?.exercises[metricTypeTarget.index];
              const currentType = targetExercise ? getMetricTypeLabel(targetExercise.metricType) : '';
              return (
                <>
            <div className="card-header">
              <h2>Cambiar tipo</h2>
              <button className="ghost-button" type="button" onClick={() => setMetricTypeTarget(null)}>
                Cerrar
              </button>
            </div>
            <p className="muted">
              Tipo actual: <strong>{currentType}</strong>
            </p>
            <p className="muted">
              Define cómo se registra este ejercicio. Usa `Solo reps` para bodyweight o cuando el peso no aporte.
            </p>
            <div className="actions">
              <button
                className={`ghost-button ${targetExercise?.metricType === 'weight_reps' ? 'selected-type' : ''}`}
                type="button"
                onClick={() => handleChangeMetricType(metricTypeTarget.index, 'weight_reps')}
              >
                Peso + reps
              </button>
              <button
                className={`ghost-button ${targetExercise?.metricType === 'reps' ? 'selected-type' : ''}`}
                type="button"
                onClick={() => handleChangeMetricType(metricTypeTarget.index, 'reps')}
              >
                Solo reps
              </button>
              <button
                className={`ghost-button ${targetExercise?.metricType === 'time' ? 'selected-type' : ''}`}
                type="button"
                onClick={() => handleChangeMetricType(metricTypeTarget.index, 'time')}
              >
                Tiempo
              </button>
              <button
                className={`ghost-button ${targetExercise?.metricType === 'distance' ? 'selected-type' : ''}`}
                type="button"
                onClick={() => handleChangeMetricType(metricTypeTarget.index, 'distance')}
              >
                Distancia
              </button>
            </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

      {restTarget !== null ? (
        <div
          className="modal-overlay bottom"
          onClick={() => {
            setRestTarget(null);
          }}
        >
          <div className="modal-card rest-clock-modal" onClick={(event) => event.stopPropagation()}>
            {(() => {
              const targetExercise = session?.exercises[restTarget];
              if (!targetExercise) return null;
              const currentRest = targetExercise.restSeconds ?? 0;
              const isStopwatch = currentRest === -1;
              const isOff = currentRest === 0;
              const timerValue = currentRest > 0 ? currentRest : 90;
              const restElapsed = getRestSecondsLeft(targetExercise.exerciseId) ?? 0;
              const displayValue = isStopwatch ? restElapsed : timerValue;
              return (
                <>
                  <div className="rest-clock-header">
                    <span className="rest-clock-icon" aria-hidden="true">
                      ⏱
                    </span>
                    <h2>Reloj</h2>
                    <button
                      className="rest-close-button"
                      type="button"
                      onClick={() => setRestTarget(null)}
                      aria-label="Cerrar reloj"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="rest-mode-segment">
                    <button
                      type="button"
                      className={!isStopwatch ? 'active' : ''}
                      onClick={() => updateRestForExercise(restTarget, timerValue)}
                    >
                      Temporizador
                    </button>
                    <button
                      type="button"
                      className={isStopwatch ? 'active' : ''}
                      onClick={() => updateRestForExercise(restTarget, -1)}
                    >
                      Cronómetro
                    </button>
                  </div>

                  <div className="rest-clock-ring">
                    <span>{formatClockValue(displayValue)}</span>
                  </div>

                  <div className="rest-step-row">
                    <button
                      className="rest-step-button"
                      type="button"
                      onClick={() => handleRestAdjust(restTarget, -15)}
                      disabled={isStopwatch}
                    >
                      -15s
                    </button>
                    <button
                      className="rest-step-button"
                      type="button"
                      onClick={() => handleRestAdjust(restTarget, 15)}
                      disabled={isStopwatch}
                    >
                      +15s
                    </button>
                  </div>

                  <button
                    className="primary-button full rest-start-button"
                    type="button"
                    onClick={() => {
                      const restToStart = isStopwatch ? -1 : timerValue;
                      updateRestForExercise(restTarget, restToStart);
                      void startRestTimer(
                        targetExercise.exerciseId,
                        targetExercise.name,
                        restToStart
                      );
                      setRestTarget(null);
                    }}
                  >
                    Empezar
                  </button>
                  <button
                    className={isOff ? 'ghost-button full rest-off-button active' : 'ghost-button full rest-off-button'}
                    type="button"
                    onClick={() => updateRestForExercise(restTarget, 0)}
                  >
                    Apagar descanso automático
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

      {setTypeTarget ? (
        <div
          className="modal-overlay bottom"
          onClick={() => {
            setSetTypeTarget(null);
          }}
        >
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            {(() => {
              const targetExercise = session?.exercises[setTypeTarget.exerciseIndex];
              const targetSet = targetExercise?.sets[setTypeTarget.setIndex];
              const currentType = normalizeSetType(targetSet?.setType);
              return (
                <>
                  <div className="card-header">
                    <h2>Seleccionar tipo de serie</h2>
                    <button className="ghost-button" type="button" onClick={() => setSetTypeTarget(null)}>
                      Cerrar
                    </button>
                  </div>
                  <p className="muted">
                    Serie {setTypeTarget.setIndex + 1} · actual: <strong>{getSetTypeMeta(currentType, setTypeTarget.setIndex).label}</strong>
                  </p>
                  <div className="set-type-list">
                    {SET_TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.type}
                        className={`set-type-option ${option.type} ${currentType === option.type ? 'selected' : ''}`}
                        type="button"
                        onClick={() =>
                          handleSetTypeChange(setTypeTarget.exerciseIndex, setTypeTarget.setIndex, option.type)
                        }
                      >
                        <span className={`set-type-badge ${option.type}`}>
                          {option.type === 'normal' ? setTypeTarget.setIndex + 1 : option.badge}
                        </span>
                        <span className="set-type-copy">
                          <strong>{option.label}</strong>
                          <small>{option.description}</small>
                        </span>
                      </button>
                    ))}
                    <button
                      className="set-type-option delete"
                      type="button"
                      onClick={() => handleRemoveSet(setTypeTarget.exerciseIndex, setTypeTarget.setIndex)}
                    >
                      <span className="set-type-badge delete">×</span>
                      <span className="set-type-copy">
                        <strong>Eliminar serie</strong>
                        <small>Quita esta serie del ejercicio actual.</small>
                      </span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

      {showFinishPrompt ? (
        <div className="modal-overlay center" onClick={() => setShowFinishPrompt(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h2>¿Actualizar rutina?</h2>
              <button className="ghost-button" type="button" onClick={() => setShowFinishPrompt(false)}>
                Cancelar
              </button>
            </div>
            <p className="muted">
              Cambiaste los ejercicios de esta rutina durante el entreno. ¿Quieres actualizar la
              rutina o guardar solo este entrenamiento?
            </p>
            <div className="actions">
              <button className="ghost-button" type="button" onClick={() => finalizeWorkout(false)}>
                Guardar solo entreno
              </button>
              <button className="primary-button" type="button" onClick={() => finalizeWorkout(true)}>
                Actualizar rutina
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
