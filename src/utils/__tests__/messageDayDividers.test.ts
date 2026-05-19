/**
 * @fileoverview Tests for the Unit 10 day-divider helpers.
 *
 * Pin the label-resolution and interleaving contracts so the
 * MessageList renderer can rely on stable behavior:
 *   - "Today" / "Yesterday" for recent messages (local TZ)
 *   - Locale-formatted date for older messages (with year only when
 *     it differs from the current year)
 *   - Divider per local-day boundary, never duplicated within a day
 *   - Order: divider always emitted BEFORE the first message of its day
 */

import { describe, it, expect } from 'vitest';
import {
  getDayLabel,
  interleaveDayDividers,
} from '../messageDayDividers';

// Build a stable "now" anchored to local midnight + 12h so DST shifts
// and timezone offsets don't randomly land messages on different sides
// of midnight. Tests treat 2026-05-17 12:00 LOCAL as "now".
const NOW = new Date(2026, 4, 17, 12, 0, 0);

// Helper: produce an ISO timestamp for a specific local Y/M/D at noon.
function isoAtLocalNoon(y: number, m: number, d: number): string {
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

describe('getDayLabel', () => {
  it('returns "Today" for a same-day timestamp', () => {
    expect(getDayLabel(isoAtLocalNoon(2026, 5, 17), NOW)).toBe('Today');
  });

  it('returns "Yesterday" for the previous local day', () => {
    expect(getDayLabel(isoAtLocalNoon(2026, 5, 16), NOW)).toBe('Yesterday');
  });

  it('returns a "MMM d" label (no year) for a date earlier in the same year', () => {
    const label = getDayLabel(isoAtLocalNoon(2026, 3, 1), NOW);
    expect(label).toMatch(/Mar\s*1/);
    expect(label).not.toMatch(/2026/);
  });

  it('returns a label with year for a date in a previous year', () => {
    const label = getDayLabel(isoAtLocalNoon(2024, 12, 25), NOW);
    expect(label).toMatch(/Dec\s*25/);
    expect(label).toMatch(/2024/);
  });

  it('handles 2-days-ago correctly (no "Today" / "Yesterday")', () => {
    const label = getDayLabel(isoAtLocalNoon(2026, 5, 15), NOW);
    expect(label).not.toBe('Today');
    expect(label).not.toBe('Yesterday');
    expect(label).toMatch(/May\s*15/);
  });
});

describe('interleaveDayDividers', () => {
  it('returns an empty array for an empty input', () => {
    expect(interleaveDayDividers([], () => '', NOW)).toEqual([]);
  });

  it('emits exactly one divider for a single-day thread', () => {
    const messages = [
      { id: 'a', created_at: isoAtLocalNoon(2026, 5, 17) },
      { id: 'b', created_at: isoAtLocalNoon(2026, 5, 17) },
      { id: 'c', created_at: isoAtLocalNoon(2026, 5, 17) },
    ];
    const rows = interleaveDayDividers(messages, (m) => m.created_at, NOW);
    const dividers = rows.filter((r) => r.kind === 'divider');
    expect(dividers).toHaveLength(1);
    expect(dividers[0]).toMatchObject({ kind: 'divider', label: 'Today' });
  });

  it('emits a divider per day boundary in a multi-day thread', () => {
    const messages = [
      { id: 'a', created_at: isoAtLocalNoon(2026, 5, 15) }, // 2 days ago
      { id: 'b', created_at: isoAtLocalNoon(2026, 5, 15) },
      { id: 'c', created_at: isoAtLocalNoon(2026, 5, 16) }, // yesterday
      { id: 'd', created_at: isoAtLocalNoon(2026, 5, 17) }, // today
      { id: 'e', created_at: isoAtLocalNoon(2026, 5, 17) },
    ];
    const rows = interleaveDayDividers(messages, (m) => m.created_at, NOW);
    const dividers = rows.filter((r) => r.kind === 'divider');
    expect(dividers).toHaveLength(3);
    expect(dividers.map((d) => (d as { label: string }).label)).toEqual([
      expect.stringMatching(/May\s*15/),
      'Yesterday',
      'Today',
    ]);
  });

  it('emits the divider BEFORE the first message of its day', () => {
    const messages = [
      { id: 'a', created_at: isoAtLocalNoon(2026, 5, 16) }, // yesterday
      { id: 'b', created_at: isoAtLocalNoon(2026, 5, 17) }, // today
    ];
    const rows = interleaveDayDividers(messages, (m) => m.created_at, NOW);
    // Expected order: divider(Yesterday), message(a), divider(Today), message(b)
    expect(rows).toHaveLength(4);
    expect(rows[0].kind).toBe('divider');
    expect(rows[1].kind).toBe('message');
    expect(rows[2].kind).toBe('divider');
    expect(rows[3].kind).toBe('message');
  });

  it('uses stable keys per day so React can re-use divider nodes across renders', () => {
    const messages = [
      { id: 'a', created_at: isoAtLocalNoon(2026, 5, 16) },
      { id: 'b', created_at: isoAtLocalNoon(2026, 5, 17) },
    ];
    const first = interleaveDayDividers(messages, (m) => m.created_at, NOW);
    const second = interleaveDayDividers(messages, (m) => m.created_at, NOW);
    const firstKeys = first
      .filter((r) => r.kind === 'divider')
      .map((r) => (r as { key: string }).key);
    const secondKeys = second
      .filter((r) => r.kind === 'divider')
      .map((r) => (r as { key: string }).key);
    expect(firstKeys).toEqual(secondKeys);
    expect(firstKeys[0]).toBe('divider-2026-05-16');
    expect(firstKeys[1]).toBe('divider-2026-05-17');
  });

  it('skips dividers for messages with an empty timestamp (e.g., pending entries without server time)', () => {
    const messages = [
      { id: 'a', created_at: isoAtLocalNoon(2026, 5, 17) },
      { id: 'b', created_at: '' }, // pending optimistic entry
    ];
    const rows = interleaveDayDividers(messages, (m) => m.created_at, NOW);
    const dividers = rows.filter((r) => r.kind === 'divider');
    expect(dividers).toHaveLength(1); // only one, for the dated message
    // The empty-timestamp message still renders (just not separated)
    const msgs = rows.filter((r) => r.kind === 'message');
    expect(msgs).toHaveLength(2);
  });
});
