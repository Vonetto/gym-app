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
