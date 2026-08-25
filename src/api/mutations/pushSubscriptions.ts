/**
 * @fileoverview Push subscription mutation functions (Unit 5).
 *
 * Write operations for the message push-notification pipeline: upsert/delete a
 * device subscription row, and flip the per-user global push switch. Used by the
 * usePushSubscription hook.
 *
 * See: docs/plans/2026-08-18-001-feat-message-push-notifications-plan.md (Unit 5)
 */

import { supabase } from '@/supabaseClient';

export interface UpsertPushSubscriptionParams {
  memberId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}

/**
 * Insert or refresh this device's subscription. Keyed on `endpoint` (unique), so
 * re-subscribing the same device updates the existing row rather than duplicating.
 */
export async function upsertPushSubscription(
  params: UpsertPushSubscriptionParams
): Promise<void> {
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      member_id: params.memberId,
      endpoint: params.endpoint,
      p256dh: params.p256dh,
      auth: params.auth,
      user_agent: params.userAgent ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;
}

/** Remove a device subscription (on unsubscribe). */
export async function deletePushSubscriptionByEndpoint(
  endpoint: string
): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);
  if (error) throw error;
}

/** Flip the per-user global push switch (members.push_enabled). */
export async function setMemberPushEnabled(
  memberId: string,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from('members')
    .update({ push_enabled: enabled })
    .eq('id', memberId);
  if (error) throw error;
}
