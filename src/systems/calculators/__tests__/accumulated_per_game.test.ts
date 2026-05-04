/**
 * @fileoverview Tests for the `accumulated_per_game` calculator
 * (Phase 1 Unit 1.4).
 *
 * Locks the per-side scoring contract (winner / loser each independently
 * configurable as fixed-points or counter-with-range), the popup field
 * spec, and characterization equivalence with the legacy fargo5v5
 * per-game accumulation.
 *
 * Coverage:
 *   - Fargo 10-7 Tested Preset (winner=fixed-10, loser=counter-0-7)
 *   - Custom winner-fixed values (e.g., 14, 17, 0)
 *   - Custom loser counter ranges (e.g., 0–9 for 9-ball)
 *   - Winner=counter configurations (forward-extensibility — uses winner_score)
 *   - Loser=fixed configurations (LO-driven scoring without counter input)
 *   - Counter clamping (values outside [min, max] are clamped to range)
 *   - Null score handling (counter with null → min; fixed unaffected)
 *   - Skip games without a winner
 *   - Tiebreaker games are NOT internally filtered (caller's responsibility)
 *   - Defensive behavior on malformed params
 *   - Calculator metadata + scoringPopupFields adapt to params
 */

import { describe, it, expect, vi } from 'vitest';
import { accumulatedPerGame } from '../accumulated_per_game';
import type {
  AccumulatedPerGameParams,
  SideScoringConfig,
} from '../accumulated_per_game';

const HOME = 'team-home';
const AWAY = 'team-away';

const game = (
  winner: string | null,
  winner_score: number | null = null,
  loser_score: number | null = null,
  is_tiebreaker = false,
) => ({ winner_team_id: winner, winner_score, loser_score, is_tiebreaker });

const compute = (
  games: ReturnType<typeof game>[],
  teamId: string,
  params: AccumulatedPerGameParams = accumulatedPerGame.defaultParams,
) => accumulatedPerGame.compute({ games, teamId }, params);

describe('accumulated_per_game — calculator metadata', () => {
  it('has the expected name and kind', () => {
    expect(accumulatedPerGame.name).toBe('accumulated_per_game');
    expect(accumulatedPerGame.kind).toBe('per_game');
  });

  it('has Fargo 10-7 default params', () => {
    expect(accumulatedPerGame.defaultParams).toEqual({
      winner: { kind: 'fixed', points: 10 },
      loser: { kind: 'counter', min: 0, max: 7, label: 'Balls pocketed' },
    });
  });

  it('paramSchema validates Fargo 10-7 defaults', () => {
    expect(
      accumulatedPerGame.paramSchema.safeParse(accumulatedPerGame.defaultParams)
        .success,
    ).toBe(true);
  });

  it('paramSchema validates a winner=counter / loser=fixed configuration', () => {
    expect(
      accumulatedPerGame.paramSchema.safeParse({
        winner: { kind: 'counter', min: 0, max: 14, label: 'Racks won' },
        loser: { kind: 'fixed', points: 0 },
      }).success,
    ).toBe(true);
  });

  it('paramSchema rejects unknown side kind', () => {
    expect(
      accumulatedPerGame.paramSchema.safeParse({
        winner: { kind: 'experimental', points: 10 },
        loser: { kind: 'fixed', points: 0 },
      } as unknown).success,
    ).toBe(false);
  });

  it('paramSchema rejects fixed missing points', () => {
    expect(
      accumulatedPerGame.paramSchema.safeParse({
        winner: { kind: 'fixed' },
        loser: { kind: 'fixed', points: 0 },
      } as unknown).success,
    ).toBe(false);
  });

  it('paramSchema rejects counter missing min/max', () => {
    expect(
      accumulatedPerGame.paramSchema.safeParse({
        winner: { kind: 'fixed', points: 10 },
        loser: { kind: 'counter', label: 'Balls' },
      } as unknown).success,
    ).toBe(false);
  });
});

