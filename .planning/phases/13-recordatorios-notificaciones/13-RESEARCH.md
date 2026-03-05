# Phase 13 Research — Recordatorios + Notificaciones

**Date:** 2026-03-04
**Status:** Researched

## Objective

Definir qué nivel de notificaciones es técnicamente defendible para esta PWA — especialmente en iPhone/Home Screen — y qué arquitectura necesita la app para soportar recordatorios robustos sin romper el enfoque local-first.

## Current State

### App actual

- La PWA ya tiene `service worker`, pero hoy solo se usa para caché/offline. No hay handlers de `push` ni `notificationclick`. Fuente local: `src/sw.ts`.
- El flujo de descanso ya usa `Notification` desde ventana en:
  - `src/pages/Workout.tsx`
  - `src/components/ActiveSessionBanner.tsx`
- `Calendar` y la agenda futura existen solo en Dexie local. No hay sync cloud de `plannedWorkoutSeries` ni `plannedWorkoutOccurrences`. Fuentes locales:
  - `src/data/db.ts`
  - `src/data/plans.ts`
  - `src/pages/Calendar.tsx`
- La app ya tiene Supabase Auth, Edge Functions y Cron disponibles en el stack. Fuentes locales:
  - `supabase/functions/`
  - `src/data/supabase.ts`

### Implicación inmediata

- Hoy podemos mostrar overlays y avisos locales dentro de la app.
- Hoy **no** podemos hacer recordatorios robustos de rutina planificada desde backend, porque el backend todavía no conoce la agenda futura.
- Hoy el código de notificaciones no está usando la ruta correcta para móvil, porque MDN recomienda `ServiceWorkerRegistration.showNotification()` en lugar de `new Notification()` en la mayoría de navegadores móviles. Fuente: MDN. https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API

## Research Findings

### 1) Web Push en iPhone sí existe, pero solo para PWA instalada y con permiso solicitado desde interacción directa

- WebKit documenta que desde iOS/iPadOS 16.4 hay soporte de Web Push para web apps añadidas al Home Screen.
- También documenta que el permiso debe pedirse en respuesta a una interacción directa del usuario.
- Las notificaciones llegan a Lock Screen y Notification Center, como una app normal.

Fuente:
- WebKit — Web Push for Web Apps on iOS and iPadOS  
  https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

**Conclusión**
- Para iPhone, el flujo de permisos debe diseñarse explícitamente para PWA instalada.
- `Ajustes` debe explicar esto claramente.

### 2) En móvil no debemos depender del constructor `Notification()`

- MDN indica que el constructor `Notification()` está bien en desktop, pero que en la mayoría de navegadores móviles lanzará `TypeError`.
- Recomienda registrar un service worker y usar `ServiceWorkerRegistration.showNotification()` en su lugar.

Fuentes:
- MDN — Using the Notifications API  
  https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API
- MDN — ServiceWorkerRegistration.showNotification()  
  https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification

**Conclusión**
- El código actual de descanso/background debe migrarse a `registration.showNotification(...)`.
- El service worker deja de ser solo caché y pasa a ser parte del sistema de notificaciones.

### 3) El navegador no ofrece un scheduler local robusto para alarmas exactas en background

- MDN documenta que:
  - `setTimeout()` se degrada en tabs inactivos
  - `setTimeout()` y timers similares se throttlean en background
  - `Periodic Background Sync` es experimental
- Eso significa que una PWA no puede basarse en timers locales para garantizar alarmas exactas cuando está en segundo plano o suspendida.

Fuentes:
- MDN — Page Visibility API  
  https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- MDN — Window.setTimeout()  
  https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout
- MDN — Web Periodic Background Synchronization API  
  https://developer.mozilla.org/en-US/docs/Web/API/Web_Periodic_Background_Synchronization_API

