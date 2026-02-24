import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getExerciseById, getExerciseDisplayName } from '../data/exercises';
import { listExerciseHistory } from '../data/workouts';
import { useSettings } from '../data/SettingsProvider';
import { getWrkoutTips } from '../data/wrkout';

interface HistoryEntry {
  workoutId: string;
  routineName: string;
  startedAt: string;
  endedAt: string;
  notes?: string;
  sets: Array<{
    order: number;
    weight?: number;
    reps?: number;
    duration?: number;
    distance?: number;
    rpe?: number;
  }>;
}

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '-';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
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

export function ExerciseDetail() {
  const { exerciseId } = useParams();
  const { settings } = useSettings();
  const [exercise, setExercise] = useState<Awaited<ReturnType<typeof getExerciseById>> | null>(
    null
  );
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [tips, setTips] = useState<{ summary?: string; bullets?: string[] } | null>(null);
  const [tipsStatus, setTipsStatus] = useState<
    'idle' | 'loading' | 'ready' | 'missing' | 'auth' | 'error' | 'config'
  >('idle');

  useEffect(() => {
    if (!exerciseId) return;
    let active = true;
    const load = async () => {
      const exerciseRecord = await getExerciseById(exerciseId);
      if (!active) return;
      setExercise(exerciseRecord);
      const entries = await listExerciseHistory(exerciseId);
      if (!active) return;
      setHistory(entries);
    };
    void load();
    return () => {
      active = false;
    };
  }, [exerciseId]);

  useEffect(() => {
    if (!exerciseId || !exercise) return;
    let active = true;
    const loadTips = async () => {
      setTipsStatus('loading');
      const names = [
        exercise.baseName,
        getExerciseDisplayName(exercise, settings.language)
      ];
      const result = await getWrkoutTips(exerciseId, names, settings.wrkoutApiKey);
      if (!active) return;
      if (result.status === 'auth') {
        setTips(null);
        setTipsStatus('auth');
        return;
      }
      if (result.status === 'error') {
        setTips(null);
        setTipsStatus('error');
        return;
      }
      if (result.status === 'config') {
        setTips(null);
        setTipsStatus('config');
        return;
      }
      if (!result.record || result.status === 'missing') {
        setTips(null);
        setTipsStatus('missing');
        return;
      }
      setTips({ summary: result.record.summary, bullets: result.record.bullets });
      setTipsStatus('ready');
    };
    void loadTips();
    return () => {
      active = false;
    };
  }, [exercise, exerciseId, settings.wrkoutApiKey]);

  const displayName = useMemo(() => {
    if (!exercise) return 'Ejercicio';
    return getExerciseDisplayName(exercise, settings.language);
  }, [exercise, settings.language]);

  const metricType = exercise?.metricType ?? 'weight_reps';

  const bestMark = useMemo(() => {
    if (!history.length || metricType !== 'weight_reps') return null;
    let bestOneRm = 0;
    let bestWeight = 0;
    history.forEach((entry) => {
      entry.sets.forEach((set) => {
        if (set.weight !== undefined) {
          bestWeight = Math.max(bestWeight, set.weight);
        }
        if (set.weight !== undefined && set.reps !== undefined) {
          const oneRm = set.weight * (1 + set.reps / 30);
          bestOneRm = Math.max(bestOneRm, oneRm);
        }
      });
    });
    if (bestOneRm > 0) {
      return { label: '1RM estimado', value: `${Math.round(bestOneRm)} kg` };
    }
    if (bestWeight > 0) {
      return { label: 'Más pesado', value: `${bestWeight} kg` };
    }
    return null;
  }, [history, metricType]);

  const bestMetricMark = useMemo(() => {
    if (!history.length) return null;
    if (metricType === 'reps') {
      const bestReps = Math.max(
        0,
        ...history.flatMap((entry) => entry.sets.map((set) => set.reps ?? 0))
      );
      return bestReps ? { label: 'Mejor marca', value: `${bestReps} reps` } : null;
    }
    if (metricType === 'distance') {
      const bestDistance = Math.max(
        0,
        ...history.flatMap((entry) => entry.sets.map((set) => set.distance ?? 0))
      );
      return bestDistance ? { label: 'Mejor marca', value: `${bestDistance} m` } : null;
    }
    if (metricType === 'time') {
      const bestDuration = Math.max(
        0,
        ...history.flatMap((entry) => entry.sets.map((set) => set.duration ?? 0))
      );
      return bestDuration ? { label: 'Mejor marca', value: formatDuration(bestDuration) } : null;
    }
    return null;
  }, [history, metricType]);

  if (!exerciseId) {
    return (
      <section className="card">
        <h1>Ejercicio no encontrado</h1>
        <Link className="ghost-button" to="/catalog">
          Volver
        </Link>
      </section>
    );
  }

  return (
    <section className="stack wide">
      <div className="profile-header">
        <div>
          <p className="profile-name">{displayName}</p>
          <p className="muted">
            {(exercise?.muscles[0] ?? 'Sin músculo')} · {(exercise?.equipment[0] ?? 'Sin equipo')}
          </p>
        </div>
        <Link className="ghost-button" to="/catalog">
          Volver
        </Link>
      </div>

      <div className="card">
        <h2>{metricType === 'weight_reps' ? '1RM' : 'Mejor marca'}</h2>
        {metricType === 'weight_reps' ? (
          bestMark ? (
            <div className="metric-grid">
              <div>
                <p className="metric-label">{bestMark.label}</p>
                <p className="metric-value">{bestMark.value}</p>
              </div>
            </div>
          ) : (
            <p className="muted">Aún no hay datos suficientes.</p>
          )
        ) : bestMetricMark ? (
          <div className="metric-grid">
            <div>
              <p className="metric-label">{bestMetricMark.label}</p>
              <p className="metric-value">{bestMetricMark.value}</p>
            </div>
          </div>
        ) : (
          <p className="muted">Aún no hay datos suficientes.</p>
        )}
      </div>

      <div className="card">
        <h2>Tips</h2>
        {tipsStatus === 'loading' ? (
          <p className="muted">Cargando tips...</p>
        ) : tipsStatus === 'auth' ? (
          <p className="muted">La API key de wrkout no es válida.</p>
        ) : tipsStatus === 'config' ? (
          <p className="muted">Backend sin configurar: falta WRKOUT_API_KEY.</p>
        ) : tipsStatus === 'error' ? (
          <p className="muted">No se pudo conectar con wrkout.</p>
        ) : tipsStatus === 'missing' ? (
          <p className="muted">Sin tips disponibles.</p>
        ) : tips ? (
          <div className="tips-block">
            {tips.summary ? <p>{tips.summary}</p> : null}
            {tips.bullets && tips.bullets.length ? (
              <ul className="list">
                {tips.bullets.map((tip, index) => (
                  <li key={`${tip}-${index}`} className="list-row">
                    <span className="muted">{tip}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="muted">Fuente: wrkout.xyz</p>
          </div>
        ) : (
          <p className="muted">Sin tips disponibles.</p>
        )}
      </div>

      <div className="card">
        <h2>Historial</h2>
        {history.length ? (
          <div className="history-list">
            {history.map((entry) => (
              <div key={`${entry.workoutId}-${entry.endedAt}`} className="history-entry">
                <div className="history-header">
                  <div>
                    <p className="list-title">{entry.routineName}</p>
                    <p className="muted">
                      {entry.endedAt ? new Date(entry.endedAt).toLocaleString() : 'Sin fecha'}
                    </p>
                  </div>
                  <span className="tag-chip">{entry.sets.length} sets</span>
                </div>
                {entry.notes ? <p className="muted">{entry.notes}</p> : null}
                <div className="history-sets">
                  {entry.sets.map((set, index) => (
                    <div key={`${entry.workoutId}-${index}`} className="history-set">
                      <span>Set {index + 1}</span>
                      <span>{formatSetValue(metricType, set)}</span>
                      <span>{set.rpe ? `RPE ${set.rpe}` : 'RPE -'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Aún no hay entrenamientos registrados para este ejercicio.</p>
        )}
      </div>
    </section>
  );
}
