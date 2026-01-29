import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createRoutine, getRoutineDetail, listRoutines } from '../data/routines';
import { listExercises, getExerciseDisplayName } from '../data/exercises';
import {
  getLatestExerciseSets,
  getLastWorkoutForRoutine,
  getWorkoutExercises,
  getWorkoutSets,
  listRecentWorkouts
} from '../data/workouts';
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
  tags?: string[];
  exercises: Array<{
    exerciseId: string;
    name: string;
    metricType: string;
    previousSets?: Array<{ weight?: number; reps?: number }>;
    restSeconds?: number;
    sets: Array<{
      weight?: number;
      reps?: number;
      duration?: number;
      distance?: number;
      completed?: boolean;
    }>;
  }>;
}

interface WorkoutSummary {
  id: string;
  routineName: string;
  createdAt: string;
  setCount: number;
  tags: string[];
}

export function Home() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [routines, setRoutines] = useState<RoutineSummary[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSummary[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTags, setNewTags] = useState('');

  const loadRoutines = async () => {
    const baseRoutines = await listRoutines();
    if (!baseRoutines.length) {
      return [];
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
    return summaries;
  };

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      const routineSummaries = await loadRoutines();
      const workouts = await listRecentWorkouts(8);
      const summaries: WorkoutSummary[] = [];
      for (const workout of workouts) {
        const workoutExercises = await getWorkoutExercises(workout.id);
        const setCounts = await Promise.all(
          workoutExercises.map((exercise) => getWorkoutSets(exercise.id))
        );
        const setCount = setCounts.reduce((acc, sets) => acc + sets.length, 0);
        summaries.push({
          id: workout.id,
          routineName: workout.routineName ?? 'Entreno',
          createdAt: workout.endedAt,
          setCount,
          tags: workout.tags ?? []
        });
      }
      if (!active) return;
      setRoutines(routineSummaries);
      setRecentWorkouts(summaries);
    };
    void loadData();
    return () => {
      active = false;
    };
  }, [settings.language]);

  const hasRoutines = routines.length > 0;

  const handleCreateRoutine = async () => {
    if (!newName.trim()) return;
    const routine = await createRoutine(
      newName.trim(),
      newTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    );
    setNewName('');
    setNewTags('');
    setShowCreate(false);
    const summaries = await loadRoutines();
    setRoutines(summaries);
    navigate(`/routines/${routine.id}`);
  };

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
    const lastWorkout = await getLastWorkoutForRoutine(routineId);
    const session: WorkoutSession = {
      id: `session-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      routineId,
      routineName: detail.routine.name,
      tags: detail.tags,
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
        return {
          exerciseId: entry.exerciseId,
          name: exercise ? getExerciseDisplayName(exercise, settings.language) : 'Ejercicio',
          metricType: exercise?.metricType ?? 'weight_reps',
          restSeconds: defaults?.defaultRestSeconds ?? 0,
          previousSets: [],
          sets
        };
      })
    };
    const previousSetsByExercise = new Map<string, Array<{ weight?: number; reps?: number }>>();
    const workoutExerciseMap = new Map<string, Array<{ weight?: number; reps?: number }>>();
    if (lastWorkout) {
      const workoutExercises = await getWorkoutExercises(lastWorkout.id);
      for (const workoutExercise of workoutExercises) {
        const sets = await getWorkoutSets(workoutExercise.id);
        workoutExerciseMap.set(
          workoutExercise.exerciseId,
          sets.map((set) => ({ weight: set.weight, reps: set.reps }))
        );
      }
    }
    for (const entry of detail.exercises) {
      let sets = workoutExerciseMap.get(entry.exerciseId) ?? [];
      if (!sets.length) {
        const latestSets = await getLatestExerciseSets(entry.exerciseId);
        sets = latestSets.map((set) => ({ weight: set.weight, reps: set.reps }));
      }
      previousSetsByExercise.set(entry.exerciseId, sets);
    }
    session.exercises = session.exercises.map((exercise) => ({
      ...exercise,
      previousSets: previousSetsByExercise.get(exercise.exerciseId) ?? []
    }));
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
      </div>

      <button className="primary-button full" type="button" onClick={handleStartEmpty}>
        + Empezar entrenamiento vacío
      </button>

      <div className="card">
        <div className="card-header">
          <h2>Rutinas</h2>
        </div>
        <div className="inline">
          <button className="ghost-button" type="button" onClick={() => setShowCreate((prev) => !prev)}>
            + Nueva rutina
          </button>
          <button className="ghost-button" type="button" disabled>
            Explorar (próximamente)
          </button>
        </div>
        {showCreate ? (
          <div className="field">
            <label className="label" htmlFor="routine-name-home">
              Nombre de la rutina
            </label>
            <input
              id="routine-name-home"
              type="text"
              value={newName}
              placeholder="Ej: Día de empuje"
              onChange={(event) => setNewName(event.target.value)}
            />
            <input
              type="text"
              value={newTags}
              placeholder="Tags o días (separados por coma)"
              onChange={(event) => setNewTags(event.target.value)}
            />
            <button className="primary-button" type="button" onClick={handleCreateRoutine}>
              Crear rutina
            </button>
          </div>
        ) : null}
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
          <span className="muted">{recentWorkouts.length ? 'Recientes' : 'Sin datos'}</span>
        </div>
        {recentWorkouts.length ? (
          <div className="recent-list">
            {recentWorkouts.slice(0, 4).map((workout) => (
              <div key={workout.id} className="compact-card">
                <div>
                  <p className="compact-title">{workout.routineName}</p>
                  <p className="compact-meta">
                    {new Date(workout.createdAt).toLocaleDateString()} · {workout.setCount} sets
                  </p>
                  {workout.tags.length ? (
                    <div className="compact-tags">
                      {workout.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="tag-chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">
            Aquí verás el resumen de tus últimas sesiones cuando completes entrenamientos.
          </p>
        )}
      </div>
    </section>
  );
}
