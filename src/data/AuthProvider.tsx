import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'pending_confirmation' | 'unavailable';

interface AuthContextValue {
  ready: boolean;
  isConfigured: boolean;
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  pendingEmail?: string;
  signUp: (email: string, password: string) => Promise<'signed_in' | 'confirmation_required' | 'unavailable'>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | undefined>(undefined);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus('unavailable');
      setReady(true);
      return;
    }

    let active = true;

    const bootstrap = async () => {
      const {
        data: { session: currentSession }
      } = await supabase.auth.getSession();

      if (!active) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setStatus(currentSession ? 'authenticated' : 'anonymous');
      setReady(true);
    };

    void bootstrap();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setStatus(nextSession ? 'authenticated' : pendingEmail ? 'pending_confirmation' : 'anonymous');
      if (nextSession) {
        setPendingEmail(undefined);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [pendingEmail]);

  const refreshSession = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const {
      data: { session: currentSession }
    } = await supabase.auth.getSession();
    setSession(currentSession);
    setUser(currentSession?.user ?? null);
    setStatus(currentSession ? 'authenticated' : pendingEmail ? 'pending_confirmation' : 'anonymous');
  };

  const signUp = async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return 'unavailable' as const;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) throw error;

    if (data.session) {
      setPendingEmail(undefined);
      setSession(data.session);
      setUser(data.session.user);
      setStatus('authenticated');
      return 'signed_in' as const;
    }

    setPendingEmail(email);
    setStatus('pending_confirmation');
    return 'confirmation_required' as const;
  };

  const signIn = async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('supabase-unavailable');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    setPendingEmail(undefined);
    setSession(data.session);
    setUser(data.user);
    setStatus('authenticated');
  };

  const signOut = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setPendingEmail(undefined);
    setSession(null);
    setUser(null);
    setStatus('anonymous');
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      isConfigured: configured,
      status,
      session,
      user,
      pendingEmail,
      signUp,
      signIn,
      signOut,
      refreshSession
    }),
    [configured, pendingEmail, ready, session, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
