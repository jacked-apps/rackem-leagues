/**
 * @fileoverview Pairings Generator — Module characterization tests.
 *
 * Locks the byte-for-byte output of today's round-robin algorithm for
 * the two shipped combos (3v3 DRR = 18 games, 5v5 SRR = 25 games), plus
 * the smaller R8-justified cross-combo (4v4 DRR), the 50-game DRR
 * exercise (5v5 DRR), the precondition guard, and the output-shape
 * contract.
 *
 * The `EXPECTED_3V3_DRR_SEQUENCE` fixture is the byte-for-byte
 * regression guard inherited from `src/utils/gameOrder.ts:GAME_ORDER_3V3`
 * before that constant gets deleted in Unit 8. Field names are adapted
 * to the new `GameSlot` shape (homePlayerPosition → homePosition, etc.)
 * and synthetic player_ids are added.
 *
 * @see ../index.ts — the Module under test
 * @see docs/plans/2026-05-25-001-refactor-pairings-generator-extraction-plan.md — Unit 6 spec
 */

import { describe, expect, it } from 'vitest';
import { generatePairings } from '..';
import type { GameSlot, PairingsInput } from '..';

// ---------------------------------------------------------------------------
// Synthetic lineups for characterization fixtures
// ---------------------------------------------------------------------------

const HOME_3V3 = ['home-p1', 'home-p2', 'home-p3'] as const;
const AWAY_3V3 = ['away-p1', 'away-p2', 'away-p3'] as const;

const HOME_4V4 = ['home-p1', 'home-p2', 'home-p3', 'home-p4'] as const;
const AWAY_4V4 = ['away-p1', 'away-p2', 'away-p3', 'away-p4'] as const;

const HOME_5V5 = [
  'home-p1',
  'home-p2',
  'home-p3',
  'home-p4',
  'home-p5',
] as const;
const AWAY_5V5 = [
  'away-p1',
  'away-p2',
  'away-p3',
  'away-p4',
  'away-p5',
] as const;

/**
 * The 18-entry expected output for 3v3 DRR with the synthetic lineups
 * above. Inlined byte-for-byte from `src/utils/gameOrder.ts:GAME_ORDER_3V3`
 * (lines 35-65), adapted to the new `GameSlot` shape: positions retain
 * their numeric values, actions retain their literals, and player_ids
 * are resolved from `HOME_3V3` / `AWAY_3V3` by position.
 *
 * **Do not edit casually** — this is the byte-for-byte regression guard.
 * If a test fails because of this fixture, the new Module's algorithm
 * has drifted from the shipped one. Fix the algorithm, not the fixture.
 */
