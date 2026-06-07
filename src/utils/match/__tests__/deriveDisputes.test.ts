/**
 * @fileoverview Tests for the dispute derivation helper (many-eyes Amendment F).
 *
 * Pins the two correctness rules:
 *  - A cleared game is in DISPUTE only when 2+ disagreeing initiators exist in
 *    the CURRENT window (between the latest two vacate markers).
 *  - A cleared game without that disagreement (e.g. a normal deny-pending-
 *    rescore) is NOT a dispute.
 */

import { describe, it, expect } from 'vitest';
import {
  deriveDisputes,
  type GameForDispute,
} from '../deriveDisputes';
import type { ConfirmationWithResult } from '../deriveDissents';

const HOME_TEAM = 'home-team';
const AWAY_TEAM = 'away-team';
const PLAYER_X = 'player-x';
const PLAYER_Y = 'player-y';
const PLAYER_Z = 'player-z';
const MEMBER_A = 'member-a';
const MEMBER_B = 'member-b';
const MEMBER_C = 'member-c';
const GAME_ID = 'g1';

function clearedGame(overrides: Partial<GameForDispute> = {}): GameForDispute {
  return {
    game_id: GAME_ID,
    game_number: 1,
    hasWinner: false,
    ...overrides,
  };
}

function confirm(overrides: Partial<ConfirmationWithResult>): ConfirmationWithResult {
  return {
    game_id: GAME_ID,
    confirmer_id: MEMBER_A,
    side: 'home',
    action: 'confirm',
    is_initiator: false,
    created_at: '2026-05-26T12:00:00.000Z',
    winner_team_id: HOME_TEAM,
    winner_player_id: PLAYER_X,
    break_and_run: false,
    golden_break: false,
    break_fouled: false,
    runout: false,
    win_by_forfeit: false,
    winner_value: null,
    loser_value: null,
    ...overrides,
  };
}

describe('deriveDisputes — happy path / no dispute', () => {
  it('returns empty when the game still has a winner (not cleared)', () => {
    expect(
      deriveDisputes(
        [clearedGame({ hasWinner: true })],
        [confirm({ is_initiator: true, confirmer_id: MEMBER_A })]
      )
    ).toEqual([]);
  });

  it('returns empty when there is no vacate marker (game never cleared)', () => {
    expect(
      deriveDisputes(
        [clearedGame()],
        [confirm({ is_initiator: true, confirmer_id: MEMBER_A })]
      )
    ).toEqual([]);
  });

  it('returns empty for a normal vacate-pending-rescore (only one initiator pre-vacate)', () => {
    // The "normal vacate" pattern: A initiates → B confirms → someone denies →
    // vacate marker → game cleared, waiting for re-score.
    expect(
      deriveDisputes(
        [clearedGame()],
        [
          confirm({
            confirmer_id: MEMBER_A,
            side: 'home',
            is_initiator: true,
            created_at: '2026-05-26T12:00:00.000Z',
          }),
          confirm({
            confirmer_id: MEMBER_B,
            side: 'away',
            is_initiator: false,
            created_at: '2026-05-26T12:01:00.000Z',
          }),
          confirm({
            confirmer_id: MEMBER_A,
            action: 'vacate',
            created_at: '2026-05-26T12:02:00.000Z',
          }),
        ]
      )
    ).toEqual([]);
  });

  it('returns empty when multiple initiators all agree (no disagreement)', () => {
    // Two initiators on the same side, same result. Followed by a vacate
    // marker (deliberate deny). Cleared but not in dispute — they agreed.
    expect(
      deriveDisputes(
        [clearedGame()],
        [
          confirm({
            confirmer_id: MEMBER_A,
            is_initiator: true,
            created_at: '2026-05-26T12:00:00.000Z',
          }),
          confirm({
            confirmer_id: MEMBER_B,
            is_initiator: true,
            created_at: '2026-05-26T12:01:00.000Z',
          }),
          confirm({
            confirmer_id: MEMBER_A,
            action: 'vacate',
            created_at: '2026-05-26T12:02:00.000Z',
          }),
        ]
      )
    ).toEqual([]);
  });
});

describe('deriveDisputes — surfaces real disputes', () => {
  it('flags a fresh auto-clear: two initiators disagreed on the winner', () => {
    const out = deriveDisputes(
      [clearedGame()],
      [
        // A initiated with player X.
        confirm({
          confirmer_id: MEMBER_A,
          side: 'home',
          is_initiator: true,
          winner_player_id: PLAYER_X,
          winner_team_id: HOME_TEAM,
          created_at: '2026-05-26T12:00:00.000Z',
        }),
        // B initiated with player Y (race triggered Amendment D auto-clear).
        confirm({
          confirmer_id: MEMBER_B,
          side: 'away',
          is_initiator: true,
          winner_player_id: PLAYER_Y,
          winner_team_id: AWAY_TEAM,
          created_at: '2026-05-26T12:00:05.000Z',
        }),
        // The auto-clear's vacate marker.
        confirm({
          confirmer_id: MEMBER_B,
          action: 'vacate',
          created_at: '2026-05-26T12:00:06.000Z',
        }),
      ]
    );
    expect(out).toHaveLength(1);
    expect(out[0].initiations.map((i) => i.confirmer_id).sort()).toEqual([
      MEMBER_A,
      MEMBER_B,
    ]);
    // Both snapshots in the output for the modal's side-by-side comparison.
    const winners = out[0].initiations.map((i) => i.snapshot.winner_player_id).sort();
    expect(winners).toEqual([PLAYER_X, PLAYER_Y]);
  });

  it('flags same-side initiator disagreement (two home members both filled, different results)', () => {
    const out = deriveDisputes(
      [clearedGame()],
      [
        confirm({
          confirmer_id: MEMBER_A,
          side: 'home',
          is_initiator: true,
          winner_player_id: PLAYER_X,
          break_and_run: true,
          created_at: '2026-05-26T12:00:00.000Z',
        }),
        confirm({
          confirmer_id: MEMBER_B,
          side: 'home',
          is_initiator: true,
          winner_player_id: PLAYER_X,
          // Same winner but different extra — counts as a disagreement.
          break_and_run: false,
          golden_break: true,
          created_at: '2026-05-26T12:00:03.000Z',
        }),
        confirm({
          confirmer_id: MEMBER_B,
          action: 'vacate',
          created_at: '2026-05-26T12:00:04.000Z',
        }),
      ]
    );
    expect(out).toHaveLength(1);
    expect(out[0].initiations).toHaveLength(2);
  });
});

