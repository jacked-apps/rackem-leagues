/**
 * @fileoverview Tests for the season-lifecycle helpers — pin the
 * "is this league ripe for starting the next season?" logic in one
 * place so both the org-dashboard hint badge and the league-detail
 * ActionCard CTA stay aligned.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { isNextSeasonRipe } from '../seasonLifecycle';

afterEach(() => {
  vi.useRealTimers();
});

// Anchor "today" so end-date math is deterministic.
const NOW_ISO = '2026-05-17T12:00:00Z';

function freezeNow() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW_ISO));
}

describe('isNextSeasonRipe', () => {
  it('returns false for brand-new leagues with no seasons yet', () => {
    freezeNow();
    // No previous season to copy from → wizard would have nothing
    // to pre-fill. Operator goes through the first-time setup flow
    // instead.
    expect(isNextSeasonRipe(null, 0)).toBe(false);
  });

  it('returns true when previous season completed and none is active', () => {
    freezeNow();
    // seasonCount > 0 with no current active season = the prior
    // season was just wrapped up. Operator is ready to start the
    // next one whenever they want.
    expect(isNextSeasonRipe(null, 1)).toBe(true);
    expect(isNextSeasonRipe(undefined, 3)).toBe(true);
  });

  it('returns true when active season ends within 14 days', () => {
    freezeNow();
    // End date 10 days out → operator gets a head start on planning.
    expect(
      isNextSeasonRipe({ end_date: '2026-05-27', status: 'active' }, 1),
    ).toBe(true);
  });

  it('returns true when active season ends exactly at the 14-day window edge', () => {
    freezeNow();
    // 14 days from 2026-05-17 = 2026-05-31. Boundary-inclusive.
    expect(
      isNextSeasonRipe({ end_date: '2026-05-31', status: 'active' }, 1),
    ).toBe(true);
  });

  it('returns false when active season ends more than 14 days out', () => {
    freezeNow();
    // 21 days out — too early for the head-start window. Soft-warn
    // path (not handled by this util — handled by the wizard's
    // first-screen confirm dialog).
    expect(
      isNextSeasonRipe({ end_date: '2026-06-07', status: 'active' }, 1),
    ).toBe(false);
  });

  it('returns false when active season has no end_date', () => {
    freezeNow();
    // Defensive — shouldn't happen in practice but if a season row
    // is missing end_date we can't compute the window. Don't show
    // the CTA in that case (no false positives).
    expect(isNextSeasonRipe({ end_date: null, status: 'active' }, 1)).toBe(
      false,
    );
    expect(isNextSeasonRipe({ status: 'active' }, 1)).toBe(false);
  });

  it('returns true after the active season has already ended (past end_date)', () => {
    freezeNow();
    // end_date in the past = season is technically over but maybe
    // not marked completed yet. Daysuntil is negative which is ≤14.
    expect(
      isNextSeasonRipe({ end_date: '2026-04-01', status: 'active' }, 1),
    ).toBe(true);
  });
});
