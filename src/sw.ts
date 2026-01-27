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

setCatchHandler(async ({ event }) => {
  if (event.request.mode === 'navigate') {
    return navigationHandler({ event });
  }
  return Response.error();
});