const EXPECTED_3V3_DRR_SEQUENCE: GameSlot[] = [
  // Round 0: home breaks (P1,P2,P3 vs P1,P2,P3)
  { gameNumber: 1,  homePlayerId: 'home-p1', awayPlayerId: 'away-p1', homePosition: 1, awayPosition: 1, homeAction: 'breaks', awayAction: 'racks' },
  { gameNumber: 2,  homePlayerId: 'home-p2', awayPlayerId: 'away-p2', homePosition: 2, awayPosition: 2, homeAction: 'breaks', awayAction: 'racks' },
  { gameNumber: 3,  homePlayerId: 'home-p3', awayPlayerId: 'away-p3', homePosition: 3, awayPosition: 3, homeAction: 'breaks', awayAction: 'racks' },
  // Round 1: home racks (P1,P2,P3 vs P2,P3,P1)
  { gameNumber: 4,  homePlayerId: 'home-p1', awayPlayerId: 'away-p2', homePosition: 1, awayPosition: 2, homeAction: 'racks',  awayAction: 'breaks' },
  { gameNumber: 5,  homePlayerId: 'home-p2', awayPlayerId: 'away-p3', homePosition: 2, awayPosition: 3, homeAction: 'racks',  awayAction: 'breaks' },
  { gameNumber: 6,  homePlayerId: 'home-p3', awayPlayerId: 'away-p1', homePosition: 3, awayPosition: 1, homeAction: 'racks',  awayAction: 'breaks' },
  // Round 2: home breaks (P1,P2,P3 vs P3,P1,P2)
  { gameNumber: 7,  homePlayerId: 'home-p1', awayPlayerId: 'away-p3', homePosition: 1, awayPosition: 3, homeAction: 'breaks', awayAction: 'racks' },
  { gameNumber: 8,  homePlayerId: 'home-p2', awayPlayerId: 'away-p1', homePosition: 2, awayPosition: 1, homeAction: 'breaks', awayAction: 'racks' },
  { gameNumber: 9,  homePlayerId: 'home-p3', awayPlayerId: 'away-p2', homePosition: 3, awayPosition: 2, homeAction: 'breaks', awayAction: 'racks' },
  // Round 3 (DRR pass 2 starts): home racks
  { gameNumber: 10, homePlayerId: 'home-p1', awayPlayerId: 'away-p1', homePosition: 1, awayPosition: 1, homeAction: 'racks',  awayAction: 'breaks' },
  { gameNumber: 11, homePlayerId: 'home-p2', awayPlayerId: 'away-p2', homePosition: 2, awayPosition: 2, homeAction: 'racks',  awayAction: 'breaks' },
  { gameNumber: 12, homePlayerId: 'home-p3', awayPlayerId: 'away-p3', homePosition: 3, awayPosition: 3, homeAction: 'racks',  awayAction: 'breaks' },
  // Round 4: home breaks
  { gameNumber: 13, homePlayerId: 'home-p1', awayPlayerId: 'away-p2', homePosition: 1, awayPosition: 2, homeAction: 'breaks', awayAction: 'racks' },
  { gameNumber: 14, homePlayerId: 'home-p2', awayPlayerId: 'away-p3', homePosition: 2, awayPosition: 3, homeAction: 'breaks', awayAction: 'racks' },
  { gameNumber: 15, homePlayerId: 'home-p3', awayPlayerId: 'away-p1', homePosition: 3, awayPosition: 1, homeAction: 'breaks', awayAction: 'racks' },
  // Round 5: home racks
  { gameNumber: 16, homePlayerId: 'home-p1', awayPlayerId: 'away-p3', homePosition: 1, awayPosition: 3, homeAction: 'racks',  awayAction: 'breaks' },
  { gameNumber: 17, homePlayerId: 'home-p2', awayPlayerId: 'away-p1', homePosition: 2, awayPosition: 1, homeAction: 'racks',  awayAction: 'breaks' },
  { gameNumber: 18, homePlayerId: 'home-p3', awayPlayerId: 'away-p2', homePosition: 3, awayPosition: 2, homeAction: 'racks',  awayAction: 'breaks' },
];

// Helper: build a coverage count grid for asserting every (homePos, awayPos)
// pair appears the expected number of times in the output.
function buildCoverageGrid(slots: GameSlot[], lineupSize: number): number[][] {
  const grid = Array.from({ length: lineupSize }, () =>
    Array(lineupSize).fill(0),
  );
  for (const s of slots) {
    grid[s.homePosition - 1][s.awayPosition - 1] += 1;
  }
  return grid;
}

// ---------------------------------------------------------------------------
// 3v3 DRR — characterization (load-bearing regression test)
// ---------------------------------------------------------------------------

describe('generatePairings — 3v3 DRR characterization (the shipped combo)', () => {
  const slots = generatePairings({
    lineupSize: 3,
    gameGeneration: 'double_round_robin',
    homeLineup: [...HOME_3V3],
    awayLineup: [...AWAY_3V3],
  });

  it('produces exactly 18 slots', () => {
    expect(slots).toHaveLength(18);
  });

  it('matches EXPECTED_3V3_DRR_SEQUENCE element-by-element (byte-for-byte regression guard)', () => {
    expect(slots).toEqual(EXPECTED_3V3_DRR_SEQUENCE);
  });
});

// ---------------------------------------------------------------------------
// 5v5 SRR — characterization (the other shipped combo)
// ---------------------------------------------------------------------------

