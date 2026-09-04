/**
 * @fileoverview Works out whether a higher level is already overruling this
 * chat, and says which one.
 *
 * The veto chain means a per-chat setting can only ADD silence. So turning a
 * chat's notifications on while the master switch is off, or while that whole
 * conversation kind is muted, changes nothing — and a control that silently
 * does nothing is the single most likely way this feature reads as broken.
 *
 * Pure, so the message can be asserted without rendering anything.
 *
 * @see docs/plans/2026-09-04-001-feat-notification-controls-plan.md
 */

/** What a higher level is imposing on this conversation. */
export interface ChatOverride {
  /** True when a level above the chat is already blocking notifications. */
  isOverruled: boolean;
  /**
   * What to tell the member — names the level responsible and where to change
   * it. Null when nothing above is interfering.
   */
  message: string | null;
  /**
   * The kind default's interval, if any. The chat can lengthen this but never
   * shorten it, so the UI has a floor to show and to enforce.
   */
  kindIntervalMinutes: number | null;
}

/** Inputs describing every level above this conversation. */
export interface ChatOverrideInput {
  /** The member's master switch (`members.push_enabled`). */
  masterEnabled: boolean;
  /** Whether the member has a quiet-hours window configured at all. */
  quietHoursConfigured: boolean;
  /** Whether this conversation's KIND can push at all (push_type_policy). */
  kindIsLive: boolean;
  /** The member's default for this kind. */
  kindEnabled: boolean;
  /** The kind default's quiet interval. */
  kindIntervalMinutes: number | null;
  /** Human label for the kind, e.g. "Team chats". */
  kindLabel: string;
}

/**
 * Decide whether a higher level overrules this chat, and what to say about it.
 *
 * Order matters: report the OUTERMOST cause, since that's the one the member
 * has to change first. Telling someone their team-chat default is off, when
 * their master switch is also off, sends them to fix the wrong thing.
 *
 * Quiet hours are deliberately NOT treated as an override. They're temporary
 * and expected — saying "you won't get this" during a window that ends at 7am
 * would be wrong the rest of the day.
 *
 * @param input - See {@link ChatOverrideInput}
 * @returns Whether the chat is overruled, and the message to show
 */
export function resolveChatOverride(input: ChatOverrideInput): ChatOverride {
  const base = { kindIntervalMinutes: input.kindIntervalMinutes };

  if (!input.kindIsLive) {
    return {
      ...base,
      isOverruled: true,
      message: `${input.kindLabel} don't send notifications yet.`,
    };
  }

  if (!input.masterEnabled) {
    return {
      ...base,
      isOverruled: true,
      message:
        'Notifications are off for your account. Turn them on in message settings to hear this chat.',
    };
  }

  if (!input.kindEnabled) {
    return {
      ...base,
      isOverruled: true,
      message: `${input.kindLabel} are muted in your notification settings. Change it there to hear this chat.`,
    };
  }

  return { ...base, isOverruled: false, message: null };
}

/**
 * The interval actually in force for a conversation.
 *
 * MAX, because a chat may make itself quieter but never louder — set 5 against
 * a 15-minute default and 15 still wins.
 *
 * @param kindMinutes - The member's default for this kind
 * @param chatMinutes - This conversation's own value
 * @returns The effective minutes, or null when neither imposes one
 */
export function effectiveInterval(
  kindMinutes: number | null,
  chatMinutes: number | null
): number | null {
  const max = Math.max(kindMinutes ?? 0, chatMinutes ?? 0);
  return max === 0 ? null : max;
}
