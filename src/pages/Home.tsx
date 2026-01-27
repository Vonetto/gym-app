import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listRoutines, getRoutineDetail } from '../data/routines';
import { listExercises, getExerciseDisplayName } from '../data/exercises';
import { useSettings } from '../data/SettingsProvider';

interface RoutineSummary {
  id: string;
  name: string;
  tags: string[];
  exercises: string[];
}

interface WorkoutSession {
  id: string;
  createdAt: string;
  routineId?: string;
  routineName?: string;
  exercises: Array<{
    exerciseId: string;
    name: string;
    metricType: string;
    previousSets?: Array<{ weight?: number; reps?: number }>;
    sets: Array<{
      weight?: number;
      reps?: number;
      duration?: number;
      distance?: number;
      completed?: boolean;
    }>;
  }>;
}

export function Home() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [routines, setRoutines] = useState<RoutineSummary[]>([]);

  const loadRoutines = async () => {
    const baseRoutines = await listRoutines();
    if (!baseRoutines.length) {
      setRoutines([]);
      return;
    }
    const exercises = await listExercises();
    const exerciseMap = new Map(
      exercises.map((exercise) => [exercise.id, getExerciseDisplayName(exercise, settings.language)])
    );
    const summaries: RoutineSummary[] = [];
    for (const routine of baseRoutines) {
      const detail = await getRoutineDetail(routine.id);
      if (!detail) continue;
      const exerciseNames = detail.exercises
        .map((entry) => exerciseMap.get(entry.exerciseId))
        .filter(Boolean) as string[];
      summaries.push({
        id: routine.id,
        name: routine.name,
        tags: detail.tags,
        exercises: exerciseNames
      });
    }
    setRoutines(summaries);
  };

  useEffect(() => {
    loadRoutines();
  }, [settings.language]);

  const hasRoutines = routines.length > 0;

  const handleStartEmpty = () => {
    const payload: WorkoutSession = {
      id: `session-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      exercises: []
    };
    localStorage.setItem('active-session', JSON.stringify(payload));
    navigate('/workout');
  };

  const handleStartRoutine = async (routineId: string) => {
    const detail = await getRoutineDetail(routineId);
    if (!detail) return;
    const exercises = await listExercises();
    const exerciseMap = new Map(exercises.map((exercise) => [exercise.id, exercise]));
    const historyRaw = localStorage.getItem('workout-history');
    const history = historyRaw ? JSON.parse(historyRaw) : [];
    const lastSession = history.find((entry: WorkoutSession) => entry.routineId === routineId);
    const session: WorkoutSession = {
      id: `session-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      routineId,
      routineName: detail.routine.name,
      exercises: detail.exercises.map((entry) => {
        const exercise = exerciseMap.get(entry.exerciseId);
        const defaults = detail.defaults.find((item) => item.exerciseId === entry.exerciseId);
        const setsCount = defaults?.defaultSets ?? 3;
        const sets = Array.from({ length: setsCount }, () => ({
          weight: defaults?.defaultWeight,
          reps: defaults?.defaultReps,
          duration: defaults?.defaultDuration,
          distance: defaults?.defaultDistance,
          completed: false
        }));
        const previous =
          lastSession?.exercises.find(
            (exerciseEntry: { exerciseId: string }) => exerciseEntry.exerciseId === entry.exerciseId
          )?.sets ?? [];
        return {
          exerciseId: entry.exerciseId,
          name: exercise ? getExerciseDisplayName(exercise, settings.language) : 'Ejercicio',
          metricType: exercise?.metricType ?? 'weight_reps',
          previousSets: previous.map((set: { weight?: number; reps?: number }) => ({
            weight: set.weight,
            reps: set.reps
          })),
          sets
        };
      })
    };
    localStorage.setItem('active-session', JSON.stringify(session));
    navigate('/workout');
  };

  const routineCountLabel = useMemo(
    () => (routines.length === 1 ? 'Mis rutinas (1)' : `Mis rutinas (${routines.length})`),
    [routines.length]
  );

  return (
    <section className="stack wide">
      <div className="training-header">
        <div>
          <p className="overline">Entrenamiento</p>
          <h1>Tu sesión</h1>
        </div>
        <span className="badge">PRO</span>
      </div>

      <button className="primary-button full" type="button" onClick={handleStartEmpty}>
        + Empezar entrenamiento vacío
      </button>

      <div className="card">
        <div className="card-header">
          <h2>Rutinas</h2>
        </div>
        <div className="inline">
          <Link className="ghost-button" to="/routines">
            + Nueva rutina
          </Link>
          <button className="ghost-button" type="button" disabled>
            Explorar (próximamente)
          </button>
        </div>
        <div className="info-banner">
          Presiona una rutina para reordenar
        </div>
        <div className="section-label">{routineCountLabel}</div>
        {hasRoutines ? (
          <div className="stack">
            {routines.map((routine) => (
              <div key={routine.id} className="routine-card">
                <div className="routine-header">
                  <div>
                    <h3>{routine.name}</h3>
                    <p className="muted">
                      {(routine.tags.length ? routine.tags.join(' · ') : 'Sin tags')}{' '}
                      {routine.exercises.length ? `· ${routine.exercises.slice(0, 3).join(', ')}` : ''}
                    </p>
                  </div>
                  <Link className="ghost-button" to={`/routines/${routine.id}`}>
                    Editar
                  </Link>
                </div>
                <button
                  className="primary-button full"
                  type="button"
                  onClick={() => handleStartRoutine(routine.id)}
                >
                  Empezar rutina
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Aún no tienes rutinas creadas.</p>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Últimos entrenamientos</h2>
          <span className="muted">Sin datos</span>
        </div>
        <p className="muted">
          Aquí verás el resumen de tus últimas sesiones cuando completes entrenamientos.
        </p>
      </div>
    </section>
  );
}
