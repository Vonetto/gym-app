import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useActiveSession } from '../hooks/useActiveSession';
import { clearActiveSession, readActiveSession, writeActiveSession } from '../data/activeSession';
import { saveWorkout } from '../data/workouts';
import { useSettings } from '../data/SettingsProvider';
import { showAppNotification } from '../data/notifications';

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
};

export function ActiveSessionBanner() {
  const session = useActiveSession();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [now, setNow] = useState(() => Date.now());
  const [restAlert, setRestAlert] = useState<Array<{ exerciseName: string }> | null>(null);
  const dismissTimeoutRef = useRef<number | null>(null);
  const backgroundReminderTimeoutRef = useRef<number | null>(null);
  const backgroundReminderSessionRef = useRef<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);

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
    const expired = entries.filter(([, timer]) => {
      const mode = timer.mode ?? (timer.totalSeconds <= 0 ? 'stopwatch' : 'countdown');
      if (mode !== 'countdown' || !timer.endAt) return false;
      return new Date(timer.endAt).getTime() <= now;
    });
    if (!expired.length) return;

    const canAlert = settings.notificationsEnabled && settings.restFinishedNotificationsEnabled;

    if (canAlert) {
      expired.forEach(([, timer]) => {
        void showAppNotification({
          title: 'Descanso terminado',
          body: `Continúa con ${timer.exerciseName}.`,
          tag: `rest-${timer.exerciseName}`,
          url: '/workout'
        });
      });
    }

    const nextTimers = { ...session.restTimers };
    expired.forEach(([key]) => {
      delete nextTimers[key];
    });
    const updated = { ...session, restTimers: nextTimers };
    writeActiveSession(updated);
    if (canAlert) {
      setRestAlert(
        expired.map(([, timer]) => ({
          exerciseName: timer.exerciseName
        }))
      );
    }
    if (canAlert && 'vibrate' in navigator) {
      navigator.vibrate(200);
    }
    if (canAlert && dismissTimeoutRef.current) {
      window.clearTimeout(dismissTimeoutRef.current);
    }
    if (canAlert) {
      dismissTimeoutRef.current = window.setTimeout(() => {
        setRestAlert(null);
      }, 6000);
    }
  }, [isWorkoutRoute, now, session, settings.notificationsEnabled, settings.restFinishedNotificationsEnabled]);

  useEffect(() => {
    const clearBackgroundReminder = () => {
      if (backgroundReminderTimeoutRef.current) {
        window.clearTimeout(backgroundReminderTimeoutRef.current);
        backgroundReminderTimeoutRef.current = null;
      }
    };

    if (!session) {
      backgroundReminderSessionRef.current = null;
    }

    const canNotifyBackground =
      settings.notificationsEnabled &&
      settings.backgroundSessionNotificationsEnabled &&
      Boolean(session);

    const scheduleBackgroundReminder = () => {
      clearBackgroundReminder();
      if (!canNotifyBackground || !session || !document.hidden) return;

      const delayMinutes = Math.max(1, settings.backgroundSessionReminderDelayMinutes ?? 10);
      backgroundReminderTimeoutRef.current = window.setTimeout(() => {
        const active = readActiveSession();
        if (!active || active.id !== session.id || !document.hidden) return;
        if (backgroundReminderSessionRef.current === session.id) return;

        backgroundReminderSessionRef.current = session.id;
        void showAppNotification({
          title: '¿Sigues entrenando?',
          body: `${active.routineName ?? 'Tu sesión'} sigue abierta. Vuelve para terminarla.`,
          tag: `background-session-${session.id}`,
          url: '/workout',
          requireInteraction: true
        });
      }, delayMinutes * 60 * 1000);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        scheduleBackgroundReminder();
        return;
      }

      clearBackgroundReminder();
      backgroundReminderSessionRef.current = null;
    };

    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearBackgroundReminder();
    };
  }, [
    session,
    settings.notificationsEnabled,
    settings.backgroundSessionNotificationsEnabled,
    settings.backgroundSessionReminderDelayMinutes
  ]);

  const elapsed = useMemo(() => {
    if (!session) return 0;
    const createdAt = new Date(session.createdAt).getTime();
    return Math.max(0, Math.floor((now - createdAt) / 1000));
  }, [now, session]);

  if (!session || isWorkoutRoute) return null;

  const handleFinish = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      const parsed = readActiveSession();
      if (!parsed) return;
      const completedSets =
        parsed.exercises?.reduce(
          (total, exercise) =>
            total + exercise.sets.filter((set) => set.completed).length,
          0
        ) ?? 0;
      if (completedSets > 0) {
        await saveWorkout(parsed);
      }
    } catch {
      // ignore and fall through to clearing session
    } finally {
      clearActiveSession();
      setRestAlert(null);
      setIsFinishing(false);
    }
  };

  return (
    <>
      <div className="active-session-banner">
        <div>
          <p className="overline">Entreno en progreso</p>
          <p className="active-session-title">
            {session.routineName ?? 'Entreno'} · {formatDuration(elapsed)}
          </p>
        </div>
        <div className="active-session-actions">
          <button className="ghost-button" type="button" onClick={() => navigate('/workout')}>
            Volver
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={handleFinish}
            disabled={isFinishing}
          >
            Terminar
          </button>
        </div>
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
