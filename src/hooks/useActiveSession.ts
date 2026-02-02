import { useEffect, useState } from 'react';

type ActiveSession = {
  id: string;
  createdAt: string;
  routineName?: string;
  restTimers?: Record<string, { endAt: string; totalSeconds: number; exerciseName: string }>;
};

const readActiveSession = () => {
  const stored = localStorage.getItem('active-session');
  if (!stored) return null;
  try {
    return JSON.parse(stored) as ActiveSession;
  } catch {
    return null;
  }
};

export function useActiveSession() {
  const [session, setSession] = useState<ActiveSession | null>(() => readActiveSession());

  useEffect(() => {
    const handle = () => setSession(readActiveSession());
    window.addEventListener('storage', handle);
    window.addEventListener('active-session', handle as EventListener);
    return () => {
      window.removeEventListener('storage', handle);
      window.removeEventListener('active-session', handle as EventListener);
    };
  }, []);

  return session;
}
