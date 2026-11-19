/**
 * @fileoverview findByeTeamId: the season's BYE team comes from team STATUS.
 * An empty team slot is a playoff "to be decided" team, never a bye. Judging
 * a bye by an empty slot was the old rule that these screens still used.
 */

import { describe, it, expect } from 'vitest';
import { findByeTeamId } from '../findByeTeamId';

type Team = { id: string; status: string | null };

/** One week holding the given matches (only the fields the helper reads). */
function week(type: string, matches: { home: Team | null; away: Team | null }[]) {
  return {
    week: { id: `w-${type}`, week_type: type },
    matches: matches.map((m, i) => ({
      id: `m${i}`,
      home_team_id: m.home?.id ?? null,
      away_team_id: m.away?.id ?? null,
      home_team: m.home ?? undefined,
      away_team: m.away ?? undefined,
    })),
  };
}

const sharks: Team = { id: 'sharks', status: 'active' };
const eagles: Team = { id: 'eagles', status: 'active' };
const bye: Team = { id: 'bye-row', status: 'bye' };

describe('findByeTeamId', () => {
  it('finds the bye team on the away side', () => {
    expect(findByeTeamId([week('regular', [{ home: sharks, away: bye }])])).toBe('bye-row');
  });

  it('finds the bye team on the home side', () => {
    expect(findByeTeamId([week('regular', [{ home: bye, away: eagles }])])).toBe('bye-row');
  });

  it('returns null for an even league (no bye team anywhere)', () => {
    expect(findByeTeamId([week('regular', [{ home: sharks, away: eagles }])])).toBeNull();
  });

  it('does not treat an empty slot (playoff TBD) as a bye', () => {
    const schedule = [
      week('regular', [{ home: sharks, away: eagles }]),
      week('playoffs', [{ home: null, away: null }]),
    ];
    expect(findByeTeamId(schedule)).toBeNull();
  });

  it('returns null for an empty schedule', () => {
    expect(findByeTeamId([])).toBeNull();
  });
});
