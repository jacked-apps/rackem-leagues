/**
 * @fileoverview Tests for the dissent derivation helper (many-eyes Unit 5).
 *
 * Pins the two correctness rules that matter most:
 *  - Any-field difference is a dissent (not just the winner).
 *  - Pre-vacate vouches must NOT raise dissents against the post-rescore result
 *    (this prevents falsely naming people who agreed at the time).
 */

import { describe, it, expect } from 'vitest';
import {
  deriveDissents,
  type ConfirmationWithResult,
  type GameForDissent,
} from '../deriveDissents';

const HOME_TEAM = 'home-team';
const AWAY_TEAM = 'away-team';
const PLAYER_X = 'player-x';
const PLAYER_Y = 'player-y';
const MEMBER_A = 'member-a';
const MEMBER_B = 'member-b';
const MEMBER_C = 'member-c';
const GAME_ID = 'g1';

function gameOfficial(overrides: Partial<GameForDissent> = {}): GameForDissent {
  return {
    game_id: GAME_ID,
    game_number: 1,
    hasWinner: true,
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

function confirm(overrides: Partial<ConfirmationWithResult>): ConfirmationWithResult {
  return {
    game_id: GAME_ID,
    confirmer_id: MEMBER_A,
    side: 'away',
    action: 'confirm',
    created_at: '2026-05-25T12:00:00.000Z',
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

describe('deriveDissents — happy path / matching vouches', () => {
  it('returns empty when every confirm matches the official result', () => {
    expect(
      deriveDissents(
        [gameOfficial()],
        [
          confirm({ confirmer_id: MEMBER_A, side: 'home' }),
          confirm({ confirmer_id: MEMBER_B, side: 'away' }),
        ]
      )
    ).toEqual([]);
  });

  it('returns empty when a game has no winner yet', () => {
    expect(
      deriveDissents(
        [gameOfficial({ hasWinner: false, winner_player_id: null })],
        [confirm({})]
      )
    ).toEqual([]);
  });

  it('returns empty when there are no confirmations for a game', () => {
    expect(deriveDissents([gameOfficial()], [])).toEqual([]);
  });
});

describe('deriveDissents — any-field difference is a dissent', () => {
  it('different winner → flagged', () => {
    const out = deriveDissents(
      [gameOfficial()],
      [confirm({ confirmer_id: MEMBER_A, winner_player_id: PLAYER_Y, winner_team_id: AWAY_TEAM })]
    );
    expect(out).toHaveLength(1);
    expect(out[0].dissenters.map((d) => d.confirmer_id)).toEqual([MEMBER_A]);
  });

  it('same winner, different extra (golden_break) → flagged', () => {
    const out = deriveDissents(
      [gameOfficial({ break_and_run: true })],
      [confirm({ confirmer_id: MEMBER_A, break_and_run: false, golden_break: true })]
    );
    expect(out).toHaveLength(1);
    expect(out[0].dissenters[0].vouched.golden_break).toBe(true);
  });

  it('same winner + same extras, different points → flagged', () => {
    const out = deriveDissents(
      [gameOfficial({ winner_value: 7, loser_value: 3 })],
      [confirm({ confirmer_id: MEMBER_A, winner_value: 6, loser_value: 3 })]
    );
    expect(out).toHaveLength(1);
  });

  it('lists agreeing confirmers alongside dissenters', () => {
    const out = deriveDissents(
      [gameOfficial()],
      [
        confirm({ confirmer_id: MEMBER_A, side: 'home' }), // agrees
        confirm({ confirmer_id: MEMBER_B, side: 'away' }), // agrees
        confirm({ confirmer_id: MEMBER_C, side: 'away', winner_player_id: PLAYER_Y, winner_team_id: AWAY_TEAM }), // dissents
      ]
    );
    expect(out).toHaveLength(1);
    expect(out[0].dissenters.map((d) => d.confirmer_id)).toEqual([MEMBER_C]);
    expect(out[0].agreeingConfirmers.map((a) => a.confirmer_id).sort()).toEqual([
      MEMBER_A,
      MEMBER_B,
    ]);
  });
});

describe('deriveDissents — vacate marker scopes the comparison window', () => {
  it('confirms older than the latest vacate marker are ignored (no false dissent after rescore)', () => {
    const out = deriveDissents(
      [gameOfficial({ winner_player_id: PLAYER_X })], // new official after rescore
      [
        // Pre-vacate vouch for the OLD result (player Y) — must NOT flag.
        confirm({
          confirmer_id: MEMBER_A,
          created_at: '2026-05-25T11:00:00.000Z',
          winner_player_id: PLAYER_Y,
          winner_team_id: AWAY_TEAM,
        }),
        // Vacate marker (the rescore line).
        confirm({
          confirmer_id: MEMBER_B,
          action: 'vacate',
          created_at: '2026-05-25T11:30:00.000Z',
        }),
        // Post-rescore vouch that agrees → no dissent expected.
        confirm({
          confirmer_id: MEMBER_C,
          created_at: '2026-05-25T12:00:00.000Z',
        }),
      ]
    );
    expect(out).toEqual([]);
  });

  it('post-vacate dissent IS flagged (genuine differing vouch after the rescore)', () => {
    const out = deriveDissents(
      [gameOfficial({ winner_player_id: PLAYER_X })],
      [
        confirm({
          confirmer_id: MEMBER_A,
          action: 'vacate',
          created_at: '2026-05-25T11:00:00.000Z',
        }),
        // Post-rescore vouch that DIFFERS → flag this one.
        confirm({
          confirmer_id: MEMBER_B,
          created_at: '2026-05-25T12:00:00.000Z',
          winner_player_id: PLAYER_Y,
          winner_team_id: AWAY_TEAM,
        }),
      ]
    );
    expect(out).toHaveLength(1);
    expect(out[0].dissenters.map((d) => d.confirmer_id)).toEqual([MEMBER_B]);
  });
});

describe('deriveDissents — robustness', () => {
  it('skips malformed rows (missing confirmer_id, invalid side)', () => {
    const out = deriveDissents(
      [gameOfficial()],
      [
        confirm({ confirmer_id: null, winner_player_id: PLAYER_Y }), // skipped
        confirm({ confirmer_id: MEMBER_A, side: 'middle' }), // skipped
      ]
    );
    expect(out).toEqual([]);
  });

  it('processes multiple games independently', () => {
    const out = deriveDissents(
      [gameOfficial({ game_id: 'g1', game_number: 1 }), gameOfficial({ game_id: 'g2', game_number: 2 })],
      [
        // g1 dissent
        confirm({ game_id: 'g1', confirmer_id: MEMBER_A, winner_player_id: PLAYER_Y, winner_team_id: AWAY_TEAM }),
        // g2 agreement
        confirm({ game_id: 'g2', confirmer_id: MEMBER_B }),
      ]
    );
    expect(out).toHaveLength(1);
    expect(out[0].game_id).toBe('g1');
  });
});
