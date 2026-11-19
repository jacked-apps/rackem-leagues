/**
 * @fileoverview pickHomeTeam: Ed's home/away rule (2026-11-19) for the two
 * leftover teams paired by an odd-league drop. Keep sides if they differ; else
 * fewer home games played → fewer scheduled → lower in standings → coin flip.
 */

import { describe, it, expect } from 'vitest';
import { pickHomeTeam, type HomeCandidate } from './pickHomeTeam';

const team = (teamId: string, over: Partial<HomeCandidate> = {}): HomeCandidate => ({
  teamId, side: 'home', homePlayed: 3, homeScheduled: 7, standingsIndex: 2, ...over,
});
const never = () => { throw new Error('coin flip should not be needed'); };

describe('pickHomeTeam', () => {
  it('keeps both sides when one was home and the other away', () => {
    expect(pickHomeTeam(team('A', { side: 'away' }), team('B', { side: 'home' }), never))
      .toEqual({ homeTeamId: 'B', awayTeamId: 'A' });
  });

  it('both home: fewer home games PLAYED gets home', () => {
    expect(pickHomeTeam(team('A', { homePlayed: 4 }), team('B', { homePlayed: 2 }), never))
      .toEqual({ homeTeamId: 'B', awayTeamId: 'A' });
  });

  it('both away and played equal: fewer home games SCHEDULED gets home', () => {
    expect(pickHomeTeam(team('A', { side: 'away', homeScheduled: 6 }), team('B', { side: 'away', homeScheduled: 8 }), never))
      .toEqual({ homeTeamId: 'A', awayTeamId: 'B' });
  });

  it('home counts equal: the team LOWER in the standings gets home', () => {
    expect(pickHomeTeam(team('A', { standingsIndex: 0 }), team('B', { standingsIndex: 5 }), never))
      .toEqual({ homeTeamId: 'B', awayTeamId: 'A' });
  });

  it('dead even: the coin flip decides', () => {
    expect(pickHomeTeam(team('A'), team('B'), () => 0.2)).toEqual({ homeTeamId: 'A', awayTeamId: 'B' });
    expect(pickHomeTeam(team('A'), team('B'), () => 0.8)).toEqual({ homeTeamId: 'B', awayTeamId: 'A' });
  });
});
