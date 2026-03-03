import { useEffect, useState } from 'react';
import { ActiveWorkoutSession, readActiveSession } from '../data/activeSession';

export function useActiveSession() {
  const [session, setSession] = useState<ActiveWorkoutSession | null>(() => readActiveSession());

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
