import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { AdvancedSetType, PlannedWorkoutSeriesKind, PlannedWorkoutStatus } from '../data/db';
import {
  getWorkoutById,
  getWorkoutExercises,
  getWorkoutSets,
  listAllWorkouts
} from '../data/workouts';
import { getExerciseDisplayName, listExercises } from '../data/exercises';
import { useSettings } from '../data/SettingsProvider';
import { countsForVolume, getSetTypeMeta } from '../data/setTypes';
import { getMonthRange, getTodayLocalDate, formatLocalDate, parseLocalDate } from '../data/localDate';
import {
  createPlannedWorkoutSeries,
  deletePlannedWorkoutSeries,
  listPlannedOccurrencesForRange,
  upsertPlannedWorkoutOccurrence
} from '../data/plans';
import { listRoutines } from '../data/routines';
import { writeActiveSession } from '../data/activeSession';
import { buildRoutineSession } from '../data/sessionFactory';

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
      setType?: AdvancedSetType;
      weight?: number;
      reps?: number;
      duration?: number;
      distance?: number;
      rpe?: number;
    }>;
  }>;
}

interface CalendarPlan {
  id: string;
  seriesId: string;
  routineId: string;
  routineName: string;
  occurrenceDate: string;
  status: PlannedWorkoutStatus;
  workoutId?: string;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' }
];

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

