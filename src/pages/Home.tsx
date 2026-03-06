import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createRoutine, deleteRoutine, getRoutineDetail, listRoutines } from '../data/routines';
import { listExercises, getExerciseDisplayName } from '../data/exercises';
import type { AdvancedSetType } from '../data/db';
import {
  getWorkoutById,
  getWorkoutExercises,
  getWorkoutSets,
  listAllWorkouts,
  listRecentWorkouts,
  listWorkoutsSince
} from '../data/workouts';
import { ActiveWorkoutSession, writeActiveSession } from '../data/activeSession';
import { useSettings } from '../data/SettingsProvider';
import { countsForVolume, getSetTypeMeta } from '../data/setTypes';
import { BodyMap } from '../components/BodyMap';
import {
  buildSlugVolumes,
  getMuscleWeights,
  SLUG_LABELS,
  MUSCLE_DECAY_HALF_LIFE_DAYS
} from '../components/bodyMapData';
import { buildRoutineSession } from '../data/sessionFactory';
import { getMonthRange, formatLocalDate, parseLocalDate } from '../data/localDate';
import { listPlannedOccurrencesForRange } from '../data/plans';

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
      setType?: AdvancedSetType;
      weight?: number;
      reps?: number;
      duration?: number;
      distance?: number;
      rpe?: number;
    }>;
  }>;
}

