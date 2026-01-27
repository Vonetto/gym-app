import { useOffline } from '../hooks/useOffline';

export function OfflineBanner() {
  const offline = useOffline();

  if (!offline) {
    return null;
  }

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      Sin conexión a internet
    </div>
  );
}