const formatPlanStatus = (status: PlannedWorkoutStatus) => {
  if (status === 'completed') return 'Completado';
  if (status === 'omitted') return 'Omitido';
  return 'Pendiente';
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
  const navigate = useNavigate();
  const location = useLocation();
  const [workouts, setWorkouts] = useState<CalendarWorkout[]>([]);
  const [plans, setPlans] = useState<CalendarPlan[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutDetail | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<CalendarPlan | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [routineOptions, setRoutineOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannerRoutineId, setPlannerRoutineId] = useState('');
  const [plannerDate, setPlannerDate] = useState(getTodayLocalDate());
  const [plannerKind, setPlannerKind] = useState<PlannedWorkoutSeriesKind>('once');
  const [plannerWeekdays, setPlannerWeekdays] = useState<number[]>([]);
  const [plannerEndDate, setPlannerEndDate] = useState('');
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const loadCalendarData = async () => {
    const [allWorkouts, routines] = await Promise.all([listAllWorkouts(), listRoutines()]);
    const summaries: CalendarWorkout[] = [];
    for (const workout of allWorkouts) {
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
    setWorkouts(summaries);
    setRoutineOptions(routines.map((routine) => ({ id: routine.id, name: routine.name })));
  };

  const loadPlans = async () => {
    const { start, end } = getMonthRange(visibleMonth);
    const [occurrences, routines] = await Promise.all([
      listPlannedOccurrencesForRange(start, end),
      listRoutines()
    ]);
    const routineMap = new Map(routines.map((routine) => [routine.id, routine.name]));
    setPlans(
      occurrences.map((occurrence) => ({
        id: occurrence.id,
        seriesId: occurrence.seriesId,
        routineId: occurrence.routineId,
        routineName: routineMap.get(occurrence.routineId) ?? 'Rutina eliminada',
        occurrenceDate: occurrence.occurrenceDate,
        status: occurrence.status,
        workoutId: occurrence.workoutId
      }))
    );
  };

  useEffect(() => {
    void loadCalendarData();
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [visibleMonth]);

  useEffect(() => {
    const state = location.state as
      | {
          plannerRoutineId?: string;
          openPlanner?: boolean;
          date?: string;
          selectedDate?: string;
          visibleMonth?: string;
        }
      | null;
    if (!state) return;
    if (state.visibleMonth) {
      const visible = parseLocalDate(state.visibleMonth);
      setVisibleMonth(new Date(visible.getFullYear(), visible.getMonth(), 1));
    }
    if (state.selectedDate) {
      setSelectedDateKey(state.selectedDate);
    } else if (state.visibleMonth || state.openPlanner || state.plannerRoutineId || state.date) {
      setSelectedDateKey(null);
    }
    if (state.plannerRoutineId) {
      setPlannerRoutineId(state.plannerRoutineId);
    }
    if (state.date) {
      setPlannerDate(state.date);
    }
    if (state.openPlanner) {
      setPlannerOpen(true);
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const workoutsByDate = useMemo(() => {
    const map: Record<string, CalendarWorkout[]> = {};
    workouts.forEach((workout) => {
      const key = formatLocalDate(new Date(workout.endedAt));
      if (!map[key]) map[key] = [];
      map[key].push(workout);
    });
    return map;
  }, [workouts]);

  const plansByDate = useMemo(() => {
    const map: Record<string, CalendarPlan[]> = {};
    plans.forEach((plan) => {
      if (!map[plan.occurrenceDate]) map[plan.occurrenceDate] = [];
      map[plan.occurrenceDate].push(plan);
    });
    return map;
  }, [plans]);

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
  const selectedPlans = selectedDateKey ? plansByDate[selectedDateKey] ?? [] : [];

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

  const resetPlanner = () => {
    setPlannerRoutineId('');
    setPlannerDate(selectedDateKey ?? getTodayLocalDate());
    setPlannerKind('once');
    setPlannerWeekdays([]);
    setPlannerEndDate('');
  };

  const openPlanner = (date?: string, routineId?: string) => {
    resetPlanner();
    if (date) setPlannerDate(date);
    if (routineId) setPlannerRoutineId(routineId);
    setPlannerOpen(true);
  };

  const togglePlannerWeekday = (weekday: number) => {
    setPlannerWeekdays((prev) =>
      prev.includes(weekday)
        ? prev.filter((value) => value !== weekday)
        : [...prev, weekday].sort((a, b) => a - b)
    );
  };

  const handleCreatePlan = async () => {
    if (!plannerRoutineId || !plannerDate) return;
    await createPlannedWorkoutSeries({
      routineId: plannerRoutineId,
      kind: plannerKind,
      startDate: plannerDate,
      weekdays: plannerKind === 'weekdays' ? plannerWeekdays : undefined,
      endDate: plannerEndDate || undefined
    });
    setPlannerOpen(false);
    setSelectedDateKey(plannerDate);
    await loadPlans();
  };

  const handleStartPlannedRoutine = async (plan: CalendarPlan) => {
    const session = await buildRoutineSession({
      routineId: plan.routineId,
      language: settings.language,
      plannedOccurrence: {
        seriesId: plan.seriesId,
        occurrenceDate: plan.occurrenceDate,
        routineId: plan.routineId
      }
    });
    if (!session) return;
    writeActiveSession(session);
    navigate('/workout');
  };

  const handleOmitPlan = async (plan: CalendarPlan) => {
    await upsertPlannedWorkoutOccurrence(plan.seriesId, plan.occurrenceDate, 'omitted');
    await loadPlans();
    setSelectedPlan((current) =>
      current?.id === plan.id ? { ...current, status: 'omitted' } : current
    );
  };

  const handleUnschedulePlan = async (plan: CalendarPlan) => {
    const confirmed = window.confirm(
      '¿Eliminar esta programación? Se quitarán las ocurrencias futuras de esta serie.'
    );
    if (!confirmed) return;
    await deletePlannedWorkoutSeries(plan.seriesId);
    setSelectedPlan(null);
    await loadPlans();
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
              setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
            }
          >
            ‹
          </button>
          <h2>{formatMonthLabel(visibleMonth)}</h2>
          <button
            className="ghost-button"
            type="button"
            onClick={() =>
              setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
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
            const key = formatLocalDate(date);
            const dayWorkouts = workoutsByDate[key] ?? [];
            const dayPlans = plansByDate[key] ?? [];
            const isToday = getTodayLocalDate() === key;
            const hasCompletedPlan = dayPlans.some((plan) => plan.status === 'completed');
            const hasPendingPlan = dayPlans.some((plan) => plan.status === 'pending');
            const hasOmittedPlan = dayPlans.some((plan) => plan.status === 'omitted');
            const hasAny = dayWorkouts.length > 0 || dayPlans.length > 0;
            return (
              <button
                key={key}
                className={`calendar-day ${dayWorkouts.length ? 'has-workout' : ''} ${
                  hasPendingPlan ? 'has-plan-pending' : ''
                } ${hasCompletedPlan ? 'has-plan-completed' : ''} ${
                  hasOmittedPlan ? 'has-plan-omitted' : ''
                } ${isToday ? 'today' : ''}`}
                type="button"
                onClick={() => {
                  if (!hasAny) return;
                  setSelectedDateKey(key);
                }}
              >
                <span>{date.getDate()}</span>
                <span className="calendar-markers">
                  {dayWorkouts.length ? <span className="calendar-dot" /> : null}
                  {hasPendingPlan ? <span className="calendar-ring" /> : null}
                  {hasCompletedPlan ? <span className="calendar-check">✓</span> : null}
                  {hasOmittedPlan ? <span className="calendar-omit-dot" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card planning-card">
        <div>
          <h2>Planificación</h2>
          <p className="muted">
            Programa rutinas futuras y series recurrentes sin mezclar agenda con tu historial.
          </p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => openPlanner(selectedDateKey ?? getTodayLocalDate())}
        >
          Planificar rutina
        </button>
      </div>

      {selectedDateKey ? (
        <div className="modal-overlay center" onClick={() => setSelectedDateKey(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h2>
                {parseLocalDate(selectedDateKey).toLocaleDateString('es-ES', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long'
                })}
              </h2>
              <button className="ghost-button" type="button" onClick={() => setSelectedDateKey(null)}>
                Cerrar
              </button>
            </div>
            <div className="calendar-day-toolbar">
              <button className="ghost-button" type="button" onClick={() => openPlanner(selectedDateKey)}>
                Planificar rutina
              </button>
            </div>
            {selectedPlans.length ? (
              <div className="modal-section">
                <h3>Planificados</h3>
                <div className="modal-scroll">
                  {selectedPlans.map((plan) => (
                    <button
                      key={plan.id}
                      className={`compact-card compact-card-button plan-card plan-card-${plan.status}`}
                      type="button"
                      onClick={() => setSelectedPlan(plan)}
                    >
                      <div>
                        <p className="compact-title">{plan.routineName}</p>
                        <p className="compact-meta">{formatPlanStatus(plan.status)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {selectedWorkouts.length ? (
              <div className="modal-section">
                <h3>Realizados</h3>
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
              </div>
            ) : null}
            {!selectedPlans.length && !selectedWorkouts.length ? (
              <p className="muted">No hay elementos para este día.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedPlan ? (
        <div className="modal-overlay center" onClick={() => setSelectedPlan(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h2>{selectedPlan.routineName}</h2>
              <button className="ghost-button" type="button" onClick={() => setSelectedPlan(null)}>
                Cerrar
              </button>
            </div>
            <p className="muted">
              {selectedPlan.occurrenceDate === getTodayLocalDate()
                ? `Hoy te toca ${selectedPlan.routineName}.`
                : `Te toca ${selectedPlan.routineName} el ${parseLocalDate(
                    selectedPlan.occurrenceDate
                  ).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}.`}
            </p>
            <div className="metric-grid">
              <div>
                <p className="metric-label">Estado</p>
                <p className="metric-value">{formatPlanStatus(selectedPlan.status)}</p>
              </div>
              <div>
                <p className="metric-label">Fecha</p>
                <p className="metric-value">{selectedPlan.occurrenceDate}</p>
              </div>
            </div>
            <div className="inline-actions plan-detail-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => void handleStartPlannedRoutine(selectedPlan)}
              >
                Empezar rutina
              </button>
              {selectedPlan.status !== 'completed' ? (
                <button
                  className="ghost-button danger"
                  type="button"
                  onClick={() => void handleOmitPlan(selectedPlan)}
                >
                  Omitir
                </button>
              ) : null}
              <button
                className="ghost-button danger"
                type="button"
                onClick={() => void handleUnschedulePlan(selectedPlan)}
              >
                Desprogramar
              </button>
              {selectedPlan.status === 'completed' && selectedPlan.workoutId ? (
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setSelectedPlan(null);
                    void handleOpenWorkout(selectedPlan.workoutId!);
                  }}
                >
                  Ver workout
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {plannerOpen ? (
        <div className="modal-overlay bottom" onClick={() => setPlannerOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h2>Planificar rutina</h2>
              <button className="ghost-button" type="button" onClick={() => setPlannerOpen(false)}>
                Cerrar
              </button>
            </div>
            <div className="field">
              <label className="label" htmlFor="planner-routine">
                Rutina
              </label>
              <select
                id="planner-routine"
                value={plannerRoutineId}
                onChange={(event) => setPlannerRoutineId(event.target.value)}
              >
                <option value="">Selecciona rutina</option>
                {routineOptions.map((routine) => (
                  <option key={routine.id} value={routine.id}>
                    {routine.name}
                  </option>
                ))}
              </select>
              <label className="label" htmlFor="planner-date">
                Fecha inicio
              </label>
              <input
                id="planner-date"
                type="date"
                value={plannerDate}
                onChange={(event) => setPlannerDate(event.target.value)}
              />
              <label className="label" htmlFor="planner-kind">
                Recurrencia
              </label>
              <select
                id="planner-kind"
                value={plannerKind}
                onChange={(event) => setPlannerKind(event.target.value as PlannedWorkoutSeriesKind)}
              >
                <option value="once">Una vez</option>
                <option value="weekly">Semanal</option>
                <option value="weekdays">Días específicos</option>
              </select>
              {plannerKind === 'weekdays' ? (
                <div className="weekday-selector">
                  {WEEKDAY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      className={`pill ${plannerWeekdays.includes(option.value) ? 'active' : ''}`}
                      type="button"
                      onClick={() => togglePlannerWeekday(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {plannerKind !== 'once' ? (
                <>
                  <label className="label" htmlFor="planner-end-date">
                    Fecha fin (opcional)
                  </label>
                  <input
                    id="planner-end-date"
                    type="date"
                    value={plannerEndDate}
                    onChange={(event) => setPlannerEndDate(event.target.value)}
                  />
                </>
              ) : null}
              <button
                className="primary-button"
                type="button"
                disabled={
                  !plannerRoutineId ||
                  !plannerDate ||
                  (plannerKind === 'weekdays' && plannerWeekdays.length === 0)
                }
                onClick={() => void handleCreatePlan()}
              >
                Guardar planificación
              </button>
            </div>
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
                        <span className="modal-set-label">
                          <span className={`set-type-badge ${getSetTypeMeta(set.setType, index).type}`}>
                            {getSetTypeMeta(set.setType, index).badge}
                          </span>
                          <span>{getSetTypeMeta(set.setType, index).label}</span>
                        </span>
                        <span>{formatSetValue(exercise.metricType, set)}</span>
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
