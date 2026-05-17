/**
 * @fileoverview Day-divider helpers for the message thread (Unit 10).
 *
 * Renders calendar-day separators between message groups so a long
 * thread reads naturally:
 *
 *   ─── Today ───
 *   [bubble]
 *   [bubble]
 *   ─── Yesterday ───
 *   [bubble]
 *   ─── May 12 ───
 *   [bubble]
 *
 * Pure helpers — no React. Consumed by `MessageList` which interleaves
 * dividers with `MessageBubble` rows.
 *
 * Timezone notes:
 *   - Message timestamps are ISO-with-TZ strings from the server
 *     (e.g. "2026-05-17T12:34:56.789Z"). `new Date(iso)` parses
 *     correctly regardless of timezone.
 *   - "Same day" comparison uses LOCAL year/month/day from `Date`
 *     getters — so a message at 23:55 UTC and a message at 00:05 UTC
 *     can land on the same OR different local dates depending on the
 *     viewer's timezone. That's intentional — users want grouping by
 *     THEIR calendar, not UTC's.
 */

/**
 * Build a "YYYY-MM-DD" key in the local timezone from an ISO timestamp.
 * Used as the grouping key — two messages share a day iff this matches.
 */
function localDayKey(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Human-friendly label for a day-divider, given a message's ISO
 * timestamp and the current "now" (defaults to `new Date()`; injectable
 * for tests).
 *
 *   - "Today" if the message is from today (local).
 *   - "Yesterday" if the message is from yesterday (local).
 *   - Otherwise: locale-formatted short date (e.g. "May 12").
 */
export function getDayLabel(isoTimestamp: string, now: Date = new Date()): string {
  const msgKey = localDayKey(isoTimestamp);
  const todayKey = localDayKey(now.toISOString());

  if (msgKey === todayKey) return 'Today';

  // Yesterday: subtract one day in LOCAL time. Use the local-midnight
  // anchor of `now` so DST transitions don't shift the comparison by ±1h.
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayKey = localDayKey(yesterday.toISOString());
  if (msgKey === yesterdayKey) return 'Yesterday';

  // Older: locale-formatted "MMM d" (e.g. "May 12"). Includes year only
  // when it's not the current calendar year.
  const msgDate = new Date(isoTimestamp);
  const sameYear = msgDate.getFullYear() === now.getFullYear();
  return msgDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
}

/**
 * A single rendered row produced by `interleaveDayDividers`. Either:
 *   - a divider (with a stable `key` and human label), OR
 *   - the original message item, untouched.
 */
export type DividerRow<TMessage> =
  | { kind: 'divider'; key: string; label: string }
  | { kind: 'message'; message: TMessage };

/**
 * Walk a chronologically-ordered messages array and emit a flat sequence
 * of dividers + messages. A divider is emitted BEFORE the first message
 * of each new local calendar day.
 *
 * Generic over `TMessage` so the helper works for either the confirmed
 * `Message` shape from `MessageList` or the optimistic `OutgoingMessage`
 * shape — caller passes a `getTimestamp` accessor.
 *
 * @example
 * const rows = interleaveDayDividers(messages, m => m.created_at);
 * rows.map(r => r.kind === 'divider' ? <Divider label={r.label} /> : <Bubble {...r.message} />);
 */
export function interleaveDayDividers<TMessage>(
  messages: TMessage[],
  getTimestamp: (m: TMessage) => string,
  now: Date = new Date(),
): DividerRow<TMessage>[] {
  const rows: DividerRow<TMessage>[] = [];
  let lastDayKey: string | null = null;

  for (const message of messages) {
    const ts = getTimestamp(message);
    if (!ts) {
      // Skip dividers for messages without a real timestamp (e.g., a
      // pending outgoing entry whose createdAt is empty). The message
      // itself still renders.
      rows.push({ kind: 'message', message });
      continue;
    }
    const dayKey = localDayKey(ts);
    if (dayKey !== lastDayKey) {
      rows.push({
        kind: 'divider',
        key: `divider-${dayKey}`,
        label: getDayLabel(ts, now),
      });
      lastDayKey = dayKey;
    }
    rows.push({ kind: 'message', message });
  }

  return rows;
}