interface CalendarPreviewPlan {
  id: string;
  routineName: string;
  occurrenceDate: string;
  status: 'pending' | 'completed' | 'omitted';
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const formatMonthLabel = (date: Date) => {
  const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

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
  const [activityTab, setActivityTab] = useState<'workouts' | 'calendar'>('workouts');
  const [calendarPreviewMonth, setCalendarPreviewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarWorkoutDateKeys, setCalendarWorkoutDateKeys] = useState<string[]>([]);
  const [calendarPlans, setCalendarPlans] = useState<CalendarPreviewPlan[]>([]);

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
      const allWorkoutRows = await listAllWorkouts();
      const summaries = await buildWorkoutSummaries(workouts);
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const muscleWorkouts = await listWorkoutsSince(since.toISOString());
      const exercises = await listExercises();
      const exerciseMuscles = new Map(
        exercises.map((exercise) => [
          exercise.id,
          {
            primary: exercise.muscles,
            secondary: exercise.secondaryMuscles ?? []
          }
        ])
      );
      const muscleTotals: Record<string, number> = {};
      const now = Date.now();
      for (const workout of muscleWorkouts) {
        const workoutExercises = await getWorkoutExercises(workout.id);
        const workoutTime = new Date(workout.endedAt).getTime();
        const daysSince = Math.max(0, (now - workoutTime) / (1000 * 60 * 60 * 24));
        const decay = Math.exp((-Math.log(2) * daysSince) / MUSCLE_DECAY_HALF_LIFE_DAYS);
        for (const exercise of workoutExercises) {
          const sets = await getWorkoutSets(exercise.id);
          const muscleProfile = exerciseMuscles.get(exercise.exerciseId) ?? {
            primary: [],
            secondary: []
          };
          const weightedMuscles = getMuscleWeights(muscleProfile.primary, muscleProfile.secondary);
          for (const set of sets) {
            if (!countsForVolume(set.setType)) continue;
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
      setCalendarWorkoutDateKeys(
        allWorkoutRows.map((workout) => formatLocalDate(new Date(workout.endedAt)))
      );
    };
    void loadData();
    return () => {
      active = false;
    };
  }, [settings.language]);

  useEffect(() => {
    let active = true;
    const loadCalendarPreview = async () => {
      const { start, end } = getMonthRange(calendarPreviewMonth);
      const [occurrences, routineRows] = await Promise.all([
        listPlannedOccurrencesForRange(start, end),
        listRoutines()
      ]);
      const routineMap = new Map(routineRows.map((routine) => [routine.id, routine.name]));
      if (!active) return;
      setCalendarPlans(
        occurrences.map((occurrence) => ({
          id: occurrence.id,
          routineName: routineMap.get(occurrence.routineId) ?? 'Rutina eliminada',
          occurrenceDate: occurrence.occurrenceDate,
          status: occurrence.status
        }))
      );
    };
    void loadCalendarPreview();
    return () => {
      active = false;
    };
  }, [calendarPreviewMonth]);

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
          setType: set.setType,
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
        if (!countsForVolume(set.setType)) return sum;
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
    const session = await buildRoutineSession({
      routineId,
      language: settings.language
    });
    if (!session) return;
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
  const calendarPlansByDate = useMemo(() => {
    const map: Record<string, CalendarPreviewPlan[]> = {};
    calendarPlans.forEach((plan) => {
      if (!map[plan.occurrenceDate]) map[plan.occurrenceDate] = [];
      map[plan.occurrenceDate].push(plan);
    });
    return map;
  }, [calendarPlans]);
  const previewDayCells = useMemo(() => {
    const year = calendarPreviewMonth.getFullYear();
    const month = calendarPreviewMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekStartsOn = 1;
    const offset = (firstDay.getDay() - weekStartsOn + 7) % 7;
    const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
    return Array.from({ length: totalCells }, (_, index) => {
      const dayIndex = index - offset + 1;
      if (dayIndex < 1 || dayIndex > daysInMonth) return null;
      return new Date(year, month, dayIndex);
    });
  }, [calendarPreviewMonth]);
  const upcomingPlans = useMemo(() => {
    const todayKey = formatLocalDate(new Date());
    return calendarPlans
      .filter((plan) => plan.status === 'pending' && plan.occurrenceDate >= todayKey)
      .sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate))
      .slice(0, 3);
  }, [calendarPlans]);

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
        <div className="activity-card-header">
          <div>
            <h2>Actividad</h2>
          </div>
        </div>
        <div className="activity-tabs" role="tablist" aria-label="Actividad">
          <button
            className={`activity-tab ${activityTab === 'workouts' ? 'active' : ''}`}
            type="button"
            onClick={() => setActivityTab('workouts')}
          >
            Entrenamientos
          </button>
          <button
            className={`activity-tab ${activityTab === 'calendar' ? 'active' : ''}`}
            type="button"
            onClick={() => setActivityTab('calendar')}
          >
            Calendario
          </button>
        </div>
        {activityTab === 'workouts' ? (
          recentWorkouts.length ? (
            <div className="activity-panel">
              <div className="activity-toolbar">
                <div>
                  <p className="activity-kicker">Últimos entrenamientos</p>
                  <p className="muted">Tus 4 sesiones más recientes.</p>
                </div>
                <button className="activity-link-button" type="button" onClick={handleOpenAllWorkouts}>
                  Ver más
                </button>
              </div>
              <div className="activity-list">
                {recentWorkouts.slice(0, 4).map((workout) => (
                  <button
                    key={workout.id}
                    className="activity-item"
                    type="button"
                    onClick={() => handleOpenWorkout(workout.id)}
                  >
                    <div className="activity-item-copy">
                      <p className="activity-item-title">{workout.routineName}</p>
                      <p className="activity-item-meta">
                        {new Date(workout.createdAt).toLocaleDateString()} · {workout.setCount} sets
                      </p>
                      {workout.tags.length ? (
                        <div className="compact-tags activity-item-tags">
                          {workout.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="tag-chip">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <span className="activity-item-count">{workout.setCount}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="activity-empty">
              <p className="activity-kicker">Sin entrenamientos recientes</p>
              <p className="muted">
                Aquí verás el resumen de tus últimas sesiones cuando completes entrenamientos.
              </p>
            </div>
          )
        ) : (
          <div className="activity-panel">
            <div className="activity-calendar-toolbar">
              <div className="activity-month-nav">
                <button
                  className="activity-nav-button"
                  type="button"
                  aria-label="Mes anterior"
                  onClick={() =>
                    setCalendarPreviewMonth(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                    )
                  }
                >
                  ‹
                </button>
                <div className="activity-month-copy">
                  <h3>{formatMonthLabel(calendarPreviewMonth)}</h3>
                </div>
                <button
                  className="activity-nav-button"
                  type="button"
                  aria-label="Mes siguiente"
                  onClick={() =>
                    setCalendarPreviewMonth(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    )
                  }
                >
                  ›
                </button>
              </div>
              <button
                className="activity-calendar-link"
                type="button"
                onClick={() =>
                  navigate('/calendar', {
                    state: {
                      visibleMonth: formatLocalDate(calendarPreviewMonth)
                    }
                  })
                }
              >
                Abrir calendario
              </button>
            </div>
            <div className="calendar-grid activity-calendar-grid">
              {WEEKDAYS.map((day) => (
                <span key={day} className="calendar-weekday">
                  {day}
                </span>
              ))}
              {previewDayCells.map((date, index) => {
                if (!date) {
                  return <div key={`home-empty-${index}`} className="calendar-day empty" />;
                }
                const key = formatLocalDate(date);
                const hasWorkout = calendarWorkoutDateKeys.includes(key);
                const dayPlans = calendarPlansByDate[key] ?? [];
                const hasCompletedPlan = dayPlans.some((plan) => plan.status === 'completed');
                const hasPendingPlan = dayPlans.some((plan) => plan.status === 'pending');
                const hasOmittedPlan = dayPlans.some((plan) => plan.status === 'omitted');
                const isToday = key === formatLocalDate(new Date());
                return (
                  <button
                    key={key}
                    className={`calendar-day activity-calendar-day ${hasWorkout ? 'has-workout' : ''} ${
                      hasPendingPlan ? 'has-plan-pending' : ''
                    } ${hasCompletedPlan ? 'has-plan-completed' : ''} ${
                      hasOmittedPlan ? 'has-plan-omitted' : ''
                    } ${isToday ? 'today' : ''}`}
                    type="button"
                    onClick={() =>
                      navigate('/calendar', {
                        state: {
                          selectedDate: key,
                          visibleMonth: formatLocalDate(calendarPreviewMonth)
                        }
                      })
                    }
                  >
                    <span>{date.getDate()}</span>
                    <span className="calendar-markers">
                      {hasWorkout ? <span className="calendar-dot" /> : null}
                      {hasPendingPlan ? <span className="calendar-ring" /> : null}
                      {hasCompletedPlan ? <span className="calendar-check">✓</span> : null}
                      {hasOmittedPlan ? <span className="calendar-omit-dot" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
            {upcomingPlans.length ? (
              <div className="activity-subsection">
                <div className="activity-toolbar">
                  <div>
                    <p className="activity-kicker">Próximas planificaciones</p>
                    <p className="muted">Acceso rápido a tus próximos entrenamientos.</p>
                  </div>
                </div>
                <div className="activity-list">
                {upcomingPlans.map((plan) => (
                  <button
                    key={plan.id}
                    className="activity-item"
                    type="button"
                    onClick={() =>
                      navigate('/calendar', {
                        state: {
                          selectedDate: plan.occurrenceDate,
                          visibleMonth: plan.occurrenceDate
                        }
                      })
                    }
                  >
                    <div className="activity-item-copy">
                      <p className="activity-item-title">{plan.routineName}</p>
                      <p className="activity-item-meta">
                        {parseLocalDate(plan.occurrenceDate).toLocaleDateString()} ·{' '}
                        {plan.status === 'pending'
                          ? 'Pendiente'
                          : plan.status === 'completed'
                            ? 'Completado'
                            : 'Omitido'}
                      </p>
                    </div>
                    <span className={`activity-status-pill ${plan.status}`}>
                      {plan.status === 'pending'
                        ? 'Pend.'
                        : plan.status === 'completed'
                          ? 'OK'
                          : 'Omit.'}
                    </span>
                  </button>
                ))}
              </div>
              </div>
            ) : (
              <div className="activity-empty">
                <p className="activity-kicker">Sin planes próximos</p>
                <p className="muted">Programa una rutina desde el calendario para verla aquí.</p>
              </div>
            )}
          </div>
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
                        <span className="modal-set-label">
                          <span className={`set-type-badge ${getSetTypeMeta(set.setType, index).type}`}>
                            {getSetTypeMeta(set.setType, index).badge}
                          </span>
                          <span>{getSetTypeMeta(set.setType, index).label}</span>
                        </span>
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
