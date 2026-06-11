/**
 * @fileoverview Tests for the pending-confirmation derivation
 * (live-scoring handoff stability).
 *
 * These pin the predicate that makes the confirm prompt self-heal from data:
 * a game needs MY confirmation iff a winner is set, the opponent confirmed,
 * and I have not. Everything else must NOT prompt me.
 */

import { describe, it, expect } from 'vitest';
import {
  gameNeedsMyConfirmation,
  buildConfirmationItem,
  gameHasPendingVacateForMe,
  buildVacateConfirmationItem,
  decidePendingAction,
  buildPersonalConfirmContext,
  type ConfirmationRowLike,
  type PersonalConfirmContext,
} from '../pendingConfirmations';
import type { MatchGame, Player } from '@/types';

const HOME = 'home-team';
const AWAY = 'away-team';

/** Minimal game row factory — only the fields the predicate/builder read. */
function game(overrides: Partial<MatchGame>): MatchGame {
  return {
    id: 'g1',
    game_number: 1,
    winner_team_id: null,
    winner_player_id: null,
    confirmed_by_home: false,
    confirmed_by_away: false,
    break_and_run: false,
    golden_break: false,
    break_fouled: false,
    runout: false,
    win_by_forfeit: false,
    winner_value: null,
    loser_value: null,
    vacate_requested_by: null,
    ...overrides,
  } as MatchGame;
}

describe('gameNeedsMyConfirmation', () => {
  it('away scored + away confirmed, home has not → home needs to confirm', () => {
    const g = game({
      winner_player_id: 'p1',
      confirmed_by_away: true as unknown as boolean,
      confirmed_by_home: false,
    });
    expect(gameNeedsMyConfirmation(g, HOME, HOME)).toBe(true);
  });

  it('home scored + home confirmed, away has not → away needs to confirm', () => {
    const g = game({
      winner_player_id: 'p1',
      confirmed_by_home: true as unknown as boolean,
      confirmed_by_away: false,
    });
    expect(gameNeedsMyConfirmation(g, AWAY, HOME)).toBe(true);
  });

  it('does NOT prompt the side that already scored/confirmed it', () => {
    const g = game({
      winner_player_id: 'p1',
      confirmed_by_away: true as unknown as boolean,
    });
    // away is the scorer here; away should not be prompted
    expect(gameNeedsMyConfirmation(g, AWAY, HOME)).toBe(false);
  });

  it('does NOT prompt when there is no winner yet', () => {
    const g = game({ winner_player_id: null, confirmed_by_away: true as unknown as boolean });
    expect(gameNeedsMyConfirmation(g, HOME, HOME)).toBe(false);
  });

  it('does NOT prompt when both sides already confirmed (official)', () => {
    const g = game({
      winner_player_id: 'p1',
      confirmed_by_home: true as unknown as boolean,
      confirmed_by_away: true as unknown as boolean,
    });
    expect(gameNeedsMyConfirmation(g, HOME, HOME)).toBe(false);
    expect(gameNeedsMyConfirmation(g, AWAY, HOME)).toBe(false);
  });

  it('does NOT prompt when the opponent has not confirmed yet (nothing to verify)', () => {
    // winner set but neither side has confirmed — not the handoff state
    const g = game({ winner_player_id: 'p1' });
    expect(gameNeedsMyConfirmation(g, HOME, HOME)).toBe(false);
    expect(gameNeedsMyConfirmation(g, AWAY, HOME)).toBe(false);
  });
});

describe('gameHasPendingVacateForMe', () => {
  it('opponent (away) requested vacate → home is prompted', () => {
    const g = game({ winner_player_id: 'p1', vacate_requested_by: 'away' });
    expect(gameHasPendingVacateForMe(g, HOME, HOME)).toBe(true);
  });

  it('opponent (home) requested vacate → away is prompted', () => {
    const g = game({ winner_player_id: 'p1', vacate_requested_by: 'home' });
    expect(gameHasPendingVacateForMe(g, AWAY, HOME)).toBe(true);
  });

  it('the requesting side is NOT prompted about its own request (survives refresh)', () => {
    const g = game({ winner_player_id: 'p1', vacate_requested_by: 'away' });
    // away asked — away must not be prompted, even with no local state to lean on
    expect(gameHasPendingVacateForMe(g, AWAY, HOME)).toBe(false);
  });

  it('no prompt when no vacate is pending', () => {
    const g = game({ winner_player_id: 'p1', vacate_requested_by: null });
    expect(gameHasPendingVacateForMe(g, HOME, HOME)).toBe(false);
  });

  it('no prompt when there is no winner to vacate', () => {
    const g = game({ winner_player_id: null, vacate_requested_by: 'away' });
    expect(gameHasPendingVacateForMe(g, HOME, HOME)).toBe(false);
  });
});

