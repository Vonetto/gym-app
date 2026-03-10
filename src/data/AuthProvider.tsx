import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { clearActiveSession } from './activeSession';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { ensureSocialProfile } from './social';

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
  const pendingEmailRef = useRef<string | undefined>(undefined);
  const lastUserIdRef = useRef<string | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    pendingEmailRef.current = pendingEmail;
  }, [pendingEmail]);

  const applySessionState = (nextSession: Session | null) => {
    const nextUser = nextSession?.user ?? null;
    const nextUserId = nextUser?.id ?? null;

    if (lastUserIdRef.current && nextUserId && lastUserIdRef.current !== nextUserId) {
      clearActiveSession();
    }

    setSession(nextSession);
    setUser(nextUser);
    setStatus(nextSession ? 'authenticated' : pendingEmailRef.current ? 'pending_confirmation' : 'anonymous');

    if (nextSession) {
      pendingEmailRef.current = undefined;
      setPendingEmail(undefined);
    }

    lastUserIdRef.current = nextUserId;
  };

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

      applySessionState(currentSession);
      setReady(true);
    };

    void bootstrap();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      applySessionState(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || !user) {
      return;
    }

    let active = true;

    const bootstrapSocialProfile = async () => {
      try {
        await ensureSocialProfile(user);
      } catch (error) {
        if (active) {
          console.error('social-profile-bootstrap-failed', error);
        }
      }
    };

    void bootstrapSocialProfile();

    return () => {
      active = false;
    };
  }, [status, user]);

  const refreshSession = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const {
      data: { session: currentSession }
    } = await supabase.auth.getSession();
    applySessionState(currentSession);
  };

  const signUp = async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return 'unavailable' as const;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          typeof window === 'undefined' ? undefined : `${window.location.origin}/`
      }
    });

    if (error) throw error;

    if (data.session) {
      pendingEmailRef.current = undefined;
      setPendingEmail(undefined);
      clearActiveSession();
      applySessionState(data.session);
      return 'signed_in' as const;
    }

    pendingEmailRef.current = email;
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

    pendingEmailRef.current = undefined;
    setPendingEmail(undefined);
    clearActiveSession();
    applySessionState(data.session);
  };

  const signOut = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    clearActiveSession();
    pendingEmailRef.current = undefined;
    setPendingEmail(undefined);
    applySessionState(null);
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
