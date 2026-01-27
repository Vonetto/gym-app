---
wave: 1
depends_on:
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - .planning/phases/01-pwa-ajustes-base/01-RESEARCH.md
files_modified:
  - .planning/phases/01-pwa-ajustes-base/PLAN.md
autonomous: true
---

<tasks>
  <task id="pwa-setup" title="Bootstrap PWA shell and offline support" owner="agent">
    <description>
      Initialize the React + Vite app shell, add vite-plugin-pwa with an injectManifest strategy, provide the manifest and icons, and register a service worker that precaches the shell and caches navigations/assets per the Phase 1 research guidance.
    </description>
    <acceptance_criteria>
      <item>App builds with PWA manifest and installable metadata present.</item>
      <item>Service worker precaches the shell and provides offline navigation fallback.</item>
    </acceptance_criteria>
  </task>
  <task id="offline-indicator" title="Add offline indicator in global header" owner="agent">
    <description>
      Implement a discrete offline banner that appears only when offline, using navigator.onLine with online/offline event listeners. Ensure it does not block the UI.
    </description>
    <acceptance_criteria>
      <item>Banner text reads “Sin conexión a internet”.</item>
      <item>Banner only renders while offline.</item>
    </acceptance_criteria>
  </task>
  <task id="settings-theme" title="Implement settings with dark/light theme toggle" owner="agent">
    <description>
      Add a settings screen with a theme toggle (dark default) that persists across sessions. Apply theme before React mounts to avoid flashes.
    </description>
    <acceptance_criteria>
      <item>Theme defaults to dark on first load.</item>
      <item>User choice persists after reload.</item>
    </acceptance_criteria>
  </task>
  <task id="reset-flow" title="Implement full reset flow" owner="agent">
    <description>
      Provide a double-confirm reset action that wipes IndexedDB, localStorage, and cache storage, then returns the user to Home with an empty state CTA to create a routine.
    </description>
    <acceptance_criteria>
      <item>Reset clears all local data and settings.</item>
      <item>User is warned to export before deletion.</item>
    </acceptance_criteria>
  </task>
  <task id="persistence" title="Add local-first storage baseline" owner="agent">
    <description>
      Set up IndexedDB (Dexie) for app settings and foundational data structures to ensure offline persistence.
    </description>
    <acceptance_criteria>
      <item>Settings are stored in IndexedDB.</item>
      <item>Local data remains available offline.</item>
    </acceptance_criteria>
  </task>
</tasks>

<verification>
  <criteria>
    <item>App loads with cached shell when offline.</item>
    <item>Offline indicator appears only while disconnected.</item>
    <item>Theme preference persists and defaults to dark.</item>
    <item>Reset removes all local data and returns to Home.</item>
  </criteria>
</verification>

<must_haves>
  <item>Offline-first PWA with installable manifest.</item>
  <item>Persistent settings including theme toggle.</item>
  <item>Non-blocking offline banner with specified copy.</item>
  <item>Full data reset with confirmation and warning.</item>
</must_haves>
