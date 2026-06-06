/**
 * @fileoverview Snapshot-style coverage for the trigger room's
 * available-data registry.
 *
 * The point of these tests is to lock the registry to the runtime's
 * UNIVERSAL state-bag names — the ones every match guarantees regardless
 * of which other modules are wired in. Drift toward composition-specific
 * names (winTarget, threshold output labels, etc.) would lie to the LO
 * about what's actually in the bag at runtime. These tests fail fast
 * when that drift starts.
 */

import { describe, it, expect } from 'vitest';
import {
  TRIGGER_AVAILABLE_DATA,
  TRIGGER_WRITE_TARGETS,
  triggerLabelForVar,
} from '../availableData';

describe('TRIGGER_AVAILABLE_DATA — universal state-bag names', () => {
  it('contains the four team-level totals the runtime always tracks', () => {
    const names = TRIGGER_AVAILABLE_DATA.map((d) => d.name);
    expect(names).toContain('home_wins');
    expect(names).toContain('away_wins');
    expect(names).toContain('home_points');
    expect(names).toContain('away_points');
  });

  it('contains the two team handicap totals (set at match start)', () => {
    const names = TRIGGER_AVAILABLE_DATA.map((d) => d.name);
    expect(names).toContain('home_team_handicap');
    expect(names).toContain('away_team_handicap');
  });

  it('contains the two match-level counters', () => {
    const names = TRIGGER_AVAILABLE_DATA.map((d) => d.name);
    expect(names).toContain('games_played');
    expect(names).toContain('total_games');
  });

  it('contains the per-position counters for all five positions × two teams × two stats (20 entries)', () => {
    const names = TRIGGER_AVAILABLE_DATA.map((d) => d.name);
    for (const pos of [1, 2, 3, 4, 5]) {
      for (const team of ['home', 'away']) {
        expect(names).toContain(`${team}_player_${pos}_wins`);
        expect(names).toContain(`${team}_player_${pos}_points`);
      }
    }
  });

  it('does not contain composition-specific names that depend on other modules', () => {
    const names = TRIGGER_AVAILABLE_DATA.map((d) => d.name);
    // Threshold outputs the runtime only writes when a threshold module
    // declares them. These vary by composition and have no business in
    // a universal picker.
    expect(names).not.toContain('winTarget');
    expect(names).not.toContain('tieTarget');
    expect(names).not.toContain('milestoneTarget');
    // Edge / endmatch markers are allocator+anytime-trigger semantics,
    // not universally present.
    expect(names).not.toContain('edge');
    expect(names).not.toContain('endmatch');
  });

  it('entries have non-empty labels and descriptions', () => {
    for (const d of TRIGGER_AVAILABLE_DATA) {
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
    }
  });

  it('names are unique', () => {
    const names = TRIGGER_AVAILABLE_DATA.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('triggerLabelForVar', () => {
  it('returns the registered label for a known name', () => {
    expect(triggerLabelForVar('home_points')).toBe('Home team points');
    expect(triggerLabelForVar('home_player_3_wins')).toBe(
      'Home player 3 games won',
    );
  });

  it('falls back to the raw name for an unknown variable', () => {
    expect(triggerLabelForVar('mystery_var')).toBe('mystery_var');
  });
});

describe('TRIGGER_WRITE_TARGETS — v1 write restriction', () => {
  it('limits writes to home_points and away_points', () => {
    expect(TRIGGER_WRITE_TARGETS.map((t) => t.name)).toEqual([
      'home_points',
      'away_points',
    ]);
  });

  it('both write targets are present in the read universe (a trigger may read what it can write)', () => {
    const readNames = new Set(TRIGGER_AVAILABLE_DATA.map((d) => d.name));
    for (const target of TRIGGER_WRITE_TARGETS) {
      expect(readNames.has(target.name)).toBe(true);
    }
  });
});
