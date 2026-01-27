import { useEffect, useState } from 'react';

export function useOffline() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handle = () => setOffline(!navigator.onLine);
    window.addEventListener('online', handle);
    window.addEventListener('offline', handle);
    return () => {
      window.removeEventListener('online', handle);
      window.removeEventListener('offline', handle);
    };
  }, []);

  return offline;
}
