/**
 * @fileoverview Tests for bca3v3.teamBonus.
 *
 * Mocks the supabase client so this stays a unit test (no DB hit).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StateBag } from '@/systems/chain-runtime/types';

// Mock supabase before importing the module under test
const mockFromBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn(),
};

vi.mock('@/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => mockFromBuilder),
  },
}));

// Import after mock is set up
const { teamBonus } = await import('../teamBonus');

function setMatches(matches: Array<{ winner_team_id: string | null }> | null, error: { message: string } | null = null) {
  mockFromBuilder.eq.mockImplementation((column: string) => {
    // The second `.eq(...)` call returns the result
    if (column === 'status') {
      return Promise.resolve({ data: matches, error });
    }
    return mockFromBuilder;
  });
}

describe('bca3v3.teamBonus', () => {
  beforeEach(() => {
    mockFromBuilder.select.mockClear();
    mockFromBuilder.eq.mockReset();
    mockFromBuilder.select.mockReturnValue(mockFromBuilder);
  });

  it('writes floor((homeWins - awayWins) / 2) for home, 0 for away', async () => {
    setMatches([
      { winner_team_id: 'home' },
      { winner_team_id: 'home' },
      { winner_team_id: 'home' },
      { winner_team_id: 'home' },
      { winner_team_id: 'home' },
      { winner_team_id: 'home' },
      { winner_team_id: 'home' },
      { winner_team_id: 'home' },
      { winner_team_id: 'away' },
      { winner_team_id: 'away' },
      { winner_team_id: 'away' },
    ]);
    const bag: StateBag = {
      home_team_id: 'home',
      away_team_id: 'away',
      season_id: 'season',
    };
    await teamBonus.run(bag, {});
    expect(bag.home_team_bonus).toBe(2); // floor((8 - 3) / 2)
    expect(bag.away_team_bonus).toBe(0);
  });

  it('writes negative bonus when away has more wins', async () => {
    setMatches([
      { winner_team_id: 'away' },
      { winner_team_id: 'away' },
      { winner_team_id: 'away' },
      { winner_team_id: 'away' },
      { winner_team_id: 'home' },
      { winner_team_id: 'home' },
      { winner_team_id: 'home' },
    ]);
    const bag: StateBag = {
      home_team_id: 'home',
      away_team_id: 'away',
      season_id: 'season',
    };
    await teamBonus.run(bag, {});
    expect(bag.home_team_bonus).toBe(-1); // floor((3 - 4) / 2)
  });

  it('writes 0 when no completed matches exist', async () => {
    setMatches([]);
    const bag: StateBag = {
      home_team_id: 'home',
      away_team_id: 'away',
      season_id: 'season',
    };
    await teamBonus.run(bag, {});
    expect(bag.home_team_bonus).toBe(0);
    expect(bag.away_team_bonus).toBe(0);
  });

  it('writes 0 on DB error (never throws)', async () => {
    setMatches(null, { message: 'oh no' });
    const bag: StateBag = {
      home_team_id: 'home',
      away_team_id: 'away',
      season_id: 'season',
    };
    await teamBonus.run(bag, {});
    expect(bag.home_team_bonus).toBe(0);
    expect(bag.away_team_bonus).toBe(0);
  });

  it('writes 0 when team IDs are missing from the bag', async () => {
    const bag: StateBag = {};
    await teamBonus.run(bag, {});
    expect(bag.home_team_bonus).toBe(0);
    expect(bag.away_team_bonus).toBe(0);
  });
});
