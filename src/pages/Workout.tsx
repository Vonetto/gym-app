import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listExercises, getExerciseDisplayName } from '../data/exercises';
import { useSettings } from '../data/SettingsProvider';
import { getLatestExerciseSets, saveWorkout } from '../data/workouts';

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

interface WorkoutSession {
  id: string;
  createdAt: string;
  routineId?: string;
  routineName?: string;
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
  const [exercisePicker, setExercisePicker] = useState('');
  const [exerciseOptions, setExerciseOptions] = useState<
    Array<{ id: string; label: string; metricType: string }>
  >([]);
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
        exercises.map((exercise) => ({
          id: exercise.id,
          label: getExerciseDisplayName(exercise, settings.language),
          metricType: exercise.metricType
        }))
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

  const handleFinish = async () => {
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
    localStorage.removeItem('active-session');
    setSession(null);
    navigate('/');
  };

  const handleDiscard = () => {
    localStorage.removeItem('active-session');
    setSession(null);
    navigate('/');
  };

  const handleAddExercise = async () => {
    if (!session || !exercisePicker) return;
    const selected = exerciseOptions.find((option) => option.id === exercisePicker);
    if (!selected) return;
    const previousSets = await getLatestExerciseSets(selected.id);
    setSession((prev) => {
      if (!prev) return prev;
      const nextExercise: WorkoutExercise = {
        exerciseId: selected.id,
        name: selected.label,
        metricType: selected.metricType,
        previousSets: previousSets.map((set) => ({ weight: set.weight, reps: set.reps })),
        restSeconds: 0,
        sets: Array.from({ length: 3 }, () => ({
          completed: false
        }))
      };
      return {
        ...prev,
        exercises: [...prev.exercises, nextExercise]
      };
    });
    setExercisePicker('');
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
          return (
            <div key={exercise.exerciseId} className="exercise-card">
              <div className="exercise-header">
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
        <div className="field inline">
          <select value={exercisePicker} onChange={(event) => setExercisePicker(event.target.value)}>
            <option value="">Selecciona ejercicio</option>
            {exerciseOptions.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.label}
              </option>
            ))}
          </select>
          <button className="primary-button" type="button" onClick={handleAddExercise}>
            Añadir
          </button>
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
    </section>
  );
}
