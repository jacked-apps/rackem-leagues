/**
 * @fileoverview Push capability detection + VAPID key conversion (Unit 5).
 *
 * `resolvePushCapability` is the pure decision (testable without browser
 * globals); `detectPushCapability` reads the real environment and delegates.
 * The base64url ↔ bytes helpers convert between the VAPID key wire format and
 * the `Uint8Array`/`ArrayBuffer` the Push API uses — the single most common
 * silent-failure point in Web Push, so they live here with tests.
 *
 * See: docs/plans/2026-08-18-001-feat-message-push-notifications-plan.md (Unit 5)
 */

export type PushCapability =
  | 'supported' // can subscribe (permission may still be default or granted)
  | 'denied' // the user has blocked notifications for this origin
  | 'needs-ios-install' // iOS Safari tab — must add to Home Screen first
  | 'unsupported'; // browser lacks service worker / Push / Notification

export interface PushEnv {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: NotificationPermission | null;
  isIOS: boolean;
  isStandalone: boolean;
}

/**
 * Decide push capability from explicit environment signals.
 *
 * Order matters: an iOS Safari tab reports no PushManager, so the
 * "add to Home Screen" nudge must be chosen BEFORE the generic unsupported
 * verdict — installing is the actionable fix, not "your browser can't".
 */
export function resolvePushCapability(env: PushEnv): PushCapability {
  if (env.isIOS && !env.isStandalone) return 'needs-ios-install';
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) {
    return 'unsupported';
  }
  if (env.permission === 'denied') return 'denied';
  return 'supported';
}

/** Read the real browser environment and resolve push capability. */
export function detectPushCapability(): PushCapability {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return 'unsupported';
  }
  const hasNotification = 'Notification' in window;
  const nav = navigator as Navigator & {
    standalone?: boolean;
    maxTouchPoints?: number;
  };
  const ua = nav.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as desktop Safari; disambiguate via touch points.
    (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    nav.standalone === true;

  return resolvePushCapability({
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification,
    permission: hasNotification ? Notification.permission : null,
    isIOS,
    isStandalone,
  });
}

/**
 * Convert a base64url VAPID public key to the `Uint8Array` that
 * `pushManager.subscribe({ applicationServerKey })` requires.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

/**
 * Convert a raw key `ArrayBuffer` (from `subscription.getKey(...)`) to the
 * base64url string stored server-side and used for encryption.
 */
export function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