describe('accumulated_per_game — scoringPopupFields adapts to params', () => {
  it('Fargo 10-7 default: winner fixed 10, loser counter 0–7', () => {
    const spec = accumulatedPerGame.scoringPopupFields(
      accumulatedPerGame.defaultParams,
    );
    expect(spec.perSideInputs).toEqual({
      winner: { kind: 'fixed', points: 10 },
      loser: { kind: 'counter', min: 0, max: 7, label: 'Balls pocketed' },
    });
  });

  it('LO-edited winner_points: spec reflects new value', () => {
    const params: AccumulatedPerGameParams = {
      winner: { kind: 'fixed', points: 15 },
      loser: { kind: 'counter', min: 0, max: 7, label: 'Balls pocketed' },
    };
    const spec = accumulatedPerGame.scoringPopupFields(params);
    expect(spec.perSideInputs?.winner).toEqual({ kind: 'fixed', points: 15 });
  });

  it('Both sides counter: spec exposes both ranges', () => {
    const params: AccumulatedPerGameParams = {
      winner: { kind: 'counter', min: 0, max: 14, label: 'Racks won' },
      loser: { kind: 'counter', min: 0, max: 9, label: 'Balls pocketed' },
    };
    const spec = accumulatedPerGame.scoringPopupFields(params);
    expect(spec.perSideInputs).toEqual({
      winner: { kind: 'counter', min: 0, max: 14, label: 'Racks won' },
      loser: { kind: 'counter', min: 0, max: 9, label: 'Balls pocketed' },
    });
  });

  it('Loser=fixed-0: spec hides loser counter entirely', () => {
    const params: AccumulatedPerGameParams = {
      winner: { kind: 'fixed', points: 10 },
      loser: { kind: 'fixed', points: 0 },
    };
    const spec = accumulatedPerGame.scoringPopupFields(params);
    expect(spec.perSideInputs?.loser).toEqual({ kind: 'fixed', points: 0 });
  });
});

describe('accumulated_per_game — Fargo 10-7 Tested Preset (winner=fixed-10, loser=counter-0-7)', () => {
  it('5-game match: home wins 3 (away pocketed 4, 2, 1), away wins 2 (home pocketed 6, 3)', () => {
    const games = [
      game(HOME, null, 4),  // home wins, away pockets 4
      game(HOME, null, 2),  // home wins, away pockets 2
      game(HOME, null, 1),  // home wins, away pockets 1
      game(AWAY, null, 6),  // away wins, home pockets 6
      game(AWAY, null, 3),  // away wins, home pockets 3
    ];
    // home: 3 wins × 10 + 2 losses with home pocketing 6 + 3 = 30 + 9 = 39
    expect(compute(games, HOME)).toBe(39);
    // away: 2 wins × 10 + 3 losses with away pocketing 4 + 2 + 1 = 20 + 7 = 27
    expect(compute(games, AWAY)).toBe(27);
  });

  it('runs the table: home wins all 5 (away pockets 0 each)', () => {
    const games = Array(5).fill(0).map(() => game(HOME, null, 0));
    expect(compute(games, HOME)).toBe(50); // 5 × 10
    expect(compute(games, AWAY)).toBe(0); // 5 × 0 (clamped at min)
  });

  it('home wins all 5, away pockets 7 each (max for the loser)', () => {
    const games = Array(5).fill(0).map(() => game(HOME, null, 7));
    expect(compute(games, HOME)).toBe(50); // 5 × 10
    expect(compute(games, AWAY)).toBe(35); // 5 × 7
  });

  it('empty games array → 0 for both teams', () => {
    expect(compute([], HOME)).toBe(0);
    expect(compute([], AWAY)).toBe(0);
  });
});

