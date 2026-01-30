import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWorkoutExercises, getWorkoutSets, listWorkoutsSince } from '../data/workouts';
import { useSettings } from '../data/SettingsProvider';

type MetricKey = 'duration' | 'volume' | 'reps';

interface WorkoutSummary {
  id: string;
  name: string;
  endedAt: string;
  setCount: number;
  durationMinutes: number;
  volume: number;
  reps: number;
}

interface PrEntry {
  exerciseId: string;
  name: string;
  oneRm: number;
  weight: number;
  reps: number;
}

const ONE_RM_DIVISOR = 30;

const formatShortDate = (value: string) => {
  const date = new Date(value);
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = date
    .toLocaleDateString('es-ES', { month: 'short' })
    .replace('.', '')
    .slice(0, 3);
  return `${month}-${day}`;
};

export function Profile() {
  const { settings } = useSettings();
  const [metric, setMetric] = useState<MetricKey>('duration');
  const [activeBar, setActiveBar] = useState<number | null>(null);
  const [summary, setSummary] = useState({
    workouts: 0,
    minutes: 0,
    volume: 0,
    reps: 0,
    sets: 0
  });
  const [prs, setPrs] = useState<PrEntry[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSummary[]>([]);
  const [chartWorkouts, setChartWorkouts] = useState<WorkoutSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadStats = async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - (settings.statsRangeDays ?? 30));
      const sinceIso = since.toISOString();
      const workouts = await listWorkoutsSince(sinceIso);
      const sorted = workouts.sort((a, b) => b.endedAt.localeCompare(a.endedAt));
      const prMap = new Map<string, PrEntry>();
      const summaries: WorkoutSummary[] = [];
      let totalMinutes = 0;
      let totalVolume = 0;
      let totalReps = 0;
      let totalSets = 0;

      for (const workout of sorted) {
        const workoutExercises = await getWorkoutExercises(workout.id);
        let workoutSets = 0;
        let workoutVolume = 0;
        let workoutReps = 0;

        for (const exercise of workoutExercises) {
          const sets = await getWorkoutSets(exercise.id);
          workoutSets += sets.length;
          for (const set of sets) {
            const weight = set.weight ?? 0;
            const reps = set.reps ?? 0;
            workoutVolume += weight * reps;
            workoutReps += reps;
            if (weight > 0 && reps > 0) {
              const oneRm = reps <= 1 ? weight : weight * (1 + reps / ONE_RM_DIVISOR);
              const existing = prMap.get(exercise.exerciseId);
              if (!existing || oneRm > existing.oneRm) {
                prMap.set(exercise.exerciseId, {
                  exerciseId: exercise.exerciseId,
                  name: exercise.name,
                  oneRm,
                  weight,
                  reps
                });
              }
            }
          }
        }

        const durationMinutes = Math.max(
          1,
          Math.round(
            (new Date(workout.endedAt).getTime() - new Date(workout.startedAt).getTime()) / 60000
          )
        );
        totalMinutes += durationMinutes;
        totalVolume += workoutVolume;
        totalReps += workoutReps;
        totalSets += workoutSets;
        summaries.push({
          id: workout.id,
          name: workout.routineName ?? 'Entreno',
          endedAt: workout.endedAt,
          setCount: workoutSets,
          durationMinutes,
          volume: workoutVolume,
          reps: workoutReps
        });

      }

      if (!active) return;
      setSummary({
        workouts: summaries.length,
        minutes: totalMinutes,
        volume: Math.round(totalVolume),
        reps: Math.round(totalReps),
        sets: totalSets
      });
      setPrs(
        Array.from(prMap.values())
          .sort((a, b) => b.oneRm - a.oneRm)
          .slice(0, 5)
      );
      setRecentWorkouts(summaries.slice(0, 5));
      setChartWorkouts([...summaries].reverse());
      setLoading(false);
    };
    void loadStats();
    return () => {
      active = false;
    };
  }, [settings.statsRangeDays]);

  const chartData = useMemo(() => {
    const values = chartWorkouts.map((workout) => {
      if (metric === 'volume') return workout.volume;
      if (metric === 'reps') return workout.reps;
      return workout.durationMinutes;
    });
    const max = Math.max(1, ...values);
    const count = chartWorkouts.length;
    const labelStep = Math.max(1, Math.ceil(count / 8));
    return chartWorkouts.map((workout, index) => {
      const showLabel = index % labelStep === 0 || index === count - 1;
      return {
        label: formatShortDate(workout.endedAt),
        showLabel,
        value: values[index],
        raw: values[index],
        height: Math.round((values[index] / max) * 100)
      };
    });
  }, [chartWorkouts, metric]);

  const chartMax = useMemo(() => {
    const values = chartData.map((item) => item.raw);
    return Math.max(0, ...values);
  }, [chartData]);

  const yTicks = useMemo(() => {
    if (chartMax <= 0) return [0, 0, 0, 0];
    const top = Math.ceil(chartMax);
    const midHigh = Math.round(top * 0.66);
    const midLow = Math.round(top * 0.33);
    return [top, midHigh, midLow, 0];
  }, [chartMax]);

  const formatYAxisValue = (value: number) => {
    if (metric === 'duration') return `${value}m`;
    if (metric === 'volume') return `${value}kg`;
    return `${value}`;
  };


  return (
    <section className="stack wide">
      <div className="profile-header">
        <div>
          <p className="profile-name">Tu perfil</p>
          <p className="muted">
            Resumen de entrenamientos (últimos {settings.statsRangeDays ?? 30} días)
          </p>
        </div>
        <Link className="ghost-button" to="/settings">
          Ajustes
        </Link>
      </div>

      <div className="card">
        <h2>Resumen</h2>
        {summary.workouts === 0 && !loading ? (
          <p className="muted">Completa entrenamientos para ver tus estadísticas.</p>
        ) : (
          <div className="metric-grid">
            <div>
              <p className="metric-label">Entrenos</p>
              <p className="metric-value">{summary.workouts}</p>
            </div>
            <div>
              <p className="metric-label">Duración total</p>
              <p className="metric-value">{summary.minutes} min</p>
            </div>
            <div>
              <p className="metric-label">Volumen</p>
              <p className="metric-value">{summary.volume} kg</p>
            </div>
            <div>
              <p className="metric-label">Repeticiones</p>
              <p className="metric-value">{summary.reps}</p>
            </div>
            <div>
              <p className="metric-label">Sets</p>
              <p className="metric-value">{summary.sets}</p>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Actividad reciente</h2>
        {chartData.length ? (
          <div className="chart-wrapper">
            <div className="chart-axis">
              {yTicks.map((tick) => (
                <span key={tick} className="chart-axis-label">
                  {formatYAxisValue(tick)}
                </span>
              ))}
            </div>
            <div className="chart-scroll">
              <div className="chart">
                {chartData.map((day, index) => (
                  <div key={`${day.label}-${index}`} className="chart-column">
                    <button
                      className={`chart-bar ${activeBar === index ? 'active' : ''}`}
                      style={{ height: `${day.height}%` }}
                      type="button"
                      onClick={() => setActiveBar((prev) => (prev === index ? null : index))}
                    >
                      {activeBar === index ? (
                        <span className="chart-value">{formatYAxisValue(Math.round(day.raw))}</span>
                      ) : null}
                    </button>
                    <span className={`chart-label ${day.showLabel ? '' : 'hidden'}`}>
                      {day.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="muted">Aún no hay entrenamientos para graficar.</p>
        )}
        <div className="pill-row">
          <button
            className={`pill ${metric === 'duration' ? 'active' : ''}`}
            type="button"
            onClick={() => setMetric('duration')}
          >
            Duración
          </button>
          <button
            className={`pill ${metric === 'volume' ? 'active' : ''}`}
            type="button"
            onClick={() => setMetric('volume')}
          >
            Volumen
          </button>
          <button
            className={`pill ${metric === 'reps' ? 'active' : ''}`}
            type="button"
            onClick={() => setMetric('reps')}
          >
            Repeticiones
          </button>
        </div>
      </div>

      <div className="card">
        <h2>PRs (1RM estimado)</h2>
        {prs.length ? (
          <ul className="list">
            {prs.map((entry) => (
              <li key={entry.exerciseId} className="list-row">
                <div>
                  <p className="list-title">{entry.name}</p>
                  <p className="muted">
                    {entry.weight} kg x {entry.reps}
                  </p>
                </div>
                <div className="metric-value">{Math.round(entry.oneRm)} kg</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Aún no hay PRs calculados.</p>
        )}
      </div>

      <div className="card">
        <h2>Historial</h2>
        {recentWorkouts.length ? (
          <ul className="list">
            {recentWorkouts.map((workout) => (
              <li key={workout.id} className="list-row">
                <div>
                  <p className="list-title">{workout.name}</p>
                  <p className="muted">
                    {new Date(workout.endedAt).toLocaleDateString()} · {workout.setCount} sets
                  </p>
                </div>
                <div className="muted">{workout.durationMinutes} min</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Cuando completes entrenamientos, aparecerán aquí.</p>
        )}
      </div>
    </section>
  );
}
