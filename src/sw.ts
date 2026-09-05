/// <reference lib="webworker" />
/**
 * @fileoverview Custom service worker (Unit 4 of message push notifications).
 *
 * The app was on vite-plugin-pwa's auto-generated (`generateSW`) worker, which
 * can't run our own code. This is the hand-owned worker (`injectManifest`) that
 * keeps the same offline caching AND adds Web Push handling:
 *   - precache the app shell (manifest injected at build via `self.__WB_MANIFEST`)
 *   - port the previous runtime caching (Supabase NetworkFirst) verbatim
 *   - `push`            → show a message notification (suppress if already viewing)
 *   - `notificationclick` → focus/open the app at that conversation
 *
 *   - `message` (SKIP_WAITING) → apply an update; injectManifest does NOT add
 *     this for us the way generateSW did, and without it nothing can ever update
 *
 * Registration is unchanged — `src/components/PWAUpdatePrompt.tsx` still drives it
 * via `virtual:pwa-register/react`; we do NOT self-register here. Update posture
 * stays `prompt` (no auto `skipWaiting`).
 *
 * See: docs/plans/2026-08-18-001-feat-message-push-notifications-plan.md (Unit 4)
 */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import type { PrecacheEntry } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import {
  buildNotification,
  deepLinkPath,
  isViewingConversation,
} from '@/utils/push/notificationPayload';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | PrecacheEntry)[];
};

// --- Precache the app shell (list injected at build time) ---
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// --- Apply an update when the page asks for one ---
//
// THIS IS LOAD-BEARING. `updateServiceWorker(true)` (from the "Update Now"
// button) posts a SKIP_WAITING message to the waiting worker and then waits for
// `controllerchange` before reloading. If nothing here listens, the message is
// dropped, this worker sits in `waiting` forever, `controllerchange` never
// fires, and the app can NEVER update — the button appears dead on every
// device, permanently.
//
// vite-plugin-pwa injects this automatically under `generateSW`. It does NOT
// under `injectManifest`, which is what we switched to in order to write our own
// push handlers — so it has to live here by hand. It was missing between that
// switch and 2026-09-05, during which no client could take an update.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Take control of already-open pages as soon as we activate, so the reload the
// page performs is served by THIS worker (and therefore the new precache)
// rather than the outgoing one.
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// --- Runtime caching, ported 1:1 from the previous generateSW config ---
// Supabase API: NetworkFirst, same URL regex, 100 entries / 24h, cache 0+200.
// NOTE: the regex intentionally matches only https://*.supabase.co (production);
// local http://localhost:54321 is not cached, exactly as before.
registerRoute(
  /^https:\/\/.*\.supabase\.co\/.*/i,
  new NetworkFirst({
    cacheName: 'supabase-api-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// --- Push: show a message notification ---
self.addEventListener('push', (event) => {
  let raw: unknown;
  try {
    raw = event.data?.json();
  } catch {
    raw = undefined;
  }

  const { title, options } = buildNotification(raw);
  const conversationId = options.data.conversationId;

  event.waitUntil(
    (async () => {
      // Suppress-if-viewing (best-effort, Android/desktop): if a visible window
      // is already on this conversation, skip the buzz. iOS declarative push
      // can't be suppressed here — accepted.
      if (conversationId) {
        const windows = (await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        })) as readonly WindowClient[];
        const alreadyViewing = windows.some(
          (c) =>
            c.visibilityState === 'visible' &&
            isViewingConversation(c.url, conversationId)
        );
        if (alreadyViewing) return;
      }
      await self.registration.showNotification(title, options);
    })()
  );
});

// --- Tap-to-open: focus an existing window (navigating it) or open a new one ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data as { url?: string } | undefined;
  const url = data?.url || deepLinkPath(undefined);

  event.waitUntil(
    (async () => {
      const windows = (await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })) as readonly WindowClient[];
      for (const client of windows) {
        await client.focus();
        if (client.url !== url) {
          try {
            await client.navigate(url);
          } catch {
            // Navigation can be refused in some contexts — focusing is enough.
          }
        }
        return;
      }
      await self.clients.openWindow(url);
    })()
  );
});
