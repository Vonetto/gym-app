/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

const navigationHandler = createHandlerBoundToURL('/index.html');

registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages',
    networkTimeoutSeconds: 3
  })
);

registerRoute(
  ({ request }) => ['style', 'script', 'image', 'font'].includes(request.destination),
  new StaleWhileRevalidate({ cacheName: 'assets' })
);

function isFetchEvent(event: ExtendableEvent): event is FetchEvent {
  return 'request' in event;
}

setCatchHandler(async ({ event }) => {
  if (isFetchEvent(event) && event.request.mode === 'navigate') {
    return navigationHandler({
      event,
      request: event.request,
      url: new URL(event.request.url)
    });
  }
  return Response.error();
});

self.addEventListener('push', (event) => {
  const fallback = {
    title: 'Gym App',
    body: 'Tienes un recordatorio.',
    data: { url: '/' as string }
  };

  let payload = fallback;
  try {
    const data = event.data?.json() as
      | {
          title?: string;
          body?: string;
          tag?: string;
          url?: string;
          requireInteraction?: boolean;
          renotify?: boolean;
        }
      | undefined;
    if (data) {
      payload = {
        title: data.title ?? fallback.title,
        body: data.body ?? fallback.body,
        data: { url: data.url ?? fallback.data.url },
      };
      event.waitUntil(
        self.registration.showNotification(payload.title, {
          body: payload.body,
          tag: data.tag,
          requireInteraction: data.requireInteraction,
          data: payload.data
        })
      );
      return;
    }
  } catch {
    // Fallback to text/default payload.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: payload.data
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data?.url as string | undefined) ?? '/', self.location.origin)
    .toString();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const sameOriginClient = clients.find((client) => client.url.startsWith(self.location.origin));
      if (sameOriginClient && 'focus' in sameOriginClient) {
        if ('navigate' in sameOriginClient) {
          await sameOriginClient.navigate(url);
        }
        return sameOriginClient.focus();
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
      return undefined;
    })
  );
});