describe('decidePendingAction', () => {
  it('opponent scored, I have not confirmed, auto-confirm OFF → confirm', () => {
    const g = game({ winner_player_id: 'p1', confirmed_by_away: true as unknown as boolean });
    expect(decidePendingAction(g, HOME, HOME, false)).toBe('confirm');
  });

  it('same, auto-confirm ON → autoconfirm', () => {
    const g = game({ winner_player_id: 'p1', confirmed_by_away: true as unknown as boolean });
    expect(decidePendingAction(g, HOME, HOME, true)).toBe('autoconfirm');
  });

  it('opponent requested a vacate → vacate (takes precedence over auto-confirm)', () => {
    const g = game({ winner_player_id: 'p1', vacate_requested_by: 'away' });
    expect(decidePendingAction(g, HOME, HOME, true)).toBe('vacate');
    expect(decidePendingAction(g, HOME, HOME, false)).toBe('vacate');
  });

  it('nothing pending → none', () => {
    const g = game({ winner_player_id: null });
    expect(decidePendingAction(g, HOME, HOME, false)).toBe('none');
    expect(decidePendingAction(g, HOME, HOME, true)).toBe('none');
  });

  it('the scorer side is owed nothing on its own game → none', () => {
    const g = game({ winner_player_id: 'p1', confirmed_by_away: true as unknown as boolean });
    expect(decidePendingAction(g, AWAY, HOME, false)).toBe('none');
  });
});

// ── Many-eyes Unit 4: per-person prompt context ─────────────────────────────

const MEMBER_A = 'member-a';
const MEMBER_B = 'member-b';
const GAME_1_ID = 'g1';

function confirmRow(overrides: Partial<ConfirmationRowLike>): ConfirmationRowLike {
  return {
    game_id: GAME_1_ID,
    confirmer_id: MEMBER_A,
    side: 'home',
    action: 'confirm',
    is_initiator: false,
    created_at: '2026-05-25T12:00:00.000Z',
    ...overrides,
  };
}

describe('buildPersonalConfirmContext', () => {
  it('records games where MY member id has a confirm row', () => {
    const ctx = buildPersonalConfirmContext(
      [
        confirmRow({ game_id: 'g1', confirmer_id: MEMBER_A }),
        confirmRow({ game_id: 'g2', confirmer_id: MEMBER_B }),
        confirmRow({ game_id: 'g3', confirmer_id: MEMBER_A }),
      ],
      MEMBER_A
    );
    expect(ctx.myVouchedGameIds.has('g1')).toBe(true);
    expect(ctx.myVouchedGameIds.has('g2')).toBe(false);
    expect(ctx.myVouchedGameIds.has('g3')).toBe(true);
  });

  it('ignores vacate markers when counting personal vouches', () => {
    const ctx = buildPersonalConfirmContext(
      [confirmRow({ confirmer_id: MEMBER_A, action: 'vacate' })],
      MEMBER_A
    );
    expect(ctx.myVouchedGameIds.size).toBe(0);
  });

  it('records initiator sides explicitly (only rows with is_initiator=true)', () => {
    const ctx = buildPersonalConfirmContext(
      [
        // Home initiator — fills the details from scratch.
        confirmRow({ side: 'home', is_initiator: true }),
        // Away confirmer — just tapped Confirm; NOT an initiator.
        confirmRow({ side: 'away', is_initiator: false, created_at: '2026-05-25T12:05:00.000Z' }),
      ],
      MEMBER_A
    );
    const sides = ctx.initiatorSidesByGameId.get(GAME_1_ID);
    expect(sides).toBeDefined();
    expect(sides!.has('home')).toBe(true);
    expect(sides!.has('away')).toBe(false);
  });

  it('records BOTH sides as initiators when both have an is_initiator=true row (the cross-side race window)', () => {
    const ctx = buildPersonalConfirmContext(
      [
        confirmRow({ side: 'home', is_initiator: true }),
        confirmRow({ side: 'away', is_initiator: true, created_at: '2026-05-25T12:01:00.000Z' }),
      ],
      MEMBER_A
    );
    const sides = ctx.initiatorSidesByGameId.get(GAME_1_ID);
    expect(sides!.has('home')).toBe(true);
    expect(sides!.has('away')).toBe(true);
  });

  it('ignores vacate markers when deriving initiator sides', () => {
    const ctx = buildPersonalConfirmContext(
      [
        // A vacate marker — must not appear as an initiator side even if
        // is_initiator were somehow true.
        confirmRow({ side: 'home', action: 'vacate', is_initiator: true }),
        confirmRow({ side: 'away', is_initiator: true, created_at: '2026-05-25T12:00:00.000Z' }),
      ],
      MEMBER_A
    );
    const sides = ctx.initiatorSidesByGameId.get(GAME_1_ID);
    expect(sides!.has('home')).toBe(false);
    expect(sides!.has('away')).toBe(true);
  });

  it('a game with no initiator rows is absent from initiatorSidesByGameId (predicate falls back)', () => {
    // Confirm rows exist but none with is_initiator=true.
    const ctx = buildPersonalConfirmContext(
      [confirmRow({ side: 'home', is_initiator: false })],
      MEMBER_A
    );
    expect(ctx.initiatorSidesByGameId.has(GAME_1_ID)).toBe(false);
  });

  it('memberId === null produces an empty vouched set (safe default)', () => {
    const ctx = buildPersonalConfirmContext(
      [confirmRow({ confirmer_id: MEMBER_A, is_initiator: true })],
      null
    );
    expect(ctx.myVouchedGameIds.size).toBe(0);
    // Still derives the initiator side.
    expect(ctx.initiatorSidesByGameId.get(GAME_1_ID)!.has('home')).toBe(true);
  });
});

