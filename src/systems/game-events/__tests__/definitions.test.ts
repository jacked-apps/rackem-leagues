/**
 * @fileoverview Smoke tests for the 8 seed event definitions — invariant
 * checks (non-empty fields, unique names) plus per-event verification of
 * the Phase 1 enabledByDefault matrix (matches today's modal exactly).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearRegistry,
  listGameEvents,
  registerSeedGameEvents,
} from '../index';

describe('seed event definitions — invariants', () => {
  beforeEach(() => {
    clearRegistry();
    registerSeedGameEvents();
  });

  it('every seed definition has the required fields', () => {
    for (const event of listGameEvents()) {
      expect(event.name).toMatch(/^[a-z][a-z0-9_]*$/); // snake_case
      expect(event.label).not.toEqual('');
      expect(event.gameTypes.length).toBeGreaterThan(0);
      expect(['winner', 'loser', 'breaker', 'non-breaker', 'scheduled-breaker']).toContain(
        event.attributedTo,
      );
      // enabledByDefault has an entry for every game type.
      expect(event.enabledByDefault).toHaveProperty('eight_ball');
      expect(event.enabledByDefault).toHaveProperty('nine_ball');
      expect(event.enabledByDefault).toHaveProperty('ten_ball');
    }
  });

  it('no two seed definitions share a name', () => {
    const names = listGameEvents().map(e => e.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('mutuallyExclusiveWith references are symmetric and point to existing events', () => {
    const eventsByName = new Map(listGameEvents().map(e => [e.name, e]));

    for (const event of listGameEvents()) {
      for (const peerName of event.mutuallyExclusiveWith ?? []) {
        const peer = eventsByName.get(peerName);
        expect(peer, `${event.name} declares mutex with ${peerName} which is not registered`).toBeDefined();
        expect(
          peer?.mutuallyExclusiveWith ?? [],
          `${event.name} declares mutex with ${peerName} but ${peerName} does not declare mutex with ${event.name}`,
        ).toContain(event.name);
      }
    }
  });
});

describe('Phase 1 enabledByDefault matrix — zero user-visible behavior change', () => {
  beforeEach(() => {
    clearRegistry();
    registerSeedGameEvents();
  });

  // The 5 events that exist in today's modal must default to enabled
  // wherever today's modal renders them. Phase 1 ships zero behavior change.
  it('break_and_run defaults to true everywhere (today: rendered for all game types)', () => {
    const event = listGameEvents().find(e => e.name === 'break_and_run')!;
    expect(event.enabledByDefault.eight_ball).toBe(true);
    expect(event.enabledByDefault.nine_ball).toBe(true);
    expect(event.enabledByDefault.ten_ball).toBe(true);
  });

  it('golden_break defaults to FALSE everywhere (BCA Standard: 8-ball GB does NOT count)', () => {
    // Updated 2026-05-12: deprecating leagues.golden_break_counts_as_win
    // collapsed the two booleans into one. Registry default now matches
    // BCA Standard rules (false for 8-ball). LO opts in via edit mode if
    // their league has different house rules.
    const event = listGameEvents().find(e => e.name === 'golden_break')!;
    expect(event.enabledByDefault.eight_ball).toBe(false);
    expect(event.enabledByDefault.nine_ball).toBe(false);
    expect(event.enabledByDefault.ten_ball).toBe(false);
  });

  it('runout defaults to true on 8-ball only (today: 8-ball only, non-breaker role-gated)', () => {
    const event = listGameEvents().find(e => e.name === 'runout')!;
    expect(event.enabledByDefault.eight_ball).toBe(true);
    expect(event.enabledByDefault.nine_ball).toBe(false);
    expect(event.enabledByDefault.ten_ball).toBe(false);
  });

  it('win_by_forfeit defaults to true everywhere (today: all game types)', () => {
    const event = listGameEvents().find(e => e.name === 'win_by_forfeit')!;
    expect(event.enabledByDefault.eight_ball).toBe(true);
    expect(event.enabledByDefault.nine_ball).toBe(true);
    expect(event.enabledByDefault.ten_ball).toBe(true);
  });

  it('break_fouled defaults to true everywhere (today: all game types as state modifier)', () => {
    const event = listGameEvents().find(e => e.name === 'break_fouled')!;
    expect(event.enabledByDefault.eight_ball).toBe(true);
    expect(event.enabledByDefault.nine_ball).toBe(true);
    expect(event.enabledByDefault.ten_ball).toBe(true);
  });

  // The 3 net-new events introduced by Branch B must ship dormant. Today's
  // modal does NOT render Early 8, Scratch on 8, or 8 in Wrong Pocket;
  // Phase 1 must preserve that. Phase 2 will let LOs enable them per league.
  it.each(['early_8', 'scratch_on_8', 'eight_wrong_pocket'])(
    '%s ships dormant — false everywhere (Phase 2 LO toggle activates)',
    (eventName) => {
      const event = listGameEvents().find(e => e.name === eventName)!;
      expect(event.enabledByDefault.eight_ball).toBe(false);
      expect(event.enabledByDefault.nine_ball).toBe(false);
      expect(event.enabledByDefault.ten_ball).toBe(false);
    },
  );
});

describe('attribution rules', () => {
  beforeEach(() => {
    clearRegistry();
    registerSeedGameEvents();
  });

  it('break_fouled uses scheduled-breaker (not breaker) — the offender, not the post-flip actual breaker', () => {
    const event = listGameEvents().find(e => e.name === 'break_fouled')!;
    expect(event.attributedTo).toBe('scheduled-breaker');
  });

  it('break_and_run requires winner = breaker (role gate)', () => {
    const event = listGameEvents().find(e => e.name === 'break_and_run')!;
    expect(event.winnerRequired).toBe('breaker');
    expect(event.attributedTo).toBe('winner');
  });

  it('runout requires winner = non-breaker (role gate)', () => {
    const event = listGameEvents().find(e => e.name === 'runout')!;
    expect(event.winnerRequired).toBe('non-breaker');
    expect(event.attributedTo).toBe('winner');
  });

  it('loss-cause events attribute to the loser', () => {
    for (const name of ['early_8', 'scratch_on_8', 'eight_wrong_pocket']) {
      const event = listGameEvents().find(e => e.name === name)!;
      expect(event.attributedTo).toBe('loser');
    }
  });

  it('win_by_forfeit suppresses role-conditional events', () => {
    const event = listGameEvents().find(e => e.name === 'win_by_forfeit')!;
    expect(event.suppressesRoleConditionalEvents).toBe(true);
  });
});