describe('generatePairings — 5v5 SRR characterization (the other shipped combo)', () => {
  const slots = generatePairings({
    lineupSize: 5,
    gameGeneration: 'single_round_robin',
    homeLineup: [...HOME_5V5],
    awayLineup: [...AWAY_5V5],
  });

  it('produces exactly 25 slots', () => {
    expect(slots).toHaveLength(25);
  });

  it('every (homePos, awayPos) pair appears exactly once', () => {
    const grid = buildCoverageGrid(slots, 5);
    for (let h = 0; h < 5; h += 1) {
      for (let a = 0; a < 5; a += 1) {
        expect(grid[h][a]).toBe(1);
      }
    }
  });

  it('first game of each round follows per-round alternation', () => {
    // 5 rounds of 5 games. Round 0,2,4 → home breaks; Round 1,3 → home racks.
    expect(slots[0].homeAction).toBe('breaks'); // game 1, round 0
    expect(slots[5].homeAction).toBe('racks');  // game 6, round 1
    expect(slots[10].homeAction).toBe('breaks'); // game 11, round 2
    expect(slots[15].homeAction).toBe('racks'); // game 16, round 3
    expect(slots[20].homeAction).toBe('breaks'); // game 21, round 4
  });

  it('25 is odd — ties impossible at this combo level', () => {
    expect(slots.length % 2).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 4v4 DRR — even-lineup-size cross-combo (locks R8 reword + outer-loop factoring)
// ---------------------------------------------------------------------------

describe('generatePairings — 4v4 DRR cross-combo (locks R8 reword)', () => {
  const slots = generatePairings({
    lineupSize: 4,
    gameGeneration: 'double_round_robin',
    homeLineup: [...HOME_4V4],
    awayLineup: [...AWAY_4V4],
  });

  it('produces exactly 32 slots', () => {
    expect(slots).toHaveLength(32);
  });

  it('every (homePos, awayPos) pair appears exactly twice (DRR)', () => {
    const grid = buildCoverageGrid(slots, 4);
    for (let h = 0; h < 4; h += 1) {
      for (let a = 0; a < 4; a += 1) {
        expect(grid[h][a]).toBe(2);
      }
    }
  });

  it('per-round alternation holds across all 8 rounds (R8 reword: per-round, NOT per-pair-across-passes)', () => {
    // 8 rounds × 4 games each. Round 0,2,4,6 → home breaks; 1,3,5,7 → home racks.
    for (let round = 0; round < 8; round += 1) {
      const firstOfRound = slots[round * 4];
      const expectedAction = round % 2 === 0 ? 'breaks' : 'racks';
      expect(firstOfRound.homeAction).toBe(expectedAction);
    }
  });

  it('pair (P1, P1) appears in round 0 AND round 4 with SAME break side (even-size DRR anomaly)', () => {
    // This is the even-lineup-size behavior R8 calls out: pair (1,1) shows up at
    // round 0 (game 1) and round 4 (game 17). Both rounds are even → both have
    // home breaking. The "swap between passes" intuition does NOT apply for
    // even sizes; only per-round alternation holds.
    expect(slots[0]).toMatchObject({
      gameNumber: 1,
      homePosition: 1,
      awayPosition: 1,
      homeAction: 'breaks',
    });
    expect(slots[16]).toMatchObject({
      gameNumber: 17,
      homePosition: 1,
      awayPosition: 1,
      homeAction: 'breaks',
    });
  });

  it('spot-check specific game ordering (locks position rotation)', () => {
    // Round 0 cycle: (1,1)(2,2)(3,3)(4,4)
    expect(slots[3]).toMatchObject({ gameNumber: 4, homePosition: 4, awayPosition: 4 });
    // Round 1 cycle (offset 1): (1,2)(2,3)(3,4)(4,1)
    expect(slots[4]).toMatchObject({ gameNumber: 5, homePosition: 1, awayPosition: 2, homeAction: 'racks' });
    expect(slots[7]).toMatchObject({ gameNumber: 8, homePosition: 4, awayPosition: 1, homeAction: 'racks' });
    // Round 7 (last): (1,4)(2,1)(3,2)(4,3)
    expect(slots[31]).toMatchObject({ gameNumber: 32, homePosition: 4, awayPosition: 3, homeAction: 'racks' });
  });
});

// ---------------------------------------------------------------------------
// 5v5 DRR — largest persistable DRR matrix
// ---------------------------------------------------------------------------

describe('generatePairings — 5v5 DRR (50 games, ties possible at 25-25)', () => {
  const slots = generatePairings({
    lineupSize: 5,
    gameGeneration: 'double_round_robin',
    homeLineup: [...HOME_5V5],
    awayLineup: [...AWAY_5V5],
  });

  it('produces exactly 50 slots', () => {
    expect(slots).toHaveLength(50);
  });

  it('every (homePos, awayPos) pair appears exactly twice', () => {
    const grid = buildCoverageGrid(slots, 5);
    for (let h = 0; h < 5; h += 1) {
      for (let a = 0; a < 5; a += 1) {
        expect(grid[h][a]).toBe(2);
      }
    }
  });

  it('odd-lineup-size: pair (P1, P1) appears in round 0 AND round 5 with OPPOSITE break sides', () => {
    // Round 0 → home breaks; round 5 → home racks (5%2=1). For odd lineup
    // sizes the "swap between passes" intuition incidentally holds.
    expect(slots[0]).toMatchObject({ gameNumber: 1, homePosition: 1, awayPosition: 1, homeAction: 'breaks' });
    expect(slots[25]).toMatchObject({ gameNumber: 26, homePosition: 1, awayPosition: 1, homeAction: 'racks' });
  });
});

// ---------------------------------------------------------------------------
// Precondition tests
// ---------------------------------------------------------------------------

describe('generatePairings — preconditions', () => {
  const validInput: PairingsInput = {
    lineupSize: 3,
    gameGeneration: 'double_round_robin',
    homeLineup: [...HOME_3V3],
    awayLineup: [...AWAY_3V3],
  };

  it('does NOT throw on valid input', () => {
    expect(() => generatePairings(validInput)).not.toThrow();
  });

  it.each([0, -1, -100])('throws when lineupSize is non-positive (%i)', (size) => {
    expect(() =>
      generatePairings({
        lineupSize: size,
        gameGeneration: 'double_round_robin',
        homeLineup: [],
        awayLineup: [],
      }),
    ).toThrow(/lineupSize must be a positive integer/);
  });

  it('throws when lineupSize is a non-integer number', () => {
    expect(() =>
      generatePairings({
        lineupSize: 2.5,
        gameGeneration: 'double_round_robin',
        homeLineup: ['a', 'b'],
        awayLineup: ['c', 'd'],
      }),
    ).toThrow(/lineupSize must be a positive integer/);
  });

  it('throws when lineupSize is not a number type at all (defensive)', () => {
    expect(() =>
      generatePairings({
        ...validInput,
        // Force the runtime check to fire even though TS would normally catch this.
        lineupSize: '3' as unknown as number,
      }),
    ).toThrow(/lineupSize must be a positive integer/);
  });

  it('throws on unknown gameGeneration value', () => {
    expect(() =>
      generatePairings({
        ...validInput,
        gameGeneration: 'unknown' as unknown as PairingsInput['gameGeneration'],
      }),
    ).toThrow(/gameGeneration must be /);
  });

  it('throws when homeLineup.length !== lineupSize', () => {
    expect(() =>
      generatePairings({
        ...validInput,
        homeLineup: ['only-one-player'],
      }),
    ).toThrow(/homeLineup\.length \(1\) must equal lineupSize \(3\)/);
  });

  it('throws when awayLineup.length !== lineupSize', () => {
    expect(() =>
      generatePairings({
        ...validInput,
        awayLineup: ['only-one-player'],
      }),
    ).toThrow(/awayLineup\.length \(1\) must equal lineupSize \(3\)/);
  });
});

// ---------------------------------------------------------------------------
// Output-shape contract + roundIndex-strip
// ---------------------------------------------------------------------------

describe('generatePairings — output shape contract', () => {
  const slots = generatePairings({
    lineupSize: 3,
    gameGeneration: 'double_round_robin',
    homeLineup: [...HOME_3V3],
    awayLineup: [...AWAY_3V3],
  });

  it('every slot exposes exactly the 7 GameSlot fields (no roundIndex leak)', () => {
    const expectedKeys = [
      'gameNumber',
      'homePlayerId',
      'awayPlayerId',
      'homePosition',
      'awayPosition',
      'homeAction',
      'awayAction',
    ].sort();
    for (const slot of slots) {
      expect(Object.keys(slot).sort()).toEqual(expectedKeys);
    }
  });

  it('no slot has a roundIndex property', () => {
    for (const slot of slots) {
      expect(slot).not.toHaveProperty('roundIndex');
    }
  });

  it('homePlayerId always equals homeLineup[homePosition - 1]', () => {
    for (const slot of slots) {
      expect(slot.homePlayerId).toBe(HOME_3V3[slot.homePosition - 1]);
    }
  });

  it('awayPlayerId always equals awayLineup[awayPosition - 1]', () => {
    for (const slot of slots) {
      expect(slot.awayPlayerId).toBe(AWAY_3V3[slot.awayPosition - 1]);
    }
  });

  it('homeAction and awayAction are always opposites (one breaks, one racks)', () => {
    for (const slot of slots) {
      if (slot.homeAction === 'breaks') {
        expect(slot.awayAction).toBe('racks');
      } else {
        expect(slot.awayAction).toBe('breaks');
      }
    }
  });

  it('gameNumber is 1..N sequential with no gaps', () => {
    const numbers = slots.map((s) => s.gameNumber);
    expect(numbers).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
    ]);
  });
});
