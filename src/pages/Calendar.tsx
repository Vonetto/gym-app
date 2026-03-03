import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getWorkoutById,
  getWorkoutExercises,
  getWorkoutSets,
  listAllWorkouts
} from '../data/workouts';
import { getExerciseDisplayName, listExercises } from '../data/exercises';
import { useSettings } from '../data/SettingsProvider';

interface CalendarWorkout {
  id: string;
  routineName: string;
  startedAt: string;
  endedAt: string;
  tags: string[];
  setCount: number;
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

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatMonthLabel = (date: Date) => {
  const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

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

export function Calendar() {
  const { settings } = useSettings();
  const [workouts, setWorkouts] = useState<CalendarWorkout[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutDetail | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    let active = true;
    const loadWorkouts = async () => {
      const all = await listAllWorkouts();
      const summaries: CalendarWorkout[] = [];
      for (const workout of all) {
        const workoutExercises = await getWorkoutExercises(workout.id);
        const setCounts = await Promise.all(
          workoutExercises.map((exercise) => getWorkoutSets(exercise.id))
        );
        const setCount = setCounts.reduce((acc, sets) => acc + sets.length, 0);
        summaries.push({
          id: workout.id,
          routineName: workout.routineName ?? 'Entreno',
          startedAt: workout.startedAt,
          endedAt: workout.endedAt,
          tags: workout.tags ?? [],
          setCount
        });
      }
      if (!active) return;
      setWorkouts(summaries);
    };
    void loadWorkouts();
    return () => {
      active = false;
    };
  }, []);

  const workoutsByDate = useMemo(() => {
    const map: Record<string, CalendarWorkout[]> = {};
    workouts.forEach((workout) => {
      const key = formatDateKey(new Date(workout.endedAt));
      if (!map[key]) map[key] = [];
      map[key].push(workout);
    });
    return map;
  }, [workouts]);

  const dayCells = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
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
  }, [visibleMonth]);

  const selectedWorkouts = selectedDateKey ? workoutsByDate[selectedDateKey] ?? [] : [];

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

  return (
    <section className="stack wide">
      <div className="profile-header">
        <div>
          <p className="profile-name">Calendario</p>
          <p className="muted">Entrenos por día y planificación futura.</p>
        </div>
        <Link className="ghost-button" to="/profile">
          Volver
        </Link>
      </div>

      <div className="card">
        <div className="calendar-header">
          <button
            className="ghost-button"
            type="button"
            onClick={() =>
              setVisibleMonth(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
              )
            }
          >
            ‹
          </button>
          <h2>{formatMonthLabel(visibleMonth)}</h2>
          <button
            className="ghost-button"
            type="button"
            onClick={() =>
              setVisibleMonth(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
              )
            }
          >
            ›
          </button>
        </div>
        <div className="calendar-grid">
          {WEEKDAYS.map((day) => (
            <span key={day} className="calendar-weekday">
              {day}
            </span>
          ))}
          {dayCells.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="calendar-day empty" />;
            }
            const key = formatDateKey(date);
            const dayWorkouts = workoutsByDate[key] ?? [];
            const isToday = formatDateKey(new Date()) === key;
            return (
              <button
                key={key}
                className={`calendar-day ${dayWorkouts.length ? 'has-workout' : ''} ${
                  isToday ? 'today' : ''
                }`}
                type="button"
                onClick={() => {
                  if (!dayWorkouts.length) return;
                  setSelectedDateKey(key);
                }}
              >
                <span>{date.getDate()}</span>
                {dayWorkouts.length ? <span className="calendar-dot" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2>Planificación</h2>
        <p className="muted">
          Pronto podrás programar rutinas recurrentes y recibir recordatorios.
        </p>
      </div>

      {selectedDateKey ? (
        <div className="modal-overlay center" onClick={() => setSelectedDateKey(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h2>Entrenos del día</h2>
              <button className="ghost-button" type="button" onClick={() => setSelectedDateKey(null)}>
                Cerrar
              </button>
            </div>
            {selectedWorkouts.length ? (
              <div className="modal-scroll">
                {selectedWorkouts.map((workout) => (
                  <button
                    key={workout.id}
                    className="compact-card compact-card-button"
                    type="button"
                    onClick={() => handleOpenWorkout(workout.id)}
                  >
                    <div>
                      <p className="compact-title">{workout.routineName}</p>
                      <p className="compact-meta">
                        {formatTime(workout.startedAt)} - {formatTime(workout.endedAt)} ·{' '}
                        {workout.setCount} sets
                      </p>
                    </div>
                    {workout.tags.length ? (
                      <div className="compact-tags">
                        {workout.tags.map((tag) => (
                          <span key={tag} className="tag-chip">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">No hay entrenamientos para este día.</p>
            )}
          </div>
        </div>
      ) : null}

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
              {new Date(activeWorkout.startedAt).toLocaleString()} →{' '}
              {new Date(activeWorkout.endedAt).toLocaleString()}
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
    </section>
  );
}
