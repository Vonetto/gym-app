import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [elapsed, setElapsed] = useState(0);

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
    localStorage.removeItem('active-session');
    setSession(null);
    navigate('/');
  };

  const handleDiscard = () => {
    localStorage.removeItem('active-session');
    setSession(null);
    navigate('/');
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
                  <span className="muted">-</span>
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

      <button className="primary-button full" type="button">
        + Agregar ejercicio
      </button>
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
