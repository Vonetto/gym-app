import { useAuth } from '../data/AuthProvider';
import { useSync } from '../data/SyncProvider';

function formatSyncTime(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function SyncStatusBanner() {
  const auth = useAuth();
  const sync = useSync();

  if (!auth.isConfigured || auth.status !== 'authenticated') {
    return null;
  }

  const lastSynced = formatSyncTime(sync.lastSyncedAt);
  let message = '';

  if (sync.status === 'syncing') {
    message = 'Sincronizando cambios...';
  } else if (sync.status === 'offline-pending') {
    message = 'Sin internet. Los cambios se subirán al reconectar.';
  } else if (sync.status === 'error') {
    message = sync.lastError ? `Error de sync: ${sync.lastError}` : 'Error de sincronización.';
  } else if (lastSynced) {
    message = `Sincronizado ${lastSynced}`;
  } else {
    return null;
  }

  return (
    <div className={`sync-banner ${sync.status}`}>
      <span>{message}</span>
      {sync.status === 'error' ? (
        <button className="ghost-button" type="button" onClick={() => void sync.syncNow()}>
          Reintentar
        </button>
      ) : null}
    </div>
  );
}
