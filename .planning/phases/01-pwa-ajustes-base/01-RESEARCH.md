# Research — Phase 1: PWA + Ajustes Base (ecosystem)

## Standard Stack
- **Framework**: React 18 + TypeScript + Vite.
  - Rationale: fastest PWA dev loop, solid SW integration via plugins, mature ecosystem.
  - Confidence: **High**.
- **Routing**: React Router (data routers) for app shell routing and offline-friendly navigation.
  - Confidence: **Medium** (depends on final UI complexity).
- **PWA tooling**: `vite-plugin-pwa` (Workbox under the hood) for manifest + service worker build.
  - Use `injectManifest` for explicit control over caching rules and offline fallback.
  - Confidence: **High**.
- **Offline persistence**: IndexedDB via **Dexie** (or **idb** if you want thinner). Choose **Dexie** for schema migrations and querying ergonomics.
  - Confidence: **High**.
- **State management**: Zustand for UI state + settings, with `persist` to `localStorage` for tiny flags (theme, onboarding). Keep domain data in IndexedDB.
  - Confidence: **Medium**.
- **Styling**: Tailwind or CSS Modules; pick one and keep theme tokens centralized (dark default, light optional).
  - Confidence: **Medium**.

## Architecture Patterns
- **Offline-first app shell**:
  - Precache shell + critical routes in the service worker.
  - Use `NetworkFirst` for navigations (HTML) to keep updated shell while still working offline.
  - Use `StaleWhileRevalidate` for static assets (icons, fonts, CSS/JS) to keep fast reloads.
  - Confidence: **High**.
- **Local-first data layer**:
  - All write operations go to IndexedDB; UI reads from IndexedDB and caches in memory.
  - Keep a clean repository boundary (`/data/repositories/*`) so cloud sync can be added later without refactoring UI.
  - Confidence: **High**.
- **Settings as a single source of truth**:
  - `settings` store persisted in IndexedDB (for full reset support) and hydrated on app boot.
  - Theme toggles apply `data-theme` or `class` on `document.documentElement`.
  - Confidence: **High**.
- **Explicit reset flow**:
  - Centralized `resetAll()` that clears IndexedDB databases, localStorage keys, and any caches in the service worker.
  - Double confirmation UI is driven by settings screen.
  - Confidence: **High**.

## Don't Hand-Roll
- **Service worker caching**: Use Workbox (via `vite-plugin-pwa`) to avoid subtle SW bugs and broken updates.
- **IndexedDB wrappers**: Use Dexie (or `idb`) rather than raw IndexedDB APIs.
- **Manifest + icons**: Generate via `vite-plugin-pwa` or a dedicated manifest build step; do not manually craft icon resizing.
- **Theme preference**: Use `prefers-color-scheme` media query as the default baseline and persist the user override; don’t custom-detect in JS only.
- **Offline indicator logic**: Rely on `navigator.onLine` + `online/offline` events as baseline; don’t create a bespoke network stack unless real-time accuracy is required.

## Common Pitfalls
- **Overcaching data**: Caching JSON/API responses can make the app look stale offline. Cache only immutable assets; keep data in IndexedDB.
- **Service worker update flow**: Without `skipWaiting` + `clientsClaim`, users can stay stuck on old SW versions. Decide a clear update strategy early.
- **Wrong offline detection**: `navigator.onLine` is only a hint; treat it as a heuristic and keep offline banner conservative.
- **Theme flash**: If theme is applied after render, users see a flash. Apply theme class before React mounts.
- **Reset misses caches**: If reset doesn’t wipe Cache Storage, stale assets can survive. Add explicit cache clear in reset.

## Code Examples
> These are **patterns**, not final code. Adjust pathing to repo conventions.

### 1) Vite PWA setup (explicit SW control)
```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: {
        name: 'Gym Tracker',
        short_name: 'Gym',
        start_url: '/',
        display: 'standalone',
        background_color: '#0b0b0b',
        theme_color: '#0b0b0b',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
});
```

### 2) Service worker caching rules
```ts
// src/sw.ts
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

// @ts-ignore
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({ cacheName: 'pages' })
);

registerRoute(
  ({ request }) => ['style', 'script', 'image', 'font'].includes(request.destination),
  new StaleWhileRevalidate({ cacheName: 'assets' })
);
```

### 3) IndexedDB schema + reset
```ts
// src/data/db.ts
import Dexie, { Table } from 'dexie';

export interface SettingsRecord {
  id: 'app';
  theme: 'dark' | 'light';
  language: 'es';
  units: 'kg';
}

class AppDB extends Dexie {
  settings!: Table<SettingsRecord, 'app'>;

  constructor() {
    super('gym-tracker');
    this.version(1).stores({
      settings: 'id',
    });
  }
}

export const db = new AppDB();

export async function resetAll() {
  await db.delete();
  localStorage.clear();
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
}
```

### 4) Theme bootstrap before React mounts
```ts
// src/theme/bootstrap.ts
const saved = localStorage.getItem('theme');
const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const theme = saved ?? (systemPrefersDark ? 'dark' : 'light');

document.documentElement.dataset.theme = theme;
```

### 5) Offline banner hook
```ts
// src/hooks/useOffline.ts
import { useEffect, useState } from 'react';

export function useOffline() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onChange = () => setOffline(!navigator.onLine);
    window.addEventListener('online', onChange);
    window.addEventListener('offline', onChange);
    return () => {
      window.removeEventListener('online', onChange);
      window.removeEventListener('offline', onChange);
    };
  }, []);

  return offline;
}
```

---

## Notes on “What you don’t know you don’t know”
- **Installability nuances**: PWA installability rules vary per browser; rely on manual install (per decision) and avoid custom prompts.
- **iOS quirks**: iOS PWA storage is evicted aggressively in low storage; design export/backup early.
- **Offline cache eviction**: Cache Storage can be cleared by the browser; treat it as ephemeral, use IndexedDB for data.
- **Service worker lifecycle**: Updates can be delayed until all tabs close; decide whether to notify the user.

## Source Targets (verify as soon as network allows)
- Web App Manifest spec (W3C)
- Workbox docs (developer.chrome.com)
- Service Worker API (MDN)
- Cache Storage API (MDN)
- IndexedDB API (MDN)
- `navigator.onLine` behavior (MDN)
- `beforeinstallprompt` event (MDN)
- `prefers-color-scheme` (MDN)

