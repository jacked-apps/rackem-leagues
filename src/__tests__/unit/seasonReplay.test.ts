/**
 * @fileoverview Season replay: every match of the one real, completed league
 * season (Sunday 9-ball, points handicap — 64 matches, 1,170 games),
 * re-scored through today's scoring code, must reproduce what the league
 * accepted.
 *
 * Why this is the answer key: each game's winner was entered and confirmed by
 * BOTH teams on the night, and the season's results were accepted by the
 * league (Ed, 2026-11-17: finished, players satisfied, effectively final). So
 * the expected values come from real people and a real season — not from an AI
 * writing down whatever the code returns. It is a regression check: if a
 * change to scoring would have scored any real night differently, this fails
 * and names the night.
 *
 * Fixture: src/__tests__/fixtures/season-2026-sunday-9ball.json, built by
 * scripts/fetch-season-fixture.mjs (read-only, anonymised — no names, ids or
 * dates; the repo is public).
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U4)
 */

import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import fixture from '../fixtures/season-2026-sunday-9ball.json';
import { replayMatch, type FixtureMatch } from './seasonReplay.helpers';
import { runningTotalsDiffer } from '@/utils/match/engineRunningTotals';

const matches = fixture.matches as unknown as FixtureMatch[];

/**
 * Matches whose STORED lineup handicaps no longer produce the targets the
 * match was played with. Scoring is unaffected (targets are frozen at setup
 * and every one of these still reproduces its points) — the lineup row was
 * rewritten afterwards. Each needs a reason; adding one changes the pinned
 * hash below, so it can't slip in unseen.
 */
const TARGET_EXCEPTIONS: Record<string, string> = {
  'W06-M5': "'Ben vs Duff' — beta-era hand repair of the lineup row (docs/audits/2026-10-28-tiebreaker-audit.md)",
  'W11-M3': 'tiebreaker re-lock rewrote the lineup handicaps (audit F1; fixed by #291, 2026-10-29)',
  'W11-M4': 'tiebreaker re-lock rewrote the lineup handicaps (audit F1; fixed by #291, 2026-10-29)',
  'W12-M3': 'tiebreaker re-lock rewrote the lineup handicaps (audit F1; fixed by #291, 2026-10-29)',
  'W16-M2': 'tiebreaker re-lock rewrote the lineup handicaps (audit F1; fixed by #291, 2026-10-29)',
  'W19-M5': 'likely: away lineup locked 1.5h after the match started, no swap — the pre-#313 one-lock start (fixed 2026-11-05)',
};

/**
 * Pins the fixture's inputs, expected values and the exceptions above. If any
 * of them change, this fails until the hash is updated in the SAME diff — so
 * "edit the expected number until it's green" is always a visible change.
 */
const PINNED_HASH = 'ef5fb28b9bb278aac71bc1e7ddd5f325eb02f582c91eaaf4b6dda4befb625229';

describe('season replay — 2026 Sunday 9-ball', () => {
  it('fixture is untouched (expected values + exceptions are pinned)', () => {
    const payload = JSON.stringify([matches.map((m) => [m.key, m.stored, m.lineups, m.games]), TARGET_EXCEPTIONS]);
    expect(createHash('sha256').update(payload).digest('hex')).toBe(PINNED_HASH);
  });

  it('has the whole season (64 matches, all with a scoring snapshot)', () => {
    expect(matches).toHaveLength(64);
    expect(matches.every((m) => m.snapshot && !m.usesThresholdChart)).toBe(true);
  });

  // The repo is public: the committed fixture must carry no real id or date,
  // and no field the fixture builder doesn't explicitly allow.
  it('privacy: no uuid, no date, no unexpected field in the committed fixture', () => {
    const text = JSON.stringify(fixture);
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(text).not.toMatch(/20dd-dd-dd/);
    const keys = new Set(matches.flatMap((m) => Object.keys(m)));
    expect([...keys].sort()).toEqual(['away', 'games', 'home', 'key', 'lineups', 'snapshot', 'stored', 'usesThresholdChart', 'week', 'weekType']);
  });

  // A 9–9 night is NOT automatically a tie: here the handicap set the away
  // target at 6, so away won outright and home scored −4 against par 13.
  it('Week 20, a 9–9 night decided by handicap, scores −4 / +4 with no tiebreaker', () => {
    const m = matches.find((x) => x.key === 'W20-M2')!;
    const { engine, regularVerdict, tiebreakerWinner } = replayMatch(m);
    expect(engine).toMatchObject({ home_games_won: 9, away_games_won: 9, home_points_earned: -4, away_points_earned: 4 });
    expect([regularVerdict, tiebreakerWinner]).toEqual(['away', null]);
  });

  it('every exception names a real match', () => {
    expect(Object.keys(TARGET_EXCEPTIONS).filter((k) => !matches.some((m) => m.key === k))).toEqual([]);
  });

  describe.each(matches.map((m) => [`Week ${m.week}, ${m.home} vs ${m.away} (${m.key})`, m] as const))('%s', (_label, match) => {
    const { engine, legacy, targets, regularVerdict, tiebreakerWinner } = replayMatch(match);
    const { stored } = match;

    it('reproduces games won and points', () => {
      expect(engine).toEqual({
        home_games_won: stored.home_games_won,
        away_games_won: stored.away_games_won,
        home_points_earned: stored.home_points_earned,
        away_points_earned: stored.away_points_earned,
      });
    });

    // Regular games decide it, or they come out level and the tiebreaker
    // games do — either way the result must be the one the league recorded.
    it('reproduces the winner', () => {
      const winner = regularVerdict === 'tie' ? tiebreakerWinner : regularVerdict;
      expect({ winner, tiebreakerPlayed: tiebreakerWinner !== null }).toEqual({
        winner: stored.winner,
        tiebreakerPlayed: regularVerdict === 'tie',
      });
      expect(stored.match_result).toBe(`${stored.winner}_win`);
    });

    it('engine and legacy scoring agree', () => {
      expect(engine && runningTotalsDiffer(engine, legacy)).toBe(false);
    });

    // No skips: a listed exception must STILL disagree, so a stale entry (or
    // a code change that quietly "fixes" it) fails here instead of hiding.
    const isException = match.key in TARGET_EXCEPTIONS;
    it(isException ? 'listed exception: stored lineups still do NOT give the stored targets' : 'stored lineups give the stored targets', () => {
      const storedTargets = [
        { games_to_win: stored.home_to_win, games_to_tie: stored.home_to_tie, games_to_lose: stored.home_to_lose },
        { games_to_win: stored.away_to_win, games_to_tie: stored.away_to_tie, games_to_lose: stored.away_to_lose },
      ];
      if (isException) expect([targets.home, targets.away]).not.toEqual(storedTargets);
      else expect([targets.home, targets.away]).toEqual(storedTargets);
    });
  });
});
