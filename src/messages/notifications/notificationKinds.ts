/**
 * @fileoverview Display metadata for conversation kinds, and the interval
 * presets offered in Settings.
 *
 * Kept out of the components so the labels are defined once and the two
 * surfaces (global Settings and the per-chat control) can't drift apart.
 */

/** A conversation kind as presented to a member. */
export interface KindDisplay {
  /** Matches `push_type_policy.conversation_kind`. */
  key: string;
  label: string;
  /** One line under the label; plain language, not schema vocabulary. */
  hint: string;
  /**
   * Whether a quiet interval applies.
   *
   * False for direct messages: a DM is one person talking to you, so holding
   * them back reads as the app swallowing messages. The noise this solves is
   * many people in one room — a group-chat property.
   */
  supportsInterval: boolean;
}

export const KIND_DISPLAY: KindDisplay[] = [
  {
    key: 'direct',
    label: 'Direct messages',
    hint: 'One-to-one and private group messages',
    supportsInterval: false,
  },
  {
    key: 'team_chat',
    label: 'Team chats',
    hint: 'Your team’s conversation',
    supportsInterval: true,
  },
  {
    key: 'captains_chat',
    label: 'Captains chats',
    hint: 'Captains and the league operator',
    supportsInterval: true,
  },
  {
    key: 'match_chat',
    label: 'Match night chats',
    hint: 'The chat for a match you’re playing',
    supportsInterval: true,
  },
  {
    key: 'announcements',
    label: 'Announcements',
    hint: 'League and organization notices',
    supportsInterval: true,
  },
];

/**
 * How quiet a conversation goes after it notifies you once.
 *
 * A preset list rather than a free-text minutes box — that invites "1" and
 * "9999". The stored value is still an integer, so a custom one remains
 * possible later without a migration.
 */
export const INTERVAL_PRESETS: Array<{ value: number | null; label: string }> = [
  { value: null, label: 'Every message' },
  { value: 5, label: 'At most every 5 min' },
  { value: 15, label: 'At most every 15 min' },
  { value: 30, label: 'At most every 30 min' },
  { value: 60, label: 'At most once an hour' },
];

/** The default interval for a group kind when a member hasn't chosen one. */
export const DEFAULT_GROUP_INTERVAL_MINUTES = 5;

/**
 * Look up display metadata for a kind.
 *
 * @param key - A `push_type_policy.conversation_kind` value
 * @returns The display entry, or undefined for a kind we don't present
 */
export function kindDisplay(key: string): KindDisplay | undefined {
  return KIND_DISPLAY.find((k) => k.key === key);
}
