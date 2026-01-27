import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listExercises, getExerciseDisplayName } from '../data/exercises';
import { useSettings } from '../data/SettingsProvider';

interface WorkoutSet {
  weight?: number;
  reps?: number;
  duration?: number;
  distance?: number;
  completed?: boolean;
}

interface WorkoutExercise {
  exerciseId: string;
  name: string;
  metricType: string;
  previousSets?: Array<{ weight?: number; reps?: number }>;
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

  const handleAddSet = (exerciseIndex: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      const exercise = next.exercises[exerciseIndex];
      exercise.sets = [...exercise.sets, { completed: false }];
      return { ...next, exercises: [...next.exercises] };
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
      const next = { ...prev };
      const exercise = next.exercises[exerciseIndex];
      const sets = [...exercise.sets];
      const numeric = value ? Number(value) : undefined;
      const updated = { ...sets[setIndex], [field]: numeric };
      sets[setIndex] = updated;
      exercise.sets = sets;
      return { ...next, exercises: [...next.exercises] };
    });
  };

  const toggleComplete = (exerciseIndex: number, setIndex: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      const exercise = next.exercises[exerciseIndex];
      const sets = [...exercise.sets];
      sets[setIndex] = {
        ...sets[setIndex],
        completed: !sets[setIndex].completed
      };
      exercise.sets = sets;
      return { ...next, exercises: [...next.exercises] };
    });
  };

  const handleFinish = () => {
    if (session) {
      const existing = localStorage.getItem('workout-history');
      const history = existing ? JSON.parse(existing) : [];
      history.unshift(session);
      localStorage.setItem('workout-history', JSON.stringify(history.slice(0, 50)));
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

  const handleAddExercise = () => {
    if (!session || !exercisePicker) return;
    const selected = exerciseOptions.find((option) => option.id === exercisePicker);
    if (!selected) return;
    setSession((prev) => {
      if (!prev) return prev;
      const nextExercise: WorkoutExercise = {
        exerciseId: selected.id,
        name: selected.label,
        metricType: selected.metricType,
        previousSets: [],
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
        session.exercises.map((exercise, exerciseIndex) => (
          <div key={exercise.exerciseId} className="exercise-card">
            <div className="exercise-header">
              <div className="avatar">{exercise.name.charAt(0)}</div>
              <div>
                <h2 className="exercise-title">{exercise.name}</h2>
                <p className="muted">Agregar notas aquí...</p>
                <p className="rest">Descanso: APAGADO</p>
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
              {exercise.sets.map((set, setIndex) => (
                <div key={`${exercise.exerciseId}-${setIndex}`} className="set-row">
                  <span>{setIndex + 1}</span>
                  <span className="muted">
                    {exercise.previousSets?.[setIndex]?.weight !== undefined &&
                    exercise.previousSets?.[setIndex]?.reps !== undefined
                      ? `${exercise.previousSets?.[setIndex]?.weight} x ${exercise.previousSets?.[setIndex]?.reps}`
                      : '-'}
                  </span>
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
                  <button className="pill" type="button">
                    RPE
                  </button>
                  <button
                    className={set.completed ? 'check active' : 'check'}
                    type="button"
                    onClick={() => toggleComplete(exerciseIndex, setIndex)}
                  >
                    ✓
                  </button>
                </div>
              ))}
            </div>

            <button className="ghost-button full" type="button" onClick={() => handleAddSet(exerciseIndex)}>
              + Agregar serie
            </button>
          </div>
        ))
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
