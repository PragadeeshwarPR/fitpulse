/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { flushOutbox } from "./services/syncCore";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

// Automatic updates: activate new versions immediately.
self.skipWaiting();
clientsClaim();

// Offline application shell: precache the built assets and serve index.html for navigations.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html"), { denylist: [/^\/api\//, /^\/uploads\//] }));

// Fonts and meal photos.
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
  new StaleWhileRevalidate({ cacheName: "fonts" }),
);
registerRoute(
  ({ request, url }) => request.destination === "image" && (url.hostname.endsWith("cloudinary.com") || url.pathname.startsWith("/uploads/")),
  new CacheFirst({ cacheName: "meal-images", plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 86400 })] }),
);

// Background Sync: replay offline writes even if the app was closed.
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
self.addEventListener("sync", (event: Event) => {
  const e = event as ExtendableEvent & { tag: string };
  if (e.tag !== "fitpulse-outbox") return;
  e.waitUntil(
    flushOutbox(API_BASE).then(async (r) => {
      if (r.sent === 0) return;
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((c) => c.postMessage({ type: "fitpulse:synced", result: r }));
    }),
  );
});

// Web push notifications.
self.addEventListener("push", (event) => {
  const data = (() => {
    try {
      return event.data?.json() ?? {};
    } catch {
      return { title: "FitPulse", body: event.data?.text() };
    }
  })();
  event.waitUntil(
    self.registration.showNotification(data.title ?? "FitPulse", {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.startsWith(self.location.origin));
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
