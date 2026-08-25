/**
 * @fileoverview Thin wrappers over the browser Push/Notification/ServiceWorker
 * APIs (Unit 5). Isolated here so the orchestration hook (usePushSubscription)
 * can be unit-tested by mocking this module — the raw browser calls themselves
 * are only exercised at runtime.
 *
 * See: docs/plans/2026-08-18-001-feat-message-push-notifications-plan.md (Unit 5)
 */

import { arrayBufferToBase64Url } from './pushCapability';

export interface SubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Prompt for notification permission (must be called from a user gesture). */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  return Notification.requestPermission();
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.ready;
}

/** The device's current push subscription, if any. */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  const reg = await readyRegistration();
  return reg.pushManager.getSubscription();
}

/** Subscribe this device to push using the app's VAPID public key. */
export async function subscribeToPush(
  applicationServerKey: Uint8Array
): Promise<PushSubscription> {
  const reg = await readyRegistration();
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey as BufferSource,
  });
}

/** Pull the endpoint + encryption keys out of a subscription, base64url-encoded. */
export function extractSubscriptionKeys(sub: PushSubscription): SubscriptionKeys {
  const p256dh = sub.getKey('p256dh');
  const auth = sub.getKey('auth');
  if (!p256dh || !auth) {
    throw new Error('Push subscription is missing its encryption keys');
  }
  return {
    endpoint: sub.endpoint,
    p256dh: arrayBufferToBase64Url(p256dh),
    auth: arrayBufferToBase64Url(auth),
  };
}