describe('accumulated_per_game — counter clamping', () => {
  it('loser_score above max is clamped to max', () => {
    const games = [game(HOME, null, 99)]; // away "pocketed" 99 — clamp to 7
    expect(compute(games, AWAY)).toBe(7);
  });

  it('loser_score below min is clamped to min', () => {
    const games = [game(HOME, null, -5)]; // away "pocketed" -5 — clamp to 0
    expect(compute(games, AWAY)).toBe(0);
  });

  it('loser_score is null → counter falls back to min', () => {
    const games = [game(HOME, null, null)];
    // Fargo 10-7: loser counter min=0 → 0 contribution
    expect(compute(games, AWAY)).toBe(0);
  });

  it('loser_score is NaN → counter falls back to min', () => {
    const games = [game(HOME, null, NaN)];
    expect(compute(games, AWAY)).toBe(0);
  });

  it('clamping works with non-default min (e.g., min=2)', () => {
    const params: AccumulatedPerGameParams = {
      winner: { kind: 'fixed', points: 10 },
      loser: { kind: 'counter', min: 2, max: 7, label: 'Balls' },
    };
    const games = [
      game(HOME, null, 0), // clamp 0 → 2
      game(HOME, null, 5), // 5 unchanged
      game(HOME, null, 10), // clamp 10 → 7
    ];
    // away: 2 + 5 + 7 = 14
    expect(compute(games, AWAY, params)).toBe(14);
  });
});

describe('accumulated_per_game — winner=counter configurations (forward extension)', () => {
  it('winner=counter range 0-14, loser=fixed-0: scorer enters racks won by winner', () => {
    const params: AccumulatedPerGameParams = {
      winner: { kind: 'counter', min: 0, max: 14, label: 'Racks won' },
      loser: { kind: 'fixed', points: 0 },
    };
    const games = [
      game(HOME, 7, null),  // home wins with winner_score=7 (e.g., 7 racks)
      game(HOME, 4, null),  // home wins with winner_score=4
      game(AWAY, 5, null),  // away wins with winner_score=5
    ];
    // home: 7 + 4 + 0 (one loss, fixed-0) = 11
    expect(compute(games, HOME, params)).toBe(11);
    // away: 0 + 0 + 5 = 5
    expect(compute(games, AWAY, params)).toBe(5);
  });

  it('winner=counter null score → falls back to min', () => {
    const params: AccumulatedPerGameParams = {
      winner: { kind: 'counter', min: 0, max: 10, label: 'Racks' },
      loser: { kind: 'fixed', points: 0 },
    };
    const games = [game(HOME, null, null)]; // home wins but winner_score is null
    expect(compute(games, HOME, params)).toBe(0); // clamped to min
  });
});

describe('accumulated_per_game — both sides fixed (no counter inputs)', () => {
  it('winner=fixed-3, loser=fixed-1 (e.g., a "win is worth 3, loss worth 1" league)', () => {
    const params: AccumulatedPerGameParams = {
      winner: { kind: 'fixed', points: 3 },
      loser: { kind: 'fixed', points: 1 },
    };
    const games = [
      game(HOME),
      game(HOME),
      game(AWAY),
      game(AWAY),
      game(AWAY),
    ];
    // home: 2 wins × 3 + 3 losses × 1 = 6 + 3 = 9
    expect(compute(games, HOME, params)).toBe(9);
    // away: 3 wins × 3 + 2 losses × 1 = 9 + 2 = 11
    expect(compute(games, AWAY, params)).toBe(11);
  });
});

describe('accumulated_per_game — game filtering behavior', () => {
  it('skips games with null winner_team_id (incomplete games)', () => {
    const games = [
      game(HOME, null, 4),
      game(null, null, null), // incomplete
      game(AWAY, null, 6),
    ];
    // home: 1 win × 10 + 1 loss with home pocketing 6 = 10 + 6 = 16
    expect(compute(games, HOME)).toBe(16);
  });

  it('does NOT internally filter is_tiebreaker — caller decides what to pass', () => {
    const games = [
      game(HOME, null, 4, false), // regular game
      game(HOME, null, 0, true),  // tiebreaker game (caller chose to include)
    ];
    // home: 2 wins × 10 = 20 (calculator treats tiebreaker the same)
    expect(compute(games, HOME)).toBe(20);
    expect(compute(games, AWAY)).toBe(4);
  });

  it('a team that participated in zero games (winner only) gets only loser contributions', () => {
    const games = [
      game(HOME, null, 4),
      game(HOME, null, 7),
    ];
    // away never won — 2 losses with away pocketing 4 + 7 = 11
    expect(compute(games, AWAY)).toBe(11);
  });
});

