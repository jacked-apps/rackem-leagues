/**
 * @fileoverview Tests for tournamentRules — the player-facing rules list.
 */

import { describe, it, expect } from 'vitest';
import { tournamentRules } from './tournamentRules';

function rules(over: Partial<Parameters<typeof tournamentRules>[0]> = {}) {
  return tournamentRules({
    format: 'double_elimination',
    grand_final_reset: false,
    game_type: null,
    ...over,
  });
}

describe('tournamentRules', () => {
  it('tells a player how many losses puts them out', () => {
    expect(rules({ format: 'double_elimination' })).toContainEqual({
      label: 'Knocked out after',
      value: 'Two losses',
    });
    expect(rules({ format: 'single_elimination' })).toContainEqual({
      label: 'Knocked out after',
      value: 'One loss',
    });
  });

  it('explains the grand-final reset only when it applies', () => {
    const withReset = rules({ format: 'double_elimination', grand_final_reset: true });
    expect(withReset.some((r) => r.label === 'Final')).toBe(true);

    // Meaningless in a single-elimination bracket, so it must not appear.
    const single = rules({ format: 'single_elimination', grand_final_reset: true });
    expect(single.some((r) => r.label === 'Final')).toBe(false);
  });

  it('names the game in plain English', () => {
    expect(rules({ game_type: 'eight_ball' })).toContainEqual({
      label: 'Game',
      value: '8-ball',
    });
  });

  it('passes through a game type it has no label for', () => {
    expect(rules({ game_type: 'rotation' })).toContainEqual({
      label: 'Game',
      value: 'rotation',
    });
  });

  it('omits the game entirely rather than showing a blank answer', () => {
    // A blank line reads as a missing answer; no line reads as "not set".
    expect(rules({ game_type: null }).some((r) => r.label === 'Game')).toBe(false);
  });
});
