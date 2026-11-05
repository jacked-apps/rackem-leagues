/**
 * @fileoverview Tests for the ONE team handicap bonus helper.
 *
 * The home team's bonus in points-system leagues = floor(win gap ÷ divisor),
 * where the divisor comes from the league's team-bonus setting (standard 2,
 * reduced 3, none → 0). Since 2026-11-01:
 *  - it is NEVER applied in a playoff week (user complaint: a playoff match
 *    was decided with a bonus that shouldn't exist), and
 *  - the lineup screen and match setup both use this helper, so they can't
 *    disagree (the old setup copy always divided by 2).
 *
 * Two layers: `computeTeamBonus` (pure rule, every case) and
 * `getTeamHandicapBonus` (database lookup, supabase mocked per table).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

/** Canned answers per table; each test fills these in. */
const db: {
  match: unknown;
  matchError: { message: string } | null;
  prefs: unknown;
  completed: Array<{ winner_team_id: string | null }>;
} = { match: null, matchError: null, prefs: null, completed: [] };

const from = vi.fn();
vi.mock('@/supabaseClient', () => ({ supabase: { from: (t: string) => from(t) } }));

import { computeTeamBonus, getTeamHandicapBonus } from '../getTeamHandicapBonus';

/** A chain whose every filter returns itself and resolves to `result`. */
function chain(result: unknown) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq']) c[m] = () => c;
  c.single = () => Promise.resolve(result);
  c.maybeSingle = () => Promise.resolve(result);
  c.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return c;
}

let matchesCalls = 0;
beforeEach(() => {
  matchesCalls = 0;
  db.matchError = null;
  db.prefs = { team_handicap_variant: 'standard' };
  db.completed = [];
  db.match = {
    home_team_id: 'H',
    away_team_id: 'A',
    season_id: 'S',
    season_week: { week_type: 'regular' },
    season: { league_id: 'L' },
  };
  from.mockReset().mockImplementation((table: string) => {
    if (table === 'resolved_league_preferences') return chain({ data: db.prefs, error: null });
    // matches: first call reads the match, second reads completed results.
    matchesCalls += 1;
    return matchesCalls === 1
      ? chain({ data: db.match, error: db.matchError })
      : chain({ data: db.completed, error: null });
  });
});

const wins = (home: number, away: number) => [
  ...Array.from({ length: home }, () => ({ winner_team_id: 'H' })),
  ...Array.from({ length: away }, () => ({ winner_team_id: 'A' })),
  { winner_team_id: 'OTHER' },
];

describe('computeTeamBonus — the rule', () => {
  const rule = (homeWins: number, awayWins: number, variant: 'standard' | 'reduced' | 'none', isPlayoff = false) =>
    computeTeamBonus({ homeWins, awayWins, variant, isPlayoff });

  it('standard: every 2 wins ahead is +1, floored (negative gaps floor down)', () => {
    expect(rule(4, 4, 'standard')).toBe(0);
    expect(rule(8, 7, 'standard')).toBe(0);
    expect(rule(4, 2, 'standard')).toBe(1);
    expect(rule(8, 3, 'standard')).toBe(2);
    expect(rule(3, 7, 'standard')).toBe(-2);
    expect(rule(0, 5, 'standard')).toBe(-3);
    expect(rule(0, 1, 'standard')).toBe(-1);
  });

  it('reduced: every 3 wins ahead is +1', () => {
    expect(rule(2, 0, 'reduced')).toBe(0);
    expect(rule(3, 0, 'reduced')).toBe(1);
    expect(rule(5, 0, 'reduced')).toBe(1);
    expect(rule(6, 0, 'reduced')).toBe(2);
    expect(rule(0, 3, 'reduced')).toBe(-1);
  });

  it('none: always 0', () => {
    expect(rule(10, 0, 'none')).toBe(0);
  });

  it('playoffs: always 0, whatever the setting or gap', () => {
    expect(rule(8, 3, 'standard', true)).toBe(0);
    expect(rule(0, 9, 'reduced', true)).toBe(0);
  });
});

describe('getTeamHandicapBonus — database lookup', () => {
  it('returns 0 for non-points systems without touching the database', async () => {
    for (const type of ['percentage', 'fargo', 'none', 'mystery']) {
      expect(await getTeamHandicapBonus('m1', type)).toBe(0);
    }
    expect(from).not.toHaveBeenCalled();
  });

  it('regular week, standard league: home 8–3 → +2 (other teams ignored)', async () => {
    db.completed = wins(8, 3);
    expect(await getTeamHandicapBonus('m1', 'points')).toBe(2);
  });

  it('PLAYOFF week → 0, and stops before reading standings', async () => {
    db.match = { ...(db.match as object), season_week: { week_type: 'playoffs' } };
    db.completed = wins(8, 3);
    expect(await getTeamHandicapBonus('m1', 'points')).toBe(0);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("uses the league's resolved setting: reduced 8–3 → +1", async () => {
    db.prefs = { team_handicap_variant: 'reduced' };
    db.completed = wins(8, 3);
    expect(await getTeamHandicapBonus('m1', 'points')).toBe(1);
  });

  it("'none' league → 0", async () => {
    db.prefs = { team_handicap_variant: 'none' };
    db.completed = wins(8, 3);
    expect(await getTeamHandicapBonus('m1', 'points')).toBe(0);
  });

  it('no stored setting falls back to standard', async () => {
    db.prefs = null;
    db.completed = wins(4, 2);
    expect(await getTeamHandicapBonus('m1', 'points')).toBe(1);
  });

  it('a failed match read returns 0 (neutral) instead of throwing', async () => {
    db.match = null;
    db.matchError = { message: 'boom' };
    expect(await getTeamHandicapBonus('m1', 'points')).toBe(0);
  });
});
