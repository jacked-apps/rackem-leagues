/**
 * @fileoverview Who is home when two teams are paired by an odd-league drop.
 *
 * When a team drops mid-season from a league that already has a BYE, each
 * remaining week pairs two "leftover" teams: the one that lost its opponent
 * (it was scheduled against the dropped team) and the one that had the bye.
 * Each keeps the side (home/away) it already had whenever those differ. When
 * both were home (or both away), the rule Ed set (2026-11-19) decides, in order:
 *   1. fewer HOME games already PLAYED this season gets home
 *   2. fewer HOME games across the whole schedule (as it now stands) gets home
 *   3. LOWER in the standings gets home (the struggling team gets the nod)
 *   4. still tied (e.g. nobody has played yet) → coin flip
 *
 * @see planOddLeagueDrop.ts (the caller)
 */

/** One leftover team and the facts the tiebreak reads. */
export interface HomeCandidate {
  teamId: string;
  /** The side this team already had in its original match this week. */
  side: 'home' | 'away';
  /** Home games this team has already played this season. */
  homePlayed: number;
  /** Home games this team has in the whole schedule as it currently stands. */
  homeScheduled: number;
  /** Standings position, 0 = first place. Higher = lower in the standings. */
  standingsIndex: number;
}

/**
 * Decide home and away for two leftover teams.
 *
 * @param a - One leftover team
 * @param b - The other leftover team
 * @param random - Coin-flip source for the last tiebreak (injectable for tests)
 * @returns The home and away team ids
 */
export function pickHomeTeam(
  a: HomeCandidate,
  b: HomeCandidate,
  random: () => number = Math.random,
): { homeTeamId: string; awayTeamId: string } {
  const home = (h: HomeCandidate, w: HomeCandidate) => ({ homeTeamId: h.teamId, awayTeamId: w.teamId });

  // Different sides already: nobody moves.
  if (a.side !== b.side) return a.side === 'home' ? home(a, b) : home(b, a);

  // Same side: fewer home games played, then fewer scheduled, gets home.
  if (a.homePlayed !== b.homePlayed) return a.homePlayed < b.homePlayed ? home(a, b) : home(b, a);
  if (a.homeScheduled !== b.homeScheduled) {
    return a.homeScheduled < b.homeScheduled ? home(a, b) : home(b, a);
  }

  // Lower in the standings (bigger index) gets home.
  if (a.standingsIndex !== b.standingsIndex) {
    return a.standingsIndex > b.standingsIndex ? home(a, b) : home(b, a);
  }

  // Dead even: coin flip.
  return random() < 0.5 ? home(a, b) : home(b, a);
}
