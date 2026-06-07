/**
 * @fileoverview Runtime safety-net tests for the per-game allocator slot
 * (Unit 4 of the Per-Game Allocator Room plan).
 *
 * These tests pin the **never-break contract** for the per-game allocator
 * path. Once the workshop ships, the allocator slot can hold rows authored
 * by any logged-in user; a bad row that slips past the editor's save-time
 * guard AND the loader's read-time validator must STILL be unable to break
 * live scoring. The runtime backstop is the last line of defense.
 *
 * The two ground rules from the foundational framing
 * (`docs/brainstorms/2026-06-04-scoring-system-workshop-building-requirements.md`):
 *
 *   1. The scoring page must render (handled at the React layer; the
 *      runtime's job is to not throw upward into it).
 *   2. Each game's W/L must be recorded. The W/L tick happens BEFORE the
 *      allocator runs in `runtime.ts`, so a thrown allocator cannot lose
 *      the tick. These tests assert that ordering stays correct.
 *
 * To produce a real throw inside `evaluateAllocator` without inventing
 * test-only fixtures, the tests use a range-base side configured with
 * `min: 0, max: 7` and pass `winnerCounterInput: null` for the games that
 * should fail. The existing `allocator-evaluator.ts` throws on
 * null/non-finite counter input for range bases — that is the same
 * failure shape a real workshop user might produce by writing a
 * variation expecting a scorer input that never arrives.
 */

import { describe, it, expect, vi } from 'vitest';
import { evaluatePointsSystem, type RuntimeGameRecord } from '../runtime';
import type { PointsSystem, ThresholdInputs } from '../types';

const emptyInputs: ThresholdInputs = {
  homeRatings: [],
  awayRatings: [],
  homeHandicapDiff: 0,
  awayHandicapDiff: 0,
  gameCount: 0,
  prefs: {},
};

/**
 * A composition whose winner side is a range-input. Passing a game with
 * `winnerCounterInput: null` triggers a real throw inside
 * `allocator-evaluator.ts` → that throw is what the runtime backstop catches.
 */
const composition: PointsSystem = {
  name: 'safety-net-test',
  thresholds: {},
  perGameAllocator: {
    name: 'range-winner',
    winner: {
      base: { min: 0, max: 7, label: 'Winner counter (unused in null case)' },
      formula: null,
    },
    loser: { base: 0, formula: null },
  },
  triggers: [],
};

function winsWithCounter(
  winner: 'home' | 'away',
  count: number,
): RuntimeGameRecord {
  return {
    winnerSide: winner,
    winnerCounterInput: count,
    loserCounterInput: null,
  };
}

function winsWithNullCounter(winner: 'home' | 'away'): RuntimeGameRecord {
  return { winnerSide: winner, winnerCounterInput: null, loserCounterInput: null };
}

describe('runtime — never-break contract around the per-game allocator', () => {
  it('catches an allocator throw on a single game, preserves W/L for that game and all surrounding ones', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 5 games. Game 3 (index 2) has a null counter → allocator throws.
    // The other four are valid range inputs.
    const games: RuntimeGameRecord[] = [
      winsWithCounter('home', 3),
      winsWithCounter('away', 5),
      winsWithNullCounter('home'), // → throws
      winsWithCounter('home', 7),
      winsWithCounter('away', 2),
    ];
    const result = evaluatePointsSystem(composition, emptyInputs, games);

    // W/L counts MUST reflect every game, including the failing one. This
    // is the sacred metric — even when the allocator crashed for that
    // game, the W/L tick happened above the catch.
    expect(result.home_wins).toBe(3);
    expect(result.away_wins).toBe(2);
    // 5 games happened.
    expect(result.games_played).toBe(5);
    // Points accumulate over the four successful games; game 3 is skipped.
    // home_points = 3 (game 1) + 7 (game 4) = 10
    // away_points = 5 (game 2) + 2 (game 5) = 7
    expect(result.home_points).toBe(10);
    expect(result.away_points).toBe(7);
    // The safety net logs the failure with composition name + game index.
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/allocator "range-winner" threw on game 2/),
    );
    warnSpy.mockRestore();
  });

  it('continues per-game loop and records every W/L even when the allocator throws on EVERY game', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const games: RuntimeGameRecord[] = [
      winsWithNullCounter('home'),
      winsWithNullCounter('away'),
      winsWithNullCounter('home'),
      winsWithNullCounter('home'),
      winsWithNullCounter('away'),
    ];
    const result = evaluatePointsSystem(composition, emptyInputs, games);

    // Sacred W/L preserved across all 5 throwing games.
    expect(result.home_wins).toBe(3);
    expect(result.away_wins).toBe(2);
    expect(result.games_played).toBe(5);
    // Points stayed at 0 — no game contributed, but no game blew up the
    // runtime either.
    expect(result.home_points).toBe(0);
    expect(result.away_points).toBe(0);
    // Warn once per game.
    expect(warnSpy).toHaveBeenCalledTimes(5);
    warnSpy.mockRestore();
  });

  it('does not throw under any sequence of allocator failures', () => {
    // A property-style assertion: no matter what mix of valid + invalid
    // games we feed it, the runtime returns a state bag without throwing.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const games: RuntimeGameRecord[] = [
      winsWithCounter('home', 2),
      winsWithNullCounter('away'),
      winsWithCounter('home', 7),
      winsWithNullCounter('home'),
      winsWithNullCounter('away'),
      winsWithCounter('away', 0),
    ];
    expect(() => evaluatePointsSystem(composition, emptyInputs, games)).not.toThrow();
    warnSpy.mockRestore();
  });

  it('allocator throw does not prevent the games_played increment that follows it', () => {
    // After the allocator call, the runtime increments games_played. The
    // backstop is structured so this still happens — important because
    // formulas / triggers downstream may key off games_played.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const games: RuntimeGameRecord[] = [
      winsWithNullCounter('home'),
      winsWithNullCounter('away'),
    ];
    const result = evaluatePointsSystem(composition, emptyInputs, games);
    expect(result.games_played).toBe(2);
    warnSpy.mockRestore();
  });
});
