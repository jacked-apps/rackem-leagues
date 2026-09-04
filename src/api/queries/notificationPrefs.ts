/**
 * @fileoverview Reads for the notification-control settings.
 *
 * Two things a member can tune, both global to them:
 *   - quiet hours (a window during which nothing notifies, at all)
 *   - a default per conversation kind (on/off, plus a quiet interval for group
 *     kinds)
 *
 * Remember the rule these feed: every level is a VETO. Nothing read here can
 * make a member louder than their master switch or their quiet hours allow —
 * it can only add more silence. See
 * docs/plans/2026-09-04-001-feat-notification-controls-plan.md
 */

import { supabase } from '@/supabaseClient';

/** A member's default for one conversation kind. */
export interface NotificationKindPref {
  conversationKind: string;
  /** false = this member vetoes the whole kind. */
  pushEnabled: boolean;
  /** Minutes of quiet after a notification. NULL = no rate limiting. */
  intervalMinutes: number | null;
}

/** A member's global notification settings. */
export interface QuietHours {
  /** Local wall-clock 'HH:MM:SS', or null when quiet hours are off. */
  start: string | null;
  end: string | null;
  /** IANA zone the times are read in; null disables quiet hours. */
  timezone: string | null;
}

/**
 * Conversation kinds that can push at all, from the system phase switch.
 *
 * Not a user setting — this is the operator-level decision about which channels
 * are live. Settings only offers defaults for kinds that appear here, because a
 * control for a channel that can't send is a lie.
 *
 * @returns The kinds with `push_enabled = true`
 */
export async function getPushableKinds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('push_type_policy')
    .select('conversation_kind')
    .eq('push_enabled', true);

  if (error) {
    throw new Error(`Failed to fetch pushable conversation kinds: ${error.message}`);
  }
  return (data ?? []).map((r) => r.conversation_kind as string);
}

/**
 * A member's per-kind defaults.
 *
 * A kind with no row means "no restriction from this level" — the same as
 * everywhere else in the veto chain — so a member who has never opened Settings
 * behaves exactly as before this feature existed.
 *
 * @param memberId - Whose preferences to read
 * @returns One entry per kind the member has actually set
 */
export async function getNotificationKindPrefs(
  memberId: string
): Promise<NotificationKindPref[]> {
  const { data, error } = await supabase
    .from('member_notification_prefs')
    .select('conversation_kind, push_enabled, interval_minutes')
    .eq('member_id', memberId);

  if (error) {
    throw new Error(`Failed to fetch notification preferences: ${error.message}`);
  }

  return (data ?? []).map((r) => ({
    conversationKind: r.conversation_kind as string,
    pushEnabled: r.push_enabled as boolean,
    intervalMinutes: r.interval_minutes as number | null,
  }));
}

/**
 * A member's quiet-hours window.
 *
 * @param memberId - Whose window to read
 * @returns The window, with nulls when it has never been configured
 */
export async function getQuietHours(memberId: string): Promise<QuietHours> {
  const { data, error } = await supabase
    .from('members')
    .select('quiet_hours_start, quiet_hours_end, timezone')
    .eq('id', memberId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch quiet hours: ${error.message}`);
  }

  return {
    start: (data?.quiet_hours_start as string | null) ?? null,
    end: (data?.quiet_hours_end as string | null) ?? null,
    timezone: (data?.timezone as string | null) ?? null,
  };
}