describe('gameNeedsMyConfirmation — per-person (Phase 2)', () => {
  function ctxFor(rows: Partial<ConfirmationRowLike>[]): PersonalConfirmContext {
    return buildPersonalConfirmContext(
      rows.map((r) => confirmRow(r)),
      MEMBER_A
    );
  }

  it('confirming-side viewer with no personal vouch → prompted', () => {
    const g = game({ id: GAME_1_ID, winner_player_id: 'p1' });
    // Home INITIATED; I'm on AWAY with no personal vouch → prompted.
    expect(
      gameNeedsMyConfirmation(
        g,
        AWAY,
        HOME,
        ctxFor([{ side: 'home', confirmer_id: MEMBER_B, is_initiator: true }])
      )
    ).toBe(true);
  });

  it('scoring-side viewer (extras come via Phase-3 tap-to-confirm) → NOT prompted', () => {
    const g = game({ id: GAME_1_ID, winner_player_id: 'p1' });
    // Home initiated; I'm on HOME — even without a personal vouch, no live prompt.
    expect(
      gameNeedsMyConfirmation(
        g,
        HOME,
        HOME,
        ctxFor([{ side: 'home', confirmer_id: MEMBER_B, is_initiator: true }])
      )
    ).toBe(false);
  });

  it('already personally vouched → NOT prompted (even if my side has extras pending)', () => {
    const g = game({ id: GAME_1_ID, winner_player_id: 'p1' });
    // Home initiated; I'm on AWAY and have already personally vouched (as a confirmer).
    expect(
      gameNeedsMyConfirmation(
        g,
        AWAY,
        HOME,
        ctxFor([
          { side: 'home', confirmer_id: MEMBER_B, is_initiator: true },
          { side: 'away', confirmer_id: MEMBER_A, is_initiator: false },
        ])
      )
    ).toBe(false);
  });

  it('extra witness: my side ALREADY confirmed (column set) but I personally have not → still prompted', () => {
    const g = game({
      id: GAME_1_ID,
      winner_player_id: 'p1',
      // Both columns set (game is official); ME personally still hasn't vouched.
      confirmed_by_home: true as unknown as boolean,
      confirmed_by_away: true as unknown as boolean,
    });
    expect(
      gameNeedsMyConfirmation(
        g,
        AWAY,
        HOME,
        ctxFor([
          { side: 'home', confirmer_id: MEMBER_B, is_initiator: true },
          // Some other away member confirmed; not me — they're a confirmer (extra), not initiator.
          { side: 'away', confirmer_id: 'other-away-member', is_initiator: false },
        ])
      )
    ).toBe(true);
  });

  it('no initiator rows yet (pre-Phase-1 game) → falls back to Layer-1 column logic', () => {
    const g = game({
      id: GAME_1_ID,
      winner_player_id: 'p1',
      confirmed_by_away: true as unknown as boolean, // opponent scored, mine empty
    });
    expect(gameNeedsMyConfirmation(g, HOME, HOME, ctxFor([]))).toBe(true);
  });

  it('cross-side race (BOTH sides initiated) → no prompt (dispute path takes over via Amendments D + F)', () => {
    const g = game({ id: GAME_1_ID, winner_player_id: 'p1' });
    const ctx = ctxFor([
      { side: 'home', confirmer_id: MEMBER_B, is_initiator: true },
      { side: 'away', confirmer_id: 'other', is_initiator: true },
    ]);
    // Neither side gets a live prompt in this state.
    expect(gameNeedsMyConfirmation(g, HOME, HOME, ctx)).toBe(false);
    expect(gameNeedsMyConfirmation(g, AWAY, HOME, ctx)).toBe(false);
  });

  it('same-side dual initiation (still only home has initiated) → opposite side still prompted', () => {
    const g = game({ id: GAME_1_ID, winner_player_id: 'p1' });
    // Two home initiators (race won by the second, but both rows in the log).
    const ctx = ctxFor([
      { side: 'home', confirmer_id: MEMBER_B, is_initiator: true },
      { side: 'home', confirmer_id: 'other-home', is_initiator: true, created_at: '2026-05-25T12:05:00.000Z' },
    ]);
    // Away viewer still gets prompted — only HOME has initiated.
    expect(gameNeedsMyConfirmation(g, AWAY, HOME, ctx)).toBe(true);
  });
});

