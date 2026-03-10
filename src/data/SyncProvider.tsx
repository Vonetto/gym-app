import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { useAuth } from './AuthProvider';
import { getSyncState, updateSyncState } from './syncState';
import { markMigrationResolved, resolveInitialSyncMode, syncUserData } from './sync';

type SyncBannerStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline-pending';

interface MigrationPromptState {
  localCount: number;
  remoteHasData: boolean;
}

interface SyncContextValue {
  status: SyncBannerStatus;
  lastError?: string;
  lastSyncedAt?: string;
  onboardingOpen: boolean;
  accountDialogOpen: boolean;
  migrationPrompt: MigrationPromptState | null;
  isOnline: boolean;
  continueAsGuest: () => Promise<void>;
  openAccountDialog: () => void;
  closeAccountDialog: () => void;
  syncNow: (mode?: 'merge' | 'replace_local' | 'push_local') => Promise<boolean>;
  resolveMigration: (mode: 'merge' | 'replace_local') => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

function getInitialOnlineState() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { ready: authReady, status: authStatus, user } = useAuth();
  const [status, setStatus] = useState<SyncBannerStatus>('idle');
  const [lastError, setLastError] = useState<string | undefined>(undefined);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(undefined);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [migrationPrompt, setMigrationPrompt] = useState<MigrationPromptState | null>(null);
  const [isOnline, setIsOnline] = useState(getInitialOnlineState);
  const [preparedUserId, setPreparedUserId] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadBannerState = async () => {
      const stored = await getSyncState('sync-status');
      if (!active) return;
      setStatus((stored.status as SyncBannerStatus | undefined) ?? 'idle');
      setLastError(stored.lastError);
      setLastSyncedAt(stored.lastSyncedAt);
    };

    void loadBannerState();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadOnboarding = async () => {
      if (!authReady) return;
      if (authStatus === 'authenticated') {
        await updateSyncState('auth-onboarding', {
          value: 'dismissed',
          status: 'success'
        });
        setOnboardingOpen(false);
        return;
      }
      if (authStatus !== 'anonymous') {
        setOnboardingOpen(false);
        return;
      }

      const onboarding = await getSyncState('auth-onboarding');
      if (!active) return;
      setOnboardingOpen(onboarding.value !== 'dismissed');
    };

    void loadOnboarding();
    return () => {
      active = false;
    };
  }, [authReady, authStatus]);

  const syncNow = useCallback(
    async (mode: 'merge' | 'replace_local' | 'push_local' = 'merge') => {
      if (!user) return false;
      if (!isOnline) {
        setStatus('offline-pending');
        await updateSyncState('sync-status', {
          status: 'offline-pending',
          lastAttemptAt: new Date().toISOString()
        });
        return false;
      }

      setStatus('syncing');
      setLastError(undefined);
      try {
        const summary = await syncUserData(user.id, mode);
        const syncState = await getSyncState('sync-status');
        setStatus('success');
        setLastSyncedAt(syncState.lastSyncedAt);
        setLastError(undefined);
        if (summary.mode !== 'merge') {
          await markMigrationResolved(user.id);
        }
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'sync-error';
        setStatus(isOnline ? 'error' : 'offline-pending');
        setLastError(message);
        return false;
      }
    },
    [isOnline, user]
  );

  useEffect(() => {
    if (authStatus !== 'authenticated' || !user) {
      setPreparedUserId(null);
    }
  }, [authStatus, user]);

  useEffect(() => {
    let cancelled = false;

    const prepare = async () => {
      if (!authReady || authStatus !== 'authenticated' || !user) return;
      if (preparedUserId === user.id) return;

      const resolved = await resolveInitialSyncMode(user.id);
      if (cancelled) return;
      setPreparedUserId(user.id);

      if (resolved.kind === 'ready') {
        setMigrationPrompt(null);
        await syncNow('merge');
        return;
      }

      if (resolved.kind === 'auto') {
        setMigrationPrompt(null);
        await syncNow(resolved.mode);
        return;
      }

      setMigrationPrompt({
        localCount: resolved.localCount,
        remoteHasData: resolved.remoteHasData
      });
      setAccountDialogOpen(true);
    };

    void prepare();
    return () => {
      cancelled = true;
    };
  }, [authReady, authStatus, preparedUserId, syncNow, user]);

  useEffect(() => {
    if (authStatus === 'authenticated' && user && isOnline && status === 'offline-pending') {
      void syncNow('merge');
    }
  }, [authStatus, isOnline, status, syncNow, user]);

  const continueAsGuest = useCallback(async () => {
    await updateSyncState('auth-onboarding', {
      value: 'dismissed',
      status: 'success'
    });
    setOnboardingOpen(false);
    setAccountDialogOpen(false);
  }, []);

  const openAccountDialog = useCallback(() => {
    setAccountDialogOpen(true);
  }, []);

  const closeAccountDialog = useCallback(() => {
    if (migrationPrompt) return;
    setAccountDialogOpen(false);
  }, [migrationPrompt]);

  const resolveMigration = useCallback(
    async (mode: 'merge' | 'replace_local') => {
      if (!user) return;
      const promptSnapshot = migrationPrompt;
      setMigrationPrompt(null);
      const ok = await syncNow(mode);
      if (ok) {
        await markMigrationResolved(user.id);
        setAccountDialogOpen(false);
      } else {
        setMigrationPrompt(promptSnapshot);
      }
    },
    [migrationPrompt, syncNow, user]
  );

  const value = useMemo<SyncContextValue>(
    () => ({
      status,
      lastError,
      lastSyncedAt,
      onboardingOpen,
      accountDialogOpen,
      migrationPrompt,
      isOnline,
      continueAsGuest,
      openAccountDialog,
      closeAccountDialog,
      syncNow,
      resolveMigration
    }),
    [
      accountDialogOpen,
      continueAsGuest,
      closeAccountDialog,
      isOnline,
      lastError,
      lastSyncedAt,
      migrationPrompt,
      onboardingOpen,
      openAccountDialog,
      resolveMigration,
      status,
      syncNow
    ]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return context;
}