describe('accumulated_per_game — defensive behavior', () => {
  it('falls back to default params when params fail zod validation', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const games = [game(HOME, null, 5)];
    const result = accumulatedPerGame.compute(
      { games, teamId: HOME },
      { winner: 'wat', loser: { kind: 'fixed', points: 0 } } as unknown as AccumulatedPerGameParams,
    );
    // Falls back to Fargo 10-7 defaults: home wins → 10
    expect(result).toBe(10);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('handles a fully malformed params object via fallback (warns)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const games = [game(AWAY, null, 5)];
    // Use a non-empty object with the wrong shape — empty `{}` and
    // `null` are treated as "no params, use defaults silently" per the
    // wizard's common-case write pattern; only structurally-wrong
    // params trigger the warn.
    const result = accumulatedPerGame.compute(
      { games, teamId: HOME },
      { winner: 'invalid_shape', loser: 'also_invalid' } as unknown as AccumulatedPerGameParams,
    );
    // Falls back to Fargo 10-7 defaults: home loses, home pocketed 5 → clamp [0,7] → 5.
    expect(result).toBe(5);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('treats empty params object as "use defaults" silently (no warn)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const games = [game(HOME), game(HOME), game(AWAY, null, 4)];
    const result = accumulatedPerGame.compute(
      { games, teamId: HOME },
      {} as AccumulatedPerGameParams,
    );
    // Fargo 10-7 defaults: 2 wins × 10 + 0 losses → 20 (HOME's 1 loss has loser_score=null so 0).
    // Wait — game 3: AWAY won, loser_score=4. HOME is the loser, scored 4. So HOME total: 2 wins × 10 (from games 1+2) + 4 balls (from game 3) = 24.
    expect(result).toBe(24);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('accumulated_per_game — characterization equivalence with legacy fargo5v5 logic', () => {
  // The legacy fargo5v5 computeMatchResult uses:
  //   winner_points = 10 (default), loser_points = balls_pocketed (clamped 0-7)
  // The new calculator's Fargo 10-7 default reproduces this exactly.
  // Phase 5 Unit 5.5 will replace fargo5v5's god-function with composition
  // through this calculator + the threshold and winner-determination strategies.
  // For now, this test set proves the per-game accumulation is identical.

  const cases: Array<{ label: string; games: ReturnType<typeof game>[]; team: string; expected: number }> = [
    {
      label: '25-game Fargo SRR: home wins 17, away pockets [0..7] alternating',
      games: [
        ...Array(17).fill(0).map((_, i) => game(HOME, null, i % 8)),
        ...Array(8).fill(0).map((_, i) => game(AWAY, null, (i + 1) % 8)),
      ],
      team: HOME,
      // home: 17 wins × 10 + 8 losses with home_pockets in [1..8 mod 8 = 1,2,3,4,5,6,7,0]
      //   home losses: 1+2+3+4+5+6+7+0 = 28
      // total: 170 + 28 = 198
      expected: 198,
    },
    {
      label: 'Even match: 12-12 with various ball counts',
      games: [
        ...Array(12).fill(0).map(() => game(HOME, null, 3)),
        ...Array(12).fill(0).map(() => game(AWAY, null, 4)),
      ],
      team: HOME,
      // home: 12×10 + 12×4 (home pockets when away wins) = 120 + 48 = 168
      expected: 168,
    },
    {
      label: 'Even match (same): away total',
      games: [
        ...Array(12).fill(0).map(() => game(HOME, null, 3)),
        ...Array(12).fill(0).map(() => game(AWAY, null, 4)),
      ],
      team: AWAY,
      // away: 12×10 + 12×3 = 120 + 36 = 156
      expected: 156,
    },
  ];

  for (const c of cases) {
    it(`${c.label} → ${c.expected}`, () => {
      expect(compute(c.games, c.team)).toBe(c.expected);
    });
  }
});