**Conclusión**
- Los recordatorios **robustos** de rutina planificada necesitan backend + push.
- Los avisos de descanso terminado y `¿Sigues entrenando?` pueden existir en foreground/in-app, pero su versión robusta en background no debe prometerse con puro cliente web.

### 4) Web Push estándar exige service worker activo, subscription y mensajes siempre visibles

- MDN documenta que para recibir push la app necesita un service worker activo.
- `PushManager.subscribe()` devuelve una `PushSubscription` con endpoint y claves.
- `userVisibleOnly: true` forma parte del contrato de Web Push.
- WebKit además documenta que no permite silent push; los pushes deben terminar en una notificación visible.

Fuentes:
- MDN — Push API  
  https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- MDN — PushManager.subscribe()  
  https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe
- WebKit — Meet Declarative Web Push  
  https://webkit.org/blog/16535/meet-declarative-web-push/

**Conclusión**
- La arquitectura correcta es:
  - PWA instala service worker
  - usuario concede permiso
  - cliente crea `PushSubscription`
  - backend persiste subscription
  - backend envía push visible usando VAPID

### 5) Supabase sí soporta la pieza servidor que necesitamos para recordatorios planificados

- Supabase documenta:
  - Edge Functions como capa serverless
  - Cron/`pg_cron` para jobs recurrentes
  - invocar Edge Functions periódicamente con HTTP mediante `pg_net`

Fuentes:
- Supabase — Edge Functions  
  https://supabase.com/docs/guides/functions
- Supabase — Scheduling Edge Functions  
  https://supabase.com/docs/guides/functions/schedule-functions
- Supabase — Cron  
  https://supabase.com/docs/guides/cron

**Conclusión**
- Para recordatorios de rutina planificada, la arquitectura defendible en este repo es:
  - guardar agenda futura en cloud
  - guardar preferencias y subscriptions push en cloud
  - ejecutar un job periódico (por ejemplo, cada minuto)
  - que una Edge Function resuelva “qué recordatorios vencen ahora” y envíe Web Push

### 6) La agenda futura local no basta para push robusta

Esto no viene de una fuente externa; es una inferencia directa del estado del repo.

- Hoy `plannedWorkoutSeries` y `plannedWorkoutOccurrences` viven solo en IndexedDB local.
- Un scheduler backend no puede recordar algo que no existe en el backend.

**Conclusión**
- Si Phase 13 quiere push robusta para rutinas planificadas, debe incluir sync cloud de agenda futura como prerequisito técnico.
- Eso significa extender la base de sync introducida en Phase 9.

### 7) El sonido de silbato solo es garantizable dentro de la app, no como sonido custom del sistema

Esto es una inferencia a partir de la API estándar:

- `showNotification()` expone opciones como `silent` y `vibrate`, pero no un campo para elegir audio personalizado.
- Por tanto, no hay una API estándar de Web Notifications para decir “usa este silbato” como sonido del sistema.

Fuente base:
- MDN — ServiceWorkerRegistration.showNotification()  
  https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification

**Conclusión**
- `silbato` sí: overlay foreground + audio reproducido por la app
- `silbato` como sonido nativo del sistema: no debe prometerse como capability web estándar

## Recommended Scope Split

### A) Sí cerrar en esta fase con robustez real

#### Recordatorios de rutina planificada

Implementar de forma robusta con:

- PWA instalada + permiso
- Push subscription vía service worker
- sync cloud de agenda futura
- preferencias cloud de recordatorio
- cron + edge function que envía Web Push

Esto sí es coherente con el stack actual.

### B) Sí cerrar en esta fase, pero como foreground / best-effort

#### Descanso terminado

- foreground:
  - overlay/modal
  - audio de silbato
  - `showNotification()` si aplica
- background:
  - best-effort local
  - no prometer exactitud robusta tipo app nativa

#### Sesión activa en background

- foreground:
  - banner persistente
- al salir de la app:
  - recordatorio tras umbral configurable usando `visibilitychange` + timer local