describe('deriveDisputes — window scoping (multi-clear history)', () => {
  it('a resolved old dispute does NOT resurface on a new dispute', () => {
    // Timeline:
    //  T1: A initiates X.
    //  T2: B initiates Y → auto-clear → vacate-1.
    //  T3: C re-initiates Z successfully → game has winner Z. (Resolved.)
    //  ... game then gets cleared again (e.g. another auto-clear later)
    //  T4: D initiates with W → auto-clear → vacate-2.
    //
    // The CURRENT dispute window is between vacate-1 (T2) and vacate-2 (T4).
    // It contains C and D. Only THEY should appear in the dispute, not A/B
    // (their dispute was resolved at T3).
    const out = deriveDisputes(
      [clearedGame()],
      [
        confirm({
          confirmer_id: MEMBER_A,
          is_initiator: true,
          winner_player_id: PLAYER_X,
          created_at: '2026-05-26T12:00:00.000Z',
        }),
        confirm({
          confirmer_id: MEMBER_B,
          is_initiator: true,
          winner_player_id: PLAYER_Y,
          created_at: '2026-05-26T12:00:05.000Z',
        }),
        // vacate-1
        confirm({
          confirmer_id: MEMBER_B,
          action: 'vacate',
          created_at: '2026-05-26T12:00:06.000Z',
        }),
        // C re-initiates with Z — successful re-score (game has winner=Z for
        // a while).
        confirm({
          confirmer_id: MEMBER_C,
          is_initiator: true,
          winner_player_id: PLAYER_Z,
          created_at: '2026-05-26T12:01:00.000Z',
        }),
        // ... later D initiates with W (different) → auto-clear → vacate-2.
        confirm({
          confirmer_id: MEMBER_A, // same player as A but a new attempt
          is_initiator: true,
          winner_player_id: 'player-w',
          created_at: '2026-05-26T12:02:00.000Z',
        }),
        confirm({
          confirmer_id: MEMBER_A,
          action: 'vacate',
          created_at: '2026-05-26T12:02:01.000Z',
        }),
      ]
    );
    expect(out).toHaveLength(1);
    // The current dispute contains C and the re-attempting A — NOT the old
    // pre-resolution A and B.
    const winnersInWindow = out[0].initiations
      .map((i) => i.snapshot.winner_player_id)
      .sort();
    expect(winnersInWindow).toEqual(['player-w', PLAYER_Z]);
  });
});

describe('deriveDisputes — robustness', () => {
  it('skips initiator rows with no confirmer_id', () => {
    const out = deriveDisputes(
      [clearedGame()],
      [
        confirm({
          confirmer_id: null,
          is_initiator: true,
          winner_player_id: PLAYER_X,
          created_at: '2026-05-26T12:00:00.000Z',
        }),
        confirm({
          confirmer_id: MEMBER_B,
          is_initiator: true,
          winner_player_id: PLAYER_Y,
          created_at: '2026-05-26T12:00:05.000Z',
        }),
        confirm({
          confirmer_id: MEMBER_B,
          action: 'vacate',
          created_at: '2026-05-26T12:00:06.000Z',
        }),
      ]
    );
    // Only one valid initiator remains after filtering → no dispute (needs 2+).
    expect(out).toEqual([]);
  });

  it('processes multiple games independently', () => {
    const out = deriveDisputes(
      [
        clearedGame({ game_id: 'g1', game_number: 1 }),
        clearedGame({ game_id: 'g2', game_number: 2 }),
      ],
      [
        // g1 is a dispute (two disagreeing initiators).
        confirm({
          game_id: 'g1',
          confirmer_id: MEMBER_A,
          is_initiator: true,
          winner_player_id: PLAYER_X,
          created_at: '2026-05-26T12:00:00.000Z',
        }),
        confirm({
          game_id: 'g1',
          confirmer_id: MEMBER_B,
          is_initiator: true,
          winner_player_id: PLAYER_Y,
          created_at: '2026-05-26T12:00:05.000Z',
        }),
        confirm({
          game_id: 'g1',
          confirmer_id: MEMBER_B,
          action: 'vacate',
          created_at: '2026-05-26T12:00:06.000Z',
        }),
        // g2 is a normal vacate-pending-rescore (no dispute).
        confirm({
          game_id: 'g2',
          confirmer_id: MEMBER_C,
          is_initiator: true,
          winner_player_id: PLAYER_Z,
          created_at: '2026-05-26T12:00:00.000Z',
        }),
        confirm({
          game_id: 'g2',
          confirmer_id: MEMBER_C,
          action: 'vacate',
          created_at: '2026-05-26T12:00:01.000Z',
        }),
      ]
    );
    expect(out).toHaveLength(1);
    expect(out[0].game_id).toBe('g1');
  });
});
