/**
 * @fileoverview "Was this UPDATE just the heartbeat?" — the Game Room's
 * realtime noise filter.
 *
 * Every device beats every 30 s (`room_phones.last_seen_at`) and, rarely, the
 * room row's `last_activity_at` moves with it. Neither changes anything a
 * screen renders, so `useRoomRealtime` drops those UPDATEs instead of
 * refetching the room on every beat from every phone.
 *
 * The decision compares the event's `old` and `new` rows column by column.
 * That is only possible because both room tables carry REPLICA IDENTITY FULL
 * with RLS off — with RLS on, Supabase narrows `old` to the primary key, every
 * other column looks "changed", and this filter fails OPEN (invalidates).
 * Loud, not wrong. PRE_LAUNCH_CHECKLIST carries the reminder for the RLS pass.
 */

/** Columns whose lone movement is heartbeat noise, per table. */
export const HEARTBEAT_COLUMNS: Record<string, readonly string[]> = {
  rooms: ['last_activity_at'],
  room_phones: ['last_seen_at'],
};

type Row = Record<string, unknown>;

/** Structural equality good enough for a jsonb-decoded row: primitives by
 *  value, objects/arrays by their JSON text. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * True when every column that differs between `oldRow` and `newRow` is one of
 * `ignored` — i.e. nothing a screen cares about moved. A missing or partial
 * `oldRow` (the RLS case) makes columns look changed, so this returns false
 * and the caller refetches.
 *
 * @param oldRow  The event's `old` record.
 * @param newRow  The event's `new` record.
 * @param ignored Columns whose movement alone does not count.
 */
export function onlyIgnoredColumnsChanged(
  oldRow: Row | null | undefined,
  newRow: Row | null | undefined,
  ignored: readonly string[]
): boolean {
  if (!oldRow || !newRow) return false;
  const keys = new Set([...Object.keys(oldRow), ...Object.keys(newRow)]);
  for (const key of keys) {
    if (ignored.includes(key)) continue;
    if (!same(oldRow[key], newRow[key])) return false;
  }
  return true;
}
