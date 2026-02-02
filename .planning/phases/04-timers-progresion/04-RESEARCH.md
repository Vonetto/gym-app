# Phase 4 Research: Timers + Progresión (Ecosystem)

## Standard Stack

**Prescriptive stack for this phase (aligns with repo + ecosystem best practice):**

- **Service Worker + Push API + Notifications API** as the standard web‑push stack. Push requires an active service worker and push subscription; notifications are shown via `ServiceWorkerRegistration.showNotification()` in mobile contexts. Sources: MDN Push API + MDN `showNotification()` + MDN Notifications API. https://developer.mozilla.org/en-US/docs/Web/API/Push_API https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API
- **iOS PWA Web Push only for Home Screen web apps on iOS/iPadOS 16.4+**. Support is explicitly for Home Screen web apps; push uses Push API + Notifications API + Service Worker together. Source: WebKit blog (official). https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- **Supabase as the managed backend baseline** for future auth + DB + storage + realtime (if we choose managed). Supabase provides Postgres, Auth, Storage, Realtime, and Edge Functions in one platform. Source: Supabase Docs. https://supabase.com/docs

## Architecture Patterns

1. **Local timers should be timestamp‑based, not interval‑based.**
   - Store `endAt` timestamps for rest timers and derive remaining seconds from `Date.now()` so timers resume correctly across route changes or app restarts.
   - This prevents drift and allows background/foreground resumption.

2. **Notifications must be permission‑gated and user‑gesture initiated.**
   - Browsers increasingly require that notification permission requests happen via explicit user gestures. Source: MDN Notifications API. https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API

3. **Push notifications require a service worker and push subscription.**
   - Push delivery depends on an active service worker and a `PushSubscription` created via `PushManager.subscribe()`. Source: MDN Push API. https://developer.mozilla.org/en-US/docs/Web/API/Push_API

4. **iOS constraints: only Home Screen web apps can receive Web Push.**
   - For iOS/iPadOS 16.4+, Web Push is available only to Home Screen web apps (installed PWA). Source: WebKit blog. https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

## Don't Hand‑Roll

1. **Do not implement background notifications without Service Worker + Push API.**
   - On mobile, `new Notification()` is not reliable; use `ServiceWorkerRegistration.showNotification()` from a service worker. Source: MDN Notification constructor. https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification

2. **Do not request notification permissions automatically.**
   - Permission requests must be tied to user gesture to avoid browser blocks. Source: MDN Notifications API. https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API

## Common Pitfalls

1. **Assuming timers keep running in background.**
   - Mobile browsers aggressively pause timers; rely on timestamps and recompute on resume.

2. **Expecting iOS push without installation.**
   - iOS only allows Web Push to Home Screen web apps, not regular Safari tabs. Source: WebKit blog. https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

3. **Assuming `Notification()` works on mobile.**
   - Many mobile browsers throw `TypeError` for `new Notification()` and require `showNotification()` via service worker. Source: MDN Notification constructor. https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification

## Code Examples

```ts
// Timestamp-based rest timer
const endAt = new Date(Date.now() + restSeconds * 1000).toISOString();
// Persist endAt, derive remaining when rendering
const remaining = Math.max(0, Math.ceil((new Date(endAt).getTime() - Date.now()) / 1000));
```

```ts
// Service Worker push requirement (Push API)
// - Must have an active service worker
// - Use pushManager.subscribe() to get PushSubscription
```

Sources: MDN Push API + PushManager.subscribe. https://developer.mozilla.org/en-US/docs/Web/API/Push_API https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe

## Confidence Levels

- **High:** iOS Web Push requires Home Screen web app and uses Push API + Notifications API + SW (WebKit blog). https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- **High:** Push requires service worker and subscription; notifications require user gesture and secure context (MDN). https://developer.mozilla.org/en-US/docs/Web/API/Push_API https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API
- **Medium:** Supabase as managed baseline for future auth/DB/storage/realtime (Docs overview). https://supabase.com/docs
