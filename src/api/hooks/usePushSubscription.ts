/**
 * @fileoverview usePushSubscription — orchestrates subscribing this device to
 * Web Push, unsubscribing, and healing a stale subscription on mount (Unit 5).
 *
 * Takes `memberId` + `pushEnabled` as inputs (rather than reading them via
 * react-query) so it stays cleanly testable. Browser calls are delegated to
 * `@/utils/push/browserPush` (mockable); capability detection + key conversion
 * live in `@/utils/push/pushCapability`.
 *
 * See: docs/plans/2026-08-18-001-feat-message-push-notifications-plan.md (Unit 5)
 */

import { useCallback, useEffect, useState } from 'react';
import {
  detectPushCapability,
  urlBase64ToUint8Array,
  type PushCapability,
} from '@/utils/push/pushCapability';
import {
  requestNotificationPermission,
  getExistingPushSubscription,
  subscribeToPush,
  extractSubscriptionKeys,
} from '@/utils/push/browserPush';
import {
  upsertPushSubscription,
  deletePushSubscriptionByEndpoint,
  setMemberPushEnabled,
} from '@/api/mutations/pushSubscriptions';

export interface UsePushSubscriptionResult {
  /** What this environment can do (drives the UI: toggle / iOS nudge / disabled). */
  capability: PushCapability;
  /** Whether this device currently has a live push subscription. */
  isSubscribed: boolean;
  /** A subscribe/unsubscribe call is in flight. */
  isBusy: boolean;
  /** Prompt + subscribe this device (call from a user gesture). */
  subscribe: () => Promise<void>;
  /** Unsubscribe this device and flip the global switch off. */
  unsubscribe: () => Promise<void>;
}

export function usePushSubscription(params: {
  memberId?: string | null;
  pushEnabled?: boolean | null;
}): UsePushSubscriptionResult {
  const { memberId, pushEnabled } = params;
  const [capability, setCapability] = useState<PushCapability>('unsupported');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // Detect what this environment supports, once on mount.
  useEffect(() => {
    setCapability(detectPushCapability());
  }, []);

  // Register this device: subscribe with the VAPID key, persist the row, flip
  // the global switch on. Returns false if prerequisites are missing.
  const registerDevice = useCallback(async (): Promise<boolean> => {
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!memberId || !vapidKey) return false;
    const sub = await subscribeToPush(urlBase64ToUint8Array(vapidKey));
    const keys = extractSubscriptionKeys(sub);
    await upsertPushSubscription({
      memberId,
      endpoint: keys.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
    await setMemberPushEnabled(memberId, true);
    return true;
  }, [memberId]);

  const subscribe = useCallback(async () => {
    if (capability !== 'supported' || !memberId) return;
    setIsBusy(true);
    try {
      const permission = await requestNotificationPermission();
      if (permission !== 'granted') {
        if (permission === 'denied') setCapability('denied');
        return;
      }
      if (await registerDevice()) setIsSubscribed(true);
    } finally {
      setIsBusy(false);
    }
  }, [capability, memberId, registerDevice]);

  const unsubscribe = useCallback(async () => {
    if (!memberId) return;
    setIsBusy(true);
    try {
      const sub = await getExistingPushSubscription();
      if (sub) {
        await deletePushSubscriptionByEndpoint(sub.endpoint);
        await sub.unsubscribe();
      }
      await setMemberPushEnabled(memberId, false);
      setIsSubscribed(false);
    } finally {
      setIsBusy(false);
    }
  }, [memberId]);

  // Heal-on-mount: sync isSubscribed with reality, and if the member wants push
  // (pushEnabled) but this device lost its subscription (rotation, cleared data),
  // silently re-subscribe. Best-effort — the settings toggle can always retry.
  useEffect(() => {
    if (capability !== 'supported' || !memberId) return;
    let cancelled = false;
    (async () => {
      const existing = await getExistingPushSubscription();
      if (cancelled) return;
      if (existing) {
        setIsSubscribed(true);
        return;
      }
      if (pushEnabled === true) {
        try {
          if ((await registerDevice()) && !cancelled) setIsSubscribed(true);
        } catch {
          // best-effort heal; leave isSubscribed false so the UI can offer retry
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [capability, memberId, pushEnabled, registerDevice]);

  return { capability, isSubscribed, isBusy, subscribe, unsubscribe };
}
