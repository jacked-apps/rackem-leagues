/**
 * @fileoverview Tests for the realtime heartbeat-noise filter.
 *
 * Pins the fail-OPEN posture: a missing or partial `old` row (what RLS does to
 * the payload) never passes as noise.
 */
import { describe, it, expect } from 'vitest';
import { onlyIgnoredColumnsChanged, HEARTBEAT_COLUMNS } from './roomChangeFilter';

const phone = { id: 'p1', display_name: 'Ed', last_seen_at: 't1', settings: { a: 1 } };

describe('onlyIgnoredColumnsChanged', () => {
  it('true when only an ignored column moved', () => {
    expect(
      onlyIgnoredColumnsChanged(phone, { ...phone, last_seen_at: 't2' }, HEARTBEAT_COLUMNS.room_phones)
    ).toBe(true);
  });

  it('false when a rendered column moved too', () => {
    expect(
      onlyIgnoredColumnsChanged(
        phone,
        { ...phone, last_seen_at: 't2', display_name: 'Eddie' },
        HEARTBEAT_COLUMNS.room_phones
      )
    ).toBe(false);
  });

  it('compares jsonb columns structurally, not by reference', () => {
    expect(onlyIgnoredColumnsChanged(phone, { ...phone, settings: { a: 1 } }, [])).toBe(true);
    expect(onlyIgnoredColumnsChanged(phone, { ...phone, settings: { a: 2 } }, [])).toBe(false);
  });

  it('fails open on a missing or partial old row (the RLS shape)', () => {
    expect(onlyIgnoredColumnsChanged(null, phone, HEARTBEAT_COLUMNS.room_phones)).toBe(false);
    expect(onlyIgnoredColumnsChanged({ id: 'p1' }, { ...phone, last_seen_at: 't2' }, HEARTBEAT_COLUMNS.room_phones)).toBe(false);
  });
});