- no recomendar backend push robusta para esta parte en V1, porque exigiría sync casi en tiempo real de sesión activa y programación de jobs one-shot de baja latencia

## Recommended Data Model Additions

### Local settings

Agregar preferencias locales de notificaciones en `SettingsProvider`:

- `notificationsEnabled: boolean`
- `plannedWorkoutNotificationsEnabled: boolean`
- `restFinishedNotificationsEnabled: boolean`
- `backgroundSessionNotificationsEnabled: boolean`
- `plannedReminderTime: string` (`HH:mm`)
- `plannedReminderOffsetMinutes: number`
- `backgroundSessionReminderDelayMinutes: number`
- `notificationHelpDismissed?: boolean`

### Cloud tables recommended

#### `user_notification_preferences`

- `user_id`
- `notifications_enabled`
- `planned_enabled`
- `rest_enabled`
- `background_session_enabled`
- `planned_reminder_time`
- `planned_reminder_offset_minutes`
- `background_session_delay_minutes`
- `updated_at`

#### `user_push_subscriptions`

- `user_id`
- `id`
- `endpoint`
- `subscription_json`
- `user_agent?`
- `platform?`
- `created_at`
- `updated_at`
- `deleted_at`

#### Agenda sync prerequisite

Extender cloud sync a:

- `user_schedule_series`
- `user_schedule_occurrences`

Estas tablas ya habían sido recomendadas en Phase 12 research; ahora pasan de “nice-to-have futuro” a prerequisito para push robusta.

## Recommended Architecture

### Client

1. Registrar service worker.
2. Pedir permiso solo desde interacción directa del usuario.
3. Detectar soporte:
   - `Notification`
   - `serviceWorker`
   - `PushManager`
4. Si existe soporte:
   - suscribirse con `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
   - enviar `PushSubscription` al backend
5. Mantener foreground UX local para descanso y sesión activa.

### Service worker

Agregar en `src/sw.ts`:

- `push` handler
- `notificationclick` handler
- `showNotification(...)`

### Backend / Supabase

1. Sync de agenda futura y preferencias.
2. Persistencia de subscriptions.
3. Cron cada minuto.
4. Edge Function que:
   - calcula recordatorios vencidos según hora global y offset
   - evita duplicados
   - envía push visible

## Risks / Pitfalls

1. **Permisos sin gesto directo**
   - Deben pedirse desde un botón claro de usuario.  
   Fuente: MDN + WebKit.  
   https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API  
   https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

2. **PWA no instalada en iPhone**
   - Sin Home Screen app no hay el mismo camino de Web Push en iOS.  
   Fuente: WebKit.  
   https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

3. **Timers locales en background**
   - No son base fiable para recordatorios exactos.  
   Fuente: MDN.  
   https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API  
   https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout

4. **Silent push**
   - No es una base válida; el push debe terminar en notificación visible.  
   Fuente: WebKit + MDN.  
   https://webkit.org/blog/16535/meet-declarative-web-push/  
   https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe

5. **Declarative Web Push**
   - Existe como línea prometedora en WebKit, pero el propio post la presenta para iOS 18.4/iPadOS 18.4/macOS 15.5 beta; no es una base suficientemente estable para esta fase.  
   Fuente: WebKit.  
   https://webkit.org/blog/16535/meet-declarative-web-push/

## Recommendation

La forma correcta de ejecutar esta fase en este proyecto es:

1. **cerrar push robusta para rutinas planificadas**
   - incluyendo sync cloud de agenda, preferencias y subscriptions
2. **migrar notificaciones móviles al service worker**
   - abandonando `new Notification()` en foreground móvil
3. **mantener descanso terminado y sesión activa en background como client-first / best-effort**
   - con foreground fuerte
   - sin vender precisión nativa donde la web no la garantiza

Ese scope sí es coherente con:

- el stack actual (Supabase + Vercel + PWA)
- las capacidades reales del navegador
- y el nivel de robustez que vale la pena perseguir ahora
