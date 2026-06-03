/**
 * @fileoverview Tests for seedMatchIdentity.
 */

import { describe, it, expect } from 'vitest';
import { seedMatchIdentity } from '../seedMatchIdentity';
import type { StateBag, Context } from '@/systems/chain-runtime/types';

describe('seedMatchIdentity', () => {
  it('writes match_id, team IDs, and season_id from matchData', async () => {
    const bag: StateBag = {};
    const context: Context = {
      matchData: {
        id: 'match-1',
        home_team_id: 'team-home',
        away_team_id: 'team-away',
        season_id: 'season-1',
      },
    };
    await seedMatchIdentity.run(bag, context);
    expect(bag.match_id).toBe('match-1');
    expect(bag.home_team_id).toBe('team-home');
    expect(bag.away_team_id).toBe('team-away');
    expect(bag.season_id).toBe('season-1');
  });

  it('writes null for all identity keys when matchData is missing entirely', async () => {
    const bag: StateBag = {};
    await seedMatchIdentity.run(bag, {});
    expect(bag.match_id).toBeNull();
    expect(bag.home_team_id).toBeNull();
    expect(bag.away_team_id).toBeNull();
    expect(bag.season_id).toBeNull();
  });

  it('writes null when individual matchData fields are missing', async () => {
    const bag: StateBag = {};
    await seedMatchIdentity.run(bag, { matchData: { home_team_id: 'h' } });
    expect(bag.match_id).toBeNull();
    expect(bag.home_team_id).toBe('h');
    expect(bag.away_team_id).toBeNull();
    expect(bag.season_id).toBeNull();
  });

  it('never throws on garbage input', () => {
    const bag: StateBag = {};
    expect(() => seedMatchIdentity.run(bag, { matchData: null })).not.toThrow();
  });
});
