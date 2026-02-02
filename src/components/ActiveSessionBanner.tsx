import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useActiveSession } from '../hooks/useActiveSession';

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
};

export function ActiveSessionBanner() {
  const session = useActiveSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [now, setNow] = useState(() => Date.now());
  const [restAlert, setRestAlert] = useState<Array<{ exerciseName: string }> | null>(null);
  const dismissTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!session) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [session]);

  const isWorkoutRoute = location.pathname.startsWith('/workout');

  useEffect(() => {
    if (!session?.restTimers || isWorkoutRoute) return;
    const entries = Object.entries(session.restTimers);
    if (!entries.length) return;
    const expired = entries.filter(([, timer]) => new Date(timer.endAt).getTime() <= now);
    if (!expired.length) return;

    expired.forEach(([, timer]) => {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Descanso terminado', {
          body: `Continúa con ${timer.exerciseName}.`
        });
      }
    });

    const nextTimers = { ...session.restTimers };
    expired.forEach(([key]) => {
      delete nextTimers[key];
    });
    const updated = { ...session, restTimers: nextTimers };
    localStorage.setItem('active-session', JSON.stringify(updated));
    window.dispatchEvent(new Event('active-session'));
    setRestAlert(
      expired.map(([, timer]) => ({
        exerciseName: timer.exerciseName
      }))
    );
    if ('vibrate' in navigator) {
      navigator.vibrate(200);
    }
    if (dismissTimeoutRef.current) {
      window.clearTimeout(dismissTimeoutRef.current);
    }
    dismissTimeoutRef.current = window.setTimeout(() => {
      setRestAlert(null);
    }, 6000);
  }, [isWorkoutRoute, now, session]);
  const elapsed = useMemo(() => {
    if (!session) return 0;
    const createdAt = new Date(session.createdAt).getTime();
    return Math.max(0, Math.floor((now - createdAt) / 1000));
  }, [now, session]);

  if (!session || isWorkoutRoute) return null;

  return (
    <>
      <div className="active-session-banner">
        <div>
          <p className="overline">Entreno en progreso</p>
          <p className="active-session-title">
            {session.routineName ?? 'Entreno'} · {formatDuration(elapsed)}
          </p>
        </div>
        <button className="ghost-button" type="button" onClick={() => navigate('/workout')}>
          Volver
        </button>
      </div>
      {restAlert ? (
        <div className="modal-overlay center" onClick={() => setRestAlert(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h2>Descanso terminado</h2>
              <button className="ghost-button" type="button" onClick={() => setRestAlert(null)}>
                Cerrar
              </button>
            </div>
            <p className="muted">
              {restAlert.length === 1
                ? `Continúa con ${restAlert[0].exerciseName}.`
                : 'Varios descansos han terminado.'}
            </p>
            {restAlert.length > 1 ? (
              <ul className="list">
                {restAlert.map((item, index) => (
                  <li key={`${item.exerciseName}-${index}`} className="list-row">
                    <span className="list-title">{item.exerciseName}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="actions">
              <button className="ghost-button" type="button" onClick={() => setRestAlert(null)}>
                Seguir aquí
              </button>
              <button className="primary-button" type="button" onClick={() => navigate('/workout')}>
                Volver al entreno
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
