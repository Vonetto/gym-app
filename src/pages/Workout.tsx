import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listExercises, getExerciseDisplayName, normalizeName } from '../data/exercises';
import { useSettings } from '../data/SettingsProvider';
import { getLatestExerciseSets, saveWorkout } from '../data/workouts';
import { getRoutineDetail, overwriteRoutineExercises } from '../data/routines';

interface WorkoutSet {
  weight?: number;
  reps?: number;
  duration?: number;
  distance?: number;
  rpe?: number;
  completed?: boolean;
}

interface WorkoutExercise {
  exerciseId: string;
  name: string;
  metricType: string;
  previousSets?: Array<{ weight?: number; reps?: number }>;
  restSeconds?: number;
  sets: WorkoutSet[];
}

interface ExerciseOption {
  id: string;
  label: string;
  metricType: string;
  muscles: string[];
  equipment: string[];
  normalizedLabel: string;
}

interface WorkoutSession {
  id: string;
  createdAt: string;
  routineId?: string;
  routineName?: string;
  originalExerciseIds?: string[];
  exercises: WorkoutExercise[];
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

export function Workout() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<{ exerciseId: string; index: number } | null>(
    null
  );
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showFinishPrompt, setShowFinishPrompt] = useState(false);
  const [restTimers, setRestTimers] = useState<
    Record<string, { secondsLeft: number; totalSeconds: number; exerciseName: string }>
  >({});
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('active-session');
    if (stored) {
      setSession(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    localStorage.setItem('active-session', JSON.stringify(session));
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
            muscles: exercise.muscles,
            equipment: exercise.equipment,
            normalizedLabel: normalizeName(label)
          };
        })
      );
    };
    loadExercises();
  }, [settings.language]);

  useEffect(() => {
    if (!session) return;
    const createdAt = new Date(session.createdAt).getTime();
    const tick = () => {
      const diff = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
      setElapsed(diff);
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (!Object.keys(restTimers).length) return;
    const interval = window.setInterval(() => {
      setRestTimers((prev) => {
        const next = { ...prev };
        const finished: Array<{ exerciseName: string }> = [];
        Object.entries(next).forEach(([key, timer]) => {
          const nextSeconds = timer.secondsLeft - 1;
          if (nextSeconds <= 0) {
            finished.push({ exerciseName: timer.exerciseName });
            delete next[key];
          } else {
            next[key] = { ...timer, secondsLeft: nextSeconds };
          }
        });
        if (finished.length) {
          finished.forEach((item) => notifyRestComplete(item.exerciseName));
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [restTimers]);

  const handleAddSet = (exerciseIndex: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;
        return {
          ...exercise,
          sets: [...exercise.sets, { completed: false }]
        };
      });
      return { ...prev, exercises };
    });
  };

  const handleSetChange = (
    exerciseIndex: number,
    setIndex: number,
    field: keyof WorkoutSet,
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
        const updated = { ...sets[setIndex], [field]: nextValue };
        sets[setIndex] = updated;
        return { ...exercise, sets };
      });
      return { ...prev, exercises };
    });
  };

  const handleRestCycle = (exerciseIndex: number) => {
    const options = Array.from({ length: 11 }, (_, index) => index * 30);
    setSession((prev) => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;
        const current = exercise.restSeconds ?? 0;
        const nextIndex = (options.indexOf(current) + 1) % options.length;
        return { ...exercise, restSeconds: options[nextIndex] };
      });
      return { ...prev, exercises };
    });
  };

  const toggleComplete = (exerciseIndex: number, setIndex: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;
        const sets = [...exercise.sets];
        const nextCompleted = !sets[setIndex].completed;
        const nextSet: WorkoutSet = {
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
        sets[setIndex] = nextSet;
        if (nextCompleted && (exercise.restSeconds ?? 0) > 0) {
          void startRestTimer(exercise.exerciseId, exercise.name, exercise.restSeconds ?? 0);
        }
        return { ...exercise, sets };
      });
      return { ...prev, exercises };
    });
  };

  const finalizeWorkout = async (updateRoutine: boolean) => {
    if (session) {
      const sanitizedSession: WorkoutSession = {
        ...session,
        exercises: session.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.filter((set) => set.completed)
        }))
      };
      await saveWorkout(sanitizedSession);
    }

    if (updateRoutine && session?.routineId) {
      const detail = await getRoutineDetail(session.routineId);
      const defaultsByExercise = new Map(
        detail?.defaults.map((item) => [item.exerciseId, item]) ?? []
      );
      const exercises = session.exercises.map((exercise, index) => {
        const existingDefaults = defaultsByExercise.get(exercise.exerciseId);
        if (existingDefaults) {
          return {
            exerciseId: exercise.exerciseId,
            order: index,
            defaults: {
              defaultSets: existingDefaults.defaultSets,
              defaultReps: existingDefaults.defaultReps,
              defaultWeight: existingDefaults.defaultWeight,
              defaultDuration: existingDefaults.defaultDuration,
              defaultDistance: existingDefaults.defaultDistance,
              defaultRestSeconds: existingDefaults.defaultRestSeconds
            }
          };
        }
        const lastSet = exercise.sets[exercise.sets.length - 1];
        return {
          exerciseId: exercise.exerciseId,
          order: index,
          defaults: {
            defaultSets: exercise.sets.length,
            defaultReps: lastSet?.reps,
            defaultWeight: lastSet?.weight,
            defaultRestSeconds: exercise.restSeconds ?? 0
          }
        };
      });
      await overwriteRoutineExercises(session.routineId, exercises);
    }

    localStorage.removeItem('active-session');
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
      if (session.routineId && hasChanges) {
        setShowFinishPrompt(true);
        return;
      }
    }
    void finalizeWorkout(false);
  };

  const handleDiscard = () => {
    localStorage.removeItem('active-session');
    setSession(null);
    navigate('/');
  };

  const buildWorkoutExercise = async (option: ExerciseOption): Promise<WorkoutExercise> => {
    const previousSets = await getLatestExerciseSets(option.id);
    return {
      exerciseId: option.id,
      name: option.label,
      metricType: option.metricType,
      previousSets: previousSets.map((set) => ({ weight: set.weight, reps: set.reps })),
      restSeconds: 0,
      sets: Array.from({ length: 3 }, () => ({
        completed: false
      }))
    };
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
  };

  const handleRemoveExercise = (exerciseIndex: number) => {
    if (!session) return;
    if (!window.confirm('¿Eliminar este ejercicio del entreno?')) return;
    const exercise = session.exercises[exerciseIndex];
    setSession((prev) => {
      if (!prev) return prev;
      const nextExercises = prev.exercises.filter((_, index) => index !== exerciseIndex);
      return { ...prev, exercises: nextExercises };
    });
    setRestTimers((prev) => {
      const next = { ...prev };
      delete next[exercise.exerciseId];
      return next;
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
      return { ...prev, exercises: nextExercises };
    });
    setRestTimers((prev) => {
      const next = { ...prev };
      delete next[oldExercise.exerciseId];
      return next;
    });
    setReplaceTarget(null);
    setReplaceQuery('');
  };

  const buildPreviousMatches = (
    previous: Array<{ weight?: number; reps?: number }>,
    current: WorkoutSet[]
  ) => {
    if (!previous.length) return current.map(() => null);
    const remaining = previous.map((set, index) => ({ ...set, index }));
    return current.map((set, index) => {
      if (!remaining.length) return null;
      let bestIndex = 0;
      let bestScore = Number.POSITIVE_INFINITY;
      for (let i = 0; i < remaining.length; i += 1) {
        const candidate = remaining[i];
        const weightScore =
          set.weight !== undefined && candidate.weight !== undefined
            ? Math.abs(set.weight - candidate.weight) * 2
            : set.weight !== undefined || candidate.weight !== undefined
            ? 5
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
    const list = exerciseOptions.filter(
      (option) => !query || option.normalizedLabel.includes(query)
    );
    return list.slice(0, 8);
  }, [exerciseOptions, exerciseQuery]);

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
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Descanso terminado', {
        body: `Continúa con ${exerciseName}.`
      });
    }
    playWhistle();
  };

  const startRestTimer = async (exerciseId: string, exerciseName: string, restSeconds: number) => {
    if (restSeconds <= 0) return;
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    await ensureAudioContext();
    setRestTimers((prev) => ({
      ...prev,
      [exerciseId]: { secondsLeft: restSeconds, totalSeconds: restSeconds, exerciseName }
    }));
  };

  const workoutTitle = useMemo(() => session?.routineName ?? 'Entreno', [session?.routineName]);

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
          const matches = buildPreviousMatches(exercise.previousSets ?? [], exercise.sets);
          const isMenuOpen = openMenuId === exercise.exerciseId;
          return (
            <div key={exercise.exerciseId} className="exercise-card">
              <div className="exercise-header">
                <div className="exercise-header-left">
                  <div className="avatar">{exercise.name.charAt(0)}</div>
                  <div>
                    <h2 className="exercise-title">{exercise.name}</h2>
                    <p className="muted">Agregar notas aquí...</p>
                    <button className="rest" type="button" onClick={() => handleRestCycle(exerciseIndex)}>
                      Descanso: {exercise.restSeconds ? formatDuration(exercise.restSeconds) : 'APAGADO'}
                      {restTimers[exercise.exerciseId]
                        ? ` · ${formatDuration(restTimers[exercise.exerciseId].secondsLeft)}`
                        : ''}
                    </button>
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

              <div className="set-table">
                <div className="set-row set-header">
                  <span>Serie</span>
                  <span>Anterior</span>
                  <span>KG</span>
                  <span>Reps</span>
                  <span>RPE</span>
                  <span />
                </div>
                {exercise.sets.map((set, setIndex) => {
                  const match = matches[setIndex];
                  return (
                    <div key={`${exercise.exerciseId}-${setIndex}`} className="set-row">
                      <span>{setIndex + 1}</span>
                      <button
                        className="previous-button"
                        type="button"
                        onClick={() => {
                          if (!match) return;
                          handleSetChange(
                            exerciseIndex,
                            setIndex,
                            'weight',
                            String(match.weight ?? 0)
                          );
                          handleSetChange(
                            exerciseIndex,
                            setIndex,
                            'reps',
                            String(match.reps ?? 0)
                          );
                        }}
                      >
                        {match?.weight !== undefined && match?.reps !== undefined
                          ? `${match.weight} x ${match.reps}`
                          : '-'}
                      </button>
                      <input
                        type="number"
                        value={set.weight ?? ''}
                        onChange={(event) =>
                          handleSetChange(exerciseIndex, setIndex, 'weight', event.target.value)
                        }
                      />
                      <input
                        type="number"
                        value={set.reps ?? ''}
                        onChange={(event) =>
                          handleSetChange(exerciseIndex, setIndex, 'reps', event.target.value)
                        }
                      />
                      <input
                        className="rpe-input"
                        type="number"
                        min={1}
                        max={10}
                        step={1}
                        value={set.rpe ?? ''}
                        onChange={(event) =>
                          handleSetChange(exerciseIndex, setIndex, 'rpe', event.target.value)
                        }
                      />
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

      <div className="card">
        <h2>Agregar ejercicio</h2>
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
                    {exercise.muscles.length ? exercise.muscles.slice(0, 2).join(', ') : 'Sin grupo'}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">No hay ejercicios que coincidan.</p>
          )}
        </div>
      </div>
      <div className="actions">
        <button className="ghost-button" type="button">
          Configuración
        </button>
        <button className="danger-button" type="button" onClick={handleDiscard}>
          Descartar entreno
        </button>
      </div>

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
