/**
 * @fileoverview Unit tests for buildConfirmerAudit (the per-game confirmer line).
 */

import { describe, it, expect } from 'vitest';
import {
  buildConfirmerAudit,
  type ConfirmationForAudit,
  type GameForAudit,
} from '../confirmerAudit';

const names = new Map([
  ['h1', { name: 'Ace', team: 'Sharks' }],
  ['h2', { name: 'Bo', team: 'Sharks' }],
  ['h3', { name: 'Cy', team: 'Sharks' }],
  ['a1', { name: 'Dee', team: 'Jets' }],
  ['lo', { name: 'Operator', team: null }],
]);

const conf = (over: Partial<ConfirmationForAudit>): ConfirmationForAudit => ({
  confirmer_id: 'h2',
  side: 'home',
  action: 'confirm',
  created_at: '2026-06-01T00:00:00Z',
  ...over,
});

const game: GameForAudit = { confirmed_by_home: 'h1', confirmed_by_away: 'a1' };

describe('buildConfirmerAudit', () => {
  it('shows the official per side from the columns + names', () => {
    const a = buildConfirmerAudit(game, [], names, 'lo');
    expect(a.home.official?.name).toBe('Ace');
    expect(a.away.official?.name).toBe('Dee');
    expect(a.home.others).toEqual([]);
  });

  it('counts extra home vouchers as "+N others" (deduped, excluding the official)', () => {
    const rows = [
      conf({ confirmer_id: 'h1' }), // the official — excluded
      conf({ confirmer_id: 'h2' }),
      conf({ confirmer_id: 'h3' }),
      conf({ confirmer_id: 'h2' }), // dup — excluded
    ];
    const a = buildConfirmerAudit(game, rows, names, 'lo');
    expect(a.home.others.map((o) => o.name)).toEqual(['Bo', 'Cy']);
  });

  it('never counts the operator as an "other"', () => {
    const rows = [conf({ confirmer_id: 'lo' }), conf({ confirmer_id: 'h2' })];
    const a = buildConfirmerAudit(game, rows, names, 'lo');
    expect(a.home.others.map((o) => o.id)).toEqual(['h2']);
  });

  it('excludes confirms at or before the latest vacate marker', () => {
    const rows = [
      conf({ confirmer_id: 'h2', created_at: '2026-06-01T00:00:00Z' }), // pre-vacate
      conf({ confirmer_id: 'h3', action: 'vacate', created_at: '2026-06-02T00:00:00Z' }),
      conf({ confirmer_id: 'h2', created_at: '2026-06-03T00:00:00Z' }), // post-vacate
    ];
    const a = buildConfirmerAudit(game, rows, names, 'lo');
    // only the post-vacate Bo vouch survives
    expect(a.home.others.map((o) => o.name)).toEqual(['Bo']);
  });

  it('no log rows → official from columns, +0 others (v1 / pre-many-eyes game)', () => {
    const a = buildConfirmerAudit({ confirmed_by_home: 'lo', confirmed_by_away: 'lo' }, [], names, 'lo');
    expect(a.home.official?.name).toBe('Operator');
    expect(a.home.others).toEqual([]);
    expect(a.away.others).toEqual([]);
  });

  it('falls back to the raw id when a confirmer has no name', () => {
    const a = buildConfirmerAudit({ confirmed_by_home: 'unknown', confirmed_by_away: null }, [], names, 'lo');
    expect(a.home.official).toEqual({ id: 'unknown', name: 'unknown', team: null });
    expect(a.away.official).toBeNull();
  });
});
