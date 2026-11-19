/**
 * @fileoverview planOddLeagueDrop on the REAL 8-slot chart (7 teams + BYE).
 *
 * Slot 8 is the BYE, team 7 drops after week 3. Ed's example is week 5 of the
 * chart: 7 vs 1 and 3 vs BYE become 3 vs 1. Expected values come from his
 * rule (2026-11-19), not from running the code.
 */

import { describe, it, expect } from 'vitest';
import { eightTeamSchedule } from '@/data/matchupTables/8-team';
import { planOddLeagueDrop, type DropPlanMatch } from './planOddLeagueDrop';

const BYE = 't8';
const DROPPED = 't7';
const never = () => { throw new Error('coin flip should not be needed'); };

/** Weeks 1..n of the chart as matches; the first `played` weeks are started. */
function season(n: number, played: number): DropPlanMatch[] {
  return eightTeamSchedule.slice(0, n).flatMap((week, w) =>
    week.map(([h, a], i) => ({
      id: `w${w + 1}m${i + 1}`,
      weekId: `w${w + 1}`,
      weekDate: `2026-01-${String(w + 1).padStart(2, '0')}`,
      homeTeamId: `t${h}`,
      awayTeamId: `t${a}`,
      started: w < played,
    })),
  );
}

describe('planOddLeagueDrop', () => {
  const matches = season(14, 3);
  const plan = planOddLeagueDrop(matches, DROPPED, BYE, ['t1', 't2', 't3', 't4', 't5', 't6'], never);

  it("Ed's example (week 5): 7 vs 1 and 3 vs BYE become 3 (home) vs 1 (away)", () => {
    expect(plan.updates.find((u) => u.weekId === 'w5')).toEqual({
      matchId: 'w5m3', weekId: 'w5', homeTeamId: 't3', awayTeamId: 't1',
    });
    expect(plan.deleteMatchIds).toContain('w5m1');
  });

  it('a week where the dropped team already had the bye only removes that match', () => {
    // Week 8: [7, 8] is the dropped team vs the BYE.
    expect(plan.deleteMatchIds).toContain('w8m2');
    expect(plan.updates.some((u) => u.weekId === 'w8')).toBe(false);
  });

  it('never touches the weeks already played', () => {
    const touched = [...plan.updates.map((u) => u.matchId), ...plan.deleteMatchIds];
    expect(touched.filter((id) => /^w[123]m/.test(id))).toEqual([]);
  });

  it('afterwards every remaining week has each of the 6 real teams playing exactly once', () => {
    const deleted = new Set(plan.deleteMatchIds);
    const updated = new Map(plan.updates.map((u) => [u.matchId, u]));
    for (let w = 4; w <= 14; w++) {
      const week = matches
        .filter((m) => m.weekId === `w${w}` && !deleted.has(m.id))
        .map((m) => updated.get(m.id) ?? m);
      const teams = week.flatMap((m) => [m.homeTeamId, m.awayTeamId]).sort();
      expect(teams, `week ${w}`).toEqual(['t1', 't2', 't3', 't4', 't5', 't6']);
    }
  });

  it("an unplayed dropped-team match whose week's bye was already settled moves onto the BYE", () => {
    // Week 5's bye match (3 vs BYE) was already settled by the sweep, but 7 vs 1 is still unplayed.
    const settled = season(5, 4).map((m) => (m.id === 'w5m3' ? { ...m, started: true } : m));
    const p = planOddLeagueDrop(settled, DROPPED, BYE, [], never);
    expect(p.rewireToBye).toEqual([{ matchId: 'w5m1', weekId: 'w5' }]);
    expect(p.updates).toEqual([]);
  });
});
