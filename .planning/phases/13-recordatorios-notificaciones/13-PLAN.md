---
wave: 1
depends_on:
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - .planning/phases/13-recordatorios-notificaciones/13-CONTEXT.md
  - .planning/phases/13-recordatorios-notificaciones/13-RESEARCH.md
  - .planning/phases/12-calendario-planificacion/12-SUMMARY.md
  - .planning/phases/09-auth-sync-base/09-SUMMARY.md
files_modified:
  - .planning/phases/13-recordatorios-notificaciones/13-PLAN.md
autonomous: true
---

<tasks>
  <task id="notification-settings-and-capability-model" title="Add notification settings, capability detection, and user-facing status in Ajustes" owner="agent">
    <description>
      Extend the settings model to include notification preferences and capability state. Add global and per-type toggles, planned reminder time, reminder offset, and background-session delay. The UI must surface support/permission/install status clearly and include concise help for enabling notifications on iPhone/PWA.
    </description>
    <acceptance_criteria>
      <item>`Ajustes` exposes a global notifications toggle plus toggles for planned reminders, rest-finished, and background-session reminders.</item>
      <item>The user can configure a global reminder time, an offset, and the inactivity delay for `¿Sigues entrenando?`.</item>
      <item>The app detects support for `Notification`, `serviceWorker`, and `PushManager` and renders a clear state.</item>
      <item>The screen includes short help text for installed PWA / iPhone notification enablement.</item>
    </acceptance_criteria>
  </task>

  <task id="service-worker-notification-foundation" title="Extend the service worker and client notification bridge" owner="agent">
    <description>
      Move notification delivery to the service-worker path recommended for mobile. Extend `src/sw.ts` with `push` and `notificationclick` handlers, add a client-side notification helper that uses `ServiceWorkerRegistration.showNotification()`, and stop relying on `new Notification()` as the primary delivery path.
    </description>
    <acceptance_criteria>
      <item>`src/sw.ts` handles `push` and `notificationclick` events without breaking offline caching.</item>
      <item>The client can request permission from a direct user action and can obtain the active service-worker registration.</item>
      <item>Foreground and mobile-notification calls route through `showNotification()` when available.</item>
      <item>Existing rest-finished flows no longer depend on desktop-only notification assumptions.</item>
    </acceptance_criteria>
  </task>

  <task id="foreground-rest-and-background-session-ux" title="Harden local UX for rest-finished and background-session reminders" owner="agent">
    <description>
      Keep rest-finished and active-session reminders primarily client-first. Add the whistle sound and centered overlay for completed rest, plus visibility/background tracking for `¿Sigues entrenando?` using the configured inactivity threshold. Treat this path as foreground/best-effort rather than guaranteed native scheduling.
    </description>
    <acceptance_criteria>
      <item>When rest ends in-app, the user sees a centered overlay and hears the whistle sound.</item>
      <item>When the app is backgrounded with an active session, a reminder can trigger after the configured delay.</item>
      <item>The reminder is gated by user preference toggles.</item>
      <item>The implementation does not promise exact native timing when the browser throttles background timers.</item>
    </acceptance_criteria>
  </task>

  <task id="sync-schedule-and-preferences-to-cloud" title="Extend Supabase sync to schedule entities and notification preferences" owner="agent">
    <description>
      Push robust planned-workout reminders need the agenda in cloud. Extend the Phase 9 sync model to include planned workout series, planned workout occurrences, and notification preferences. Keep the same local-first metadata conventions (`id`, `updatedAt`, `deletedAt`, LWW/tombstones).
    </description>
    <acceptance_criteria>
      <item>Cloud sync includes `plannedWorkoutSeries` and `plannedWorkoutOccurrences` without redesigning the local schema.</item>
      <item>Notification preferences are persisted for the signed-in user.</item>
      <item>The sync engine handles these new aggregates with the same LWW/tombstone semantics as existing entities.</item>
      <item>The app remains usable in guest/local-only mode without cloud notifications.</item>
    </acceptance_criteria>
  </task>

  <task id="supabase-schema-subscriptions-and-rls" title="Add Supabase schema for notification preferences and push subscriptions" owner="agent">
    <description>
      Create SQL migrations and RLS policies for cloud-side notification state. This includes a user-owned preferences table, a user-owned push-subscriptions table, and any schedule-cloud tables still missing for planned reminders. Use the same standards already established in Phase 9.
    </description>
    <acceptance_criteria>
      <item>There are migrations for notification preferences and push subscriptions under `supabase/migrations/`.</item>
      <item>All new tables are protected with RLS using `auth.uid()`-based ownership.</item>
      <item>The schema supports soft deletion or re-registration of subscriptions without leaking old rows.</item>
      <item>The client can upsert preferences and subscriptions for the current user.</item>
    </acceptance_criteria>
  </task>

  <task id="push-subscription-client-flow" title="Implement permission and push-subscription flow in the client" owner="agent">
    <description>
      Add the client flow to request notification permission from explicit user interaction, create a push subscription using the VAPID public key, and persist that subscription in cloud. The UI must explain unsupported states clearly and avoid prompting automatically on page load.
    </description>
    <acceptance_criteria>
      <item>The app requests permission only from an explicit user action in `Ajustes` or equivalent CTA.</item>
      <item>The app can subscribe/unsubscribe a device via `PushManager`.</item>
      <item>The resulting subscription is stored for the logged-in user.</item>
      <item>The UI reflects installed/unsupported/denied/granted states without ambiguity.</item>
    </acceptance_criteria>
  </task>

  <task id="scheduler-and-push-delivery-backend" title="Implement scheduled reminder delivery in Supabase" owner="agent">
    <description>
      Add the backend path for robust planned-workout reminders. Use a scheduled Supabase job that invokes an Edge Function, resolves which reminders are due based on stored preferences and agenda data, deduplicates them, and sends visible Web Push notifications through the user's saved subscriptions.
    </description>
    <acceptance_criteria>
      <item>An Edge Function exists to resolve and send planned-workout reminders.</item>
      <item>A scheduled job invokes that function periodically.</item>
      <item>The logic respects the configured global reminder time and offset.</item>
      <item>The sender avoids duplicate pushes for the same occurrence/reminder window.</item>
    </acceptance_criteria>
  </task>

  <task id="verification-and-platform-guardrails" title="Verify notification flows and document platform limits" owner="agent">
    <description>
      Validate the end-to-end experience for the supported paths and document the limits honestly. This includes permission flow, subscription creation, local rest reminders, active-session background reminders, and robust planned-workout push when the app is installed and the backend is configured.
    </description>
    <acceptance_criteria>
      <item>`npm run build` passes.</item>
      <item>The user can see correct status in `Ajustes` for unsupported / denied / granted / installed states.</item>
      <item>Rest-finished and active-session reminders work in-app and degrade gracefully when the platform limits background timing.</item>
      <item>Planned-workout reminders can be sent through the cloud path for a configured user/subscription.</item>
      <item>Docs/config clearly distinguish robust planned-workout push from best-effort local background reminders.</item>
    </acceptance_criteria>
  </task>
</tasks>

<verification>
  <criteria>
    <item>El usuario puede configurar notificaciones desde `Ajustes` con estado de soporte/permisos claro.</item>
    <item>La app usa `service worker` como base de notificaciones y no depende del constructor `Notification()` para móvil.</item>
    <item>Las rutinas planificadas tienen una ruta robusta de recordatorio mediante push, siempre que haya cuenta, permiso y suscripción válidos.</item>
    <item>`Descanso terminado` y `¿Sigues entrenando?` funcionan con buena UX foreground y se degradan honestamente cuando el navegador limita el background.</item>
    <item>La solución mantiene el modo local-first y no rompe el uso sin cuenta.</item>
  </criteria>
</verification>

<must_haves>
  <item>Permisos pedidos solo desde interacción directa del usuario.</item>
  <item>Preferencias de notificación con toggle global + toggles por tipo.</item>
  <item>Sincronización cloud de agenda futura como prerequisito de push robusta.</item>
  <item>Persistencia de `PushSubscription` y backend scheduler para rutinas planificadas.</item>
  <item>Separación explícita entre `push robusta` y `best-effort local` en el diseño y la UX.</item>
</must_haves>
