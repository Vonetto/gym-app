---
wave: 1
depends_on:
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - .planning/phases/04-timers-progresion/04-RESEARCH.md
files_modified:
  - .planning/phases/04-timers-progresion/04-PLAN.md
autonomous: true
---

<tasks>
  <task id="timers-persist" title="Persist rest timers with end timestamps" owner="agent">
    <description>
      Store rest timers as end timestamps inside the active session (localStorage), and derive remaining seconds from Date.now() so timers continue across navigation and app restarts.
    </description>
    <acceptance_criteria>
      <item>Rest timers survive leaving the workout screen and rehydrating the session.</item>
      <item>Remaining time is derived from stored endAt and never goes negative.</item>
    </acceptance_criteria>
  </task>
  <task id="active-session-banner" title="Global active session banner" owner="agent">
    <description>
      Show a professional banner at the top of the app when a session is active (outside /workout), with routine name, elapsed time, and a CTA to return to the workout.
    </description>
    <acceptance_criteria>
      <item>Banner appears on Home/Catalog/Profile when a session is active.</item>
      <item>Banner hides on /workout.</item>
      <item>Elapsed timer keeps ticking using timestamps.</item>
    </acceptance_criteria>
  </task>
  <task id="rest-complete-modal" title="Centered rest completion modal" owner="agent">
    <description>
      When a rest completes outside the workout screen, show a centered modal overlay with the exercises that are ready. Provide actions to close or return to the workout.
    </description>
    <acceptance_criteria>
      <item>Modal appears outside /workout when a rest ends.</item>
      <item>Modal lists multiple completed rests if they finish together.</item>
      <item>Modal has CTA to return to workout.</item>
    </acceptance_criteria>
  </task>
  <task id="notification-permission" title="Notification permission handling" owner="agent">
    <description>
      Keep permission requests tied to user gestures and show in‑app alerts when permissions are denied or unavailable.
    </description>
    <acceptance_criteria>
      <item>Permission requests only occur on user actions (e.g. starting rest).</item>
      <item>In-app modal still shows even if notification permission is denied.</item>
    </acceptance_criteria>
  </task>
  <task id="backend-roadmap" title="Backend path for iOS push + future accounts" owner="agent">
    <description>
      Document backend direction (Supabase vs self‑host) for Web Push + future auth/sync/social, based on research. Capture decision in planning notes.
    </description>
    <acceptance_criteria>
      <item>Decision recorded in notes with rationale.</item>
      <item>Future steps for Web Push are clear (SW + VAPID + server).</item>
    </acceptance_criteria>
  </task>
</tasks>

<verification>
  <criteria>
    <item>Rest timers persist across navigation and compute remaining seconds correctly.</item>
    <item>Active session banner appears outside workout and displays elapsed time.</item>
    <item>Rest completion modal appears centered outside workout with CTA to return.</item>
  </criteria>
</verification>

<must_haves>
  <item>Persistent rest timers using timestamps.</item>
  <item>Global banner for active session.</item>
  <item>Centered rest completion modal outside workout.</item>
</must_haves>
