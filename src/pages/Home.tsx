import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createRoutine, deleteRoutine, getRoutineDetail, listRoutines } from '../data/routines';
import { listExercises, getExerciseDisplayName } from '../data/exercises';
import {
  getLatestExerciseSets,
  getLastWorkoutForRoutine,
  getWorkoutById,
  getWorkoutExercises,
  getWorkoutSets,
  listCompletedExerciseSessions,
  listAllWorkouts,
  listRecentWorkouts,
  listWorkoutsSince
} from '../data/workouts';
import { ActiveWorkoutSession, writeActiveSession } from '../data/activeSession';
import { applyProgressionSuggestions, applySuggestedPrescription } from '../data/progression';
import { useSettings } from '../data/SettingsProvider';
import { BodyMap } from '../components/BodyMap';
import {
  buildSlugVolumes,
  getMuscleWeights,
  SLUG_LABELS,
  MUSCLE_DECAY_HALF_LIFE_DAYS
} from '../components/bodyMapData';

interface RoutineSummary {
  id: string;
  name: string;
  tags: string[];
  exercises: string[];
}

interface WorkoutSummary {
  id: string;
  routineName: string;
  createdAt: string;
  setCount: number;
  tags: string[];
}

interface WorkoutDetail {
  id: string;
  routineName: string;
  startedAt: string;
  endedAt: string;
  tags: string[];
  exercises: Array<{
    id: string;
    name: string;
    metricType: string;
    notes?: string;
    sets: Array<{
      weight?: number;
      reps?: number;
      duration?: number;
      distance?: number;
      rpe?: number;
    }>;
  }>;
}

