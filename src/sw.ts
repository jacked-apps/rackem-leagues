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