describe('decidePendingAction — per-person', () => {
  it('vacate request still takes precedence over per-person context', () => {
    const g = game({ id: GAME_1_ID, winner_player_id: 'p1', vacate_requested_by: 'away' });
    const ctx = buildPersonalConfirmContext(
      [confirmRow({ side: 'home', confirmer_id: MEMBER_B, is_initiator: true })],
      MEMBER_A
    );
    expect(decidePendingAction(g, HOME, HOME, false, ctx)).toBe('vacate');
  });

  it('scoring-side viewer (with context) → none, regardless of autoConfirm', () => {
    const g = game({ id: GAME_1_ID, winner_player_id: 'p1' });
    const ctx = buildPersonalConfirmContext(
      [confirmRow({ side: 'home', confirmer_id: MEMBER_B, is_initiator: true })],
      MEMBER_A
    );
    expect(decidePendingAction(g, HOME, HOME, true, ctx)).toBe('none');
    expect(decidePendingAction(g, HOME, HOME, false, ctx)).toBe('none');
  });

  it('confirming-side viewer without personal vouch + autoConfirm ON → autoconfirm', () => {
    const g = game({ id: GAME_1_ID, winner_player_id: 'p1' });
    const ctx = buildPersonalConfirmContext(
      [confirmRow({ side: 'home', confirmer_id: MEMBER_B, is_initiator: true })],
      MEMBER_A
    );
    expect(decidePendingAction(g, AWAY, HOME, true, ctx)).toBe('autoconfirm');
  });
});

describe('buildVacateConfirmationItem', () => {
  const players: Map<string, Player> = new Map([
    ['p1', { id: 'p1', first_name: 'John', last_name: 'Doe', nickname: 'Johnny' }],
  ]);

  it('marks the item as a vacate request and carries the winner detail', () => {
    const g = game({ game_number: 3, winner_player_id: 'p1', vacate_requested_by: 'away' });
    const item = buildVacateConfirmationItem(g, players);
    expect(item.isVacateRequest).toBe(true);
    expect(item.gameNumber).toBe(3);
    expect(item.winnerPlayerName).toBe('Johnny');
  });
});

describe('buildConfirmationItem', () => {
  const players: Map<string, Player> = new Map([
    ['p1', { id: 'p1', first_name: 'John', last_name: 'Doe', nickname: 'Johnny' }],
  ]);

  it('forwards every scored field and resolves the winner nickname', () => {
    const g = game({
      game_number: 7,
      winner_player_id: 'p1',
      break_and_run: true,
      win_by_forfeit: false,
      winner_value: 10,
      loser_value: 4,
    });

    const item = buildConfirmationItem(g, players);
    expect(item).toMatchObject({
      gameNumber: 7,
      winnerPlayerName: 'Johnny',
      breakAndRun: true,
      winByForfeit: false,
      winnerValue: 10,
      loserValue: 4,
    });
  });
});
