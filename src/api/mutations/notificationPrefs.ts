/**
 * @fileoverview Writes for the notification-control settings.
 *
 * These only ever write the member's OWN levels — the per-kind defaults and the
 * quiet-hours window. They must never touch `push_type_policy`, which is the
 * system-level decision about whether a channel is live at all and sits above
 * every member preference.
 *
 * @see docs/plans/2026-09-04-001-feat-notification-controls-plan.md
 */

import { supabase } from '@/supabaseClient';

/** Parameters for {@link setNotificationKindPref}. */
export interface SetKindPrefParams {
  memberId: string;
  conversationKind: string;
  pushEnabled: boolean;
  /**
   * Minutes of quiet after a notification, or null for none.
   *
   * Null for `direct`: a DM is one person talking to you, and holding those
   * back reads as the app swallowing messages rather than as restraint.
   */
  intervalMinutes: number | null;
}

/**
 * Set a member's default for one conversation kind.
 *
 * Upsert rather than update — a member has no rows until they change something,
 * since "no row" is how the veto chain expresses "no restriction here".
 *
 * @param params - See {@link SetKindPrefParams}
 */
export async function setNotificationKindPref({
  memberId,
  conversationKind,
  pushEnabled,
  intervalMinutes,
}: SetKindPrefParams): Promise<void> {
  const { error } = await supabase.from('member_notification_prefs').upsert(
    {
      member_id: memberId,
      conversation_kind: conversationKind,
      push_enabled: pushEnabled,
      interval_minutes: intervalMinutes,
    },
    { onConflict: 'member_id,conversation_kind' }
  );

  if (error) {
    throw new Error(`Failed to save notification preference: ${error.message}`);
  }
}

/** Parameters for {@link setQuietHours}. */
export interface SetQuietHoursParams {
  memberId: string;
  /** 'HH:MM' local wall-clock, or null on both to switch quiet hours off. */
  start: string | null;
  end: string | null;
  /**
   * IANA zone the times are read in.
   *
   * Captured from the browser rather than asked for — "22:00" is meaningless
   * without knowing whose clock, and the resolver treats a null zone as "never
   * quiet" rather than guessing one.
   */
  timezone: string | null;
}

/**
 * Set (or clear) a member's quiet-hours window.
 *
 * @param params - See {@link SetQuietHoursParams}
 */
export async function setQuietHours({
  memberId,
  start,
  end,
  timezone,
}: SetQuietHoursParams): Promise<void> {
  const { error } = await supabase
    .from('members')
    .update({
      quiet_hours_start: start,
      quiet_hours_end: end,
      timezone,
    })
    .eq('id', memberId);

  if (error) {
    throw new Error(`Failed to save quiet hours: ${error.message}`);
  }
}

/**
 * The browser's IANA timezone, or null if it can't be determined.
 *
 * Stored alongside the window so the server knows whose clock "22:00" is on.
 *
 * @returns e.g. 'America/New_York', or null
 */
export function detectTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