export function Home() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [routines, setRoutines] = useState<RoutineSummary[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSummary[]>([]);
  const [allWorkouts, setAllWorkouts] = useState<WorkoutSummary[]>([]);
  const [showAllWorkouts, setShowAllWorkouts] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTags, setNewTags] = useState('');
  const [activeWorkout, setActiveWorkout] = useState<WorkoutDetail | null>(null);
  const [muscleVolumes, setMuscleVolumes] = useState<Record<string, number>>({});
  const [mapView, setMapView] = useState<'front' | 'back'>('front');
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

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

  const buildWorkoutSummaries = async (
    workouts: Array<{ id: string; routineName?: string; endedAt: string; tags?: string[] }>
  ) => {
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
    return summaries;
  };

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      const routineSummaries = await loadRoutines();
      const workouts = await listRecentWorkouts(8);
      const summaries = await buildWorkoutSummaries(workouts);
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const muscleWorkouts = await listWorkoutsSince(since.toISOString());
      const exercises = await listExercises();
      const exerciseMuscles = new Map(exercises.map((exercise) => [exercise.id, exercise.muscles]));
      const muscleTotals: Record<string, number> = {};
      const now = Date.now();
      for (const workout of muscleWorkouts) {
        const workoutExercises = await getWorkoutExercises(workout.id);
        const workoutTime = new Date(workout.endedAt).getTime();
        const daysSince = Math.max(0, (now - workoutTime) / (1000 * 60 * 60 * 24));
        const decay = Math.exp((-Math.log(2) * daysSince) / MUSCLE_DECAY_HALF_LIFE_DAYS);
        for (const exercise of workoutExercises) {
          const sets = await getWorkoutSets(exercise.id);
          const muscles = exerciseMuscles.get(exercise.exerciseId) ?? [];
          const weightedMuscles = getMuscleWeights(muscles);
          for (const set of sets) {
            const weight = set.weight ?? 0;
            const reps = set.reps ?? 0;
            const volume = weight * reps;
            if (volume <= 0 || !weightedMuscles.length) continue;
            weightedMuscles.forEach(([muscle, share]) => {
              muscleTotals[muscle] =
                (muscleTotals[muscle] ?? 0) + volume * share * decay;
            });
          }
        }
      }
      if (!active) return;
      setRoutines(routineSummaries);
      setRecentWorkouts(summaries);
      setMuscleVolumes(muscleTotals);
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

  const handleDeleteRoutine = async (routineId: string) => {
    const confirmed = window.confirm('¿Eliminar esta rutina? Esta acción no se puede deshacer.');
    if (!confirmed) return;
    await deleteRoutine(routineId);
    const summaries = await loadRoutines();
    setRoutines(summaries);
  };

  const handleOpenWorkout = async (workoutId: string) => {
    const workout = await getWorkoutById(workoutId);
    if (!workout) return;
    const workoutExercises = await getWorkoutExercises(workout.id);
    const exerciseList = await listExercises();
    const exerciseMap = new Map(
      exerciseList.map((exercise) => [
        exercise.id,
        {
          name: getExerciseDisplayName(exercise, settings.language),
          metricType: exercise.metricType
        }
      ])
    );
    const exercises = await Promise.all(
      workoutExercises.map(async (exercise) => {
        const sets = await getWorkoutSets(exercise.id);
        const exerciseInfo = exerciseMap.get(exercise.exerciseId);
        const normalizedSets = sets.map((set) => ({
          weight: set.weight,
          reps: set.reps,
          duration: set.duration,
          distance: set.distance,
          rpe: set.rpe
        }));
        return {
          id: exercise.id,
          name: exerciseInfo?.name ?? exercise.name,
          metricType:
            inferMetricTypeFromSets(normalizedSets) ?? exerciseInfo?.metricType ?? 'weight_reps',
          notes: exercise.notes,
          sets: normalizedSets
        };
      })
    );
    setActiveWorkout({
      id: workout.id,
      routineName: workout.routineName ?? 'Entreno',
      startedAt: workout.startedAt,
      endedAt: workout.endedAt,
      tags: workout.tags ?? [],
      exercises
    });
  };

  const handleOpenAllWorkouts = async () => {
    const workouts = await listAllWorkouts();
    const summaries = await buildWorkoutSummaries(workouts);
    setAllWorkouts(summaries);
    setShowAllWorkouts(true);
  };

  const handleSelectWorkout = async (workoutId: string) => {
    await handleOpenWorkout(workoutId);
    setShowAllWorkouts(false);
  };

  const formatTimestamp = (value: string) => new Date(value).toLocaleString();

  const formatDuration = (seconds: number) => {
    if (!Number.isFinite(seconds)) return '-';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.round(seconds % 60);
    return `${minutes}m ${remainder}s`;
  };

  const inferMetricTypeFromSets = (
    sets: Array<{ weight?: number; reps?: number; duration?: number; distance?: number }>
  ) => {
    if (sets.some((set) => (set.distance ?? 0) > 0)) return 'distance';
    if (sets.some((set) => (set.duration ?? 0) > 0)) return 'time';
    if (sets.some((set) => (set.weight ?? 0) > 0 && set.reps !== undefined)) return 'weight_reps';
    if (sets.some((set) => set.reps !== undefined)) return 'reps';
    return undefined;
  };

  const formatSetValue = (
    metricType: string,
    set: { weight?: number; reps?: number; duration?: number; distance?: number }
  ) => {
    if (metricType === 'weight_reps') {
      if (set.weight === undefined || set.reps === undefined) return '-';
      return `${set.weight} x ${set.reps}`;
    }
    if (metricType === 'reps') {
      return set.reps !== undefined ? `${set.reps} reps` : '-';
    }
    if (metricType === 'distance') {
      return set.distance !== undefined ? `${set.distance} m` : '-';
    }
    if (metricType === 'time') {
      return set.duration !== undefined ? formatDuration(set.duration) : '-';
    }
    return '-';
  };

  const calculateVolume = (workout: WorkoutDetail | null) => {
    if (!workout) return 0;
    return workout.exercises.reduce((total, exercise) => {
      const exerciseVolume = exercise.sets.reduce((sum, set) => {
        const weight = set.weight ?? 0;
        const reps = set.reps ?? 0;
        return sum + weight * reps;
      }, 0);
      return total + exerciseVolume;
    }, 0);
  };

  const handleStartEmpty = () => {
    const payload: ActiveWorkoutSession = {
      id: `session-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      exercises: []
    };
    writeActiveSession(payload);
    navigate('/workout');
  };

  const handleStartRoutine = async (routineId: string) => {
    const detail = await getRoutineDetail(routineId);
    if (!detail) return;
    const exercises = await listExercises();
    const exerciseMap = new Map(exercises.map((exercise) => [exercise.id, exercise]));
    const lastWorkout = await getLastWorkoutForRoutine(routineId);
    const previousNotesByExercise = new Map<string, string>();
    const session: ActiveWorkoutSession = {
      id: `session-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      routineId,
      routineName: detail.routine.name,
      tags: detail.tags,
      originalExerciseIds: detail.exercises.map((entry) => entry.exerciseId),
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
          metricType: defaults?.metricTypeOverride ?? exercise?.metricType ?? 'weight_reps',
          catalogMetricType: exercise?.metricType ?? 'weight_reps',
          originalMetricType: defaults?.metricTypeOverride ?? exercise?.metricType ?? 'weight_reps',
          goalMode: defaults?.goalMode ?? 'auto',
          notes: '',
          restSeconds: defaults?.defaultRestSeconds ?? 0,
          equipment: exercise?.equipment ?? [],
          previousSets: [],
          sets
        };
      })
    };
    const previousSetsByExercise = new Map<
      string,
      Array<{ weight?: number; reps?: number; duration?: number; distance?: number }>
    >();
    const workoutExerciseMap = new Map<
      string,
      Array<{ weight?: number; reps?: number; duration?: number; distance?: number }>
    >();
    if (lastWorkout) {
      const workoutExercises = await getWorkoutExercises(lastWorkout.id);
      for (const workoutExercise of workoutExercises) {
        const sets = await getWorkoutSets(workoutExercise.id);
        workoutExerciseMap.set(
          workoutExercise.exerciseId,
          sets.map((set) => ({
            weight: set.weight,
            reps: set.reps,
            duration: set.duration,
            distance: set.distance
          }))
        );
        if (workoutExercise.notes) {
          previousNotesByExercise.set(workoutExercise.exerciseId, workoutExercise.notes);
        }
      }
    }
    for (const entry of detail.exercises) {
      let sets = workoutExerciseMap.get(entry.exerciseId) ?? [];
      if (!sets.length) {
        const latestSets = await getLatestExerciseSets(entry.exerciseId);
        sets = latestSets.map((set) => ({
          weight: set.weight,
          reps: set.reps,
          duration: set.duration,
          distance: set.distance
        }));
      }
      previousSetsByExercise.set(entry.exerciseId, sets);
    }
    session.exercises = await Promise.all(
      session.exercises.map(async (exercise) => {
        const nextExercise = {
          ...exercise,
          previousSets: previousSetsByExercise.get(exercise.exerciseId) ?? [],
          notes: previousNotesByExercise.get(exercise.exerciseId) ?? exercise.notes
        };
        const history = await listCompletedExerciseSessions(exercise.exerciseId, 2);
        return applySuggestedPrescription(applyProgressionSuggestions(nextExercise, history));
      })
    );
    writeActiveSession(session);
    navigate('/workout');
  };

  const routineCountLabel = useMemo(
    () => (routines.length === 1 ? 'Mis rutinas (1)' : `Mis rutinas (${routines.length})`),
    [routines.length]
  );
  const slugVolumes = useMemo(() => buildSlugVolumes(muscleVolumes), [muscleVolumes]);
  const activeSlugLabel = activeSlug ? SLUG_LABELS[activeSlug] ?? activeSlug : null;
  const activeSlugValue = activeSlug ? slugVolumes[activeSlug] ?? 0 : 0;

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
                  <div className="routine-actions">
                    <Link className="ghost-button" to={`/routines/${routine.id}`}>
                      Editar
                    </Link>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => handleDeleteRoutine(routine.id)}
                    >
                      Eliminar
                    </button>
                  </div>
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
          <h2>Estado muscular</h2>
          <div className="pill-row">
            <button
              className={`pill ${mapView === 'front' ? 'active' : ''}`}
              type="button"
              onClick={() => setMapView('front')}
            >
              Frente
            </button>
            <button
              className={`pill ${mapView === 'back' ? 'active' : ''}`}
              type="button"
              onClick={() => setMapView('back')}
            >
              Espalda
            </button>
          </div>
        </div>
        <div className="muscle-map compact">
          <div className="muscle-map-figure">
            <BodyMap
              view={mapView}
              muscleVolumes={muscleVolumes}
              activeSlug={activeSlug}
              onSelect={(slug) => setActiveSlug((prev) => (prev === slug ? null : slug))}
            />
            {activeSlugLabel ? (
              <div className="muscle-tooltip">
                <span>{activeSlugLabel}</span>
                <span className="muted">{Math.round(activeSlugValue)} kg</span>
              </div>
            ) : null}
          </div>
        </div>
        <p className="muted">Decaimiento 7 días · volumen</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Últimos entrenamientos</h2>
          <div className="inline">
            <span className="muted">{recentWorkouts.length ? 'Recientes' : 'Sin datos'}</span>
            {recentWorkouts.length ? (
              <button className="ghost-button" type="button" onClick={handleOpenAllWorkouts}>
                Ver más
              </button>
            ) : null}
          </div>
        </div>
        {recentWorkouts.length ? (
          <div className="recent-list">
            {recentWorkouts.slice(0, 4).map((workout) => (
              <button
                key={workout.id}
                className="compact-card compact-card-button"
                type="button"
                onClick={() => handleOpenWorkout(workout.id)}
              >
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
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">
            Aquí verás el resumen de tus últimas sesiones cuando completes entrenamientos.
          </p>
        )}
      </div>

      {activeWorkout ? (
        <div className="modal-overlay center" onClick={() => setActiveWorkout(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h2>{activeWorkout.routineName}</h2>
              <button className="ghost-button" type="button" onClick={() => setActiveWorkout(null)}>
                Cerrar
              </button>
            </div>
            <p className="muted">
              {formatTimestamp(activeWorkout.startedAt)} → {formatTimestamp(activeWorkout.endedAt)}
            </p>
            {activeWorkout.tags.length ? (
              <div className="compact-tags">
                {activeWorkout.tags.map((tag) => (
                  <span key={tag} className="tag-chip">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="metric-grid">
              <div>
                <p className="metric-label">Duración</p>
                <p className="metric-value">
                  {Math.max(
                    1,
                    Math.round(
                      (new Date(activeWorkout.endedAt).getTime() -
                        new Date(activeWorkout.startedAt).getTime()) /
                        60000
                    )
                  )}{' '}
                  min
                </p>
              </div>
              <div>
                <p className="metric-label">Volumen</p>
                <p className="metric-value">{calculateVolume(activeWorkout)} kg</p>
              </div>
            </div>
            <div className="modal-section">
              {activeWorkout.exercises.map((exercise) => (
                <div key={exercise.id} className="modal-exercise">
                  <h3>{exercise.name}</h3>
                  {exercise.notes ? <p className="muted">{exercise.notes}</p> : null}
                  <div className="modal-sets">
                    {exercise.sets.map((set, index) => (
                      <div key={`${exercise.id}-${index}`} className="modal-set-row">
                        <span>Set {index + 1}</span>
                        <span>
                          {formatSetValue(exercise.metricType, set)}
                        </span>
                        <span>{set.rpe ? `RPE ${set.rpe}` : 'RPE -'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showAllWorkouts ? (
        <div className="modal-overlay center" onClick={() => setShowAllWorkouts(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h2>Todos los entrenamientos</h2>
              <button className="ghost-button" type="button" onClick={() => setShowAllWorkouts(false)}>
                Cerrar
              </button>
            </div>
            {allWorkouts.length ? (
              <div className="modal-scroll">
                {allWorkouts.map((workout) => (
                  <button
                    key={workout.id}
                    className="compact-card compact-card-button"
                    type="button"
                    onClick={() => handleSelectWorkout(workout.id)}
                  >
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
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">Aún no hay entrenamientos guardados.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
