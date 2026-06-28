/**
 * @fileoverview The one definition of "this matchup is a BYE, not a real match."
 *
 * A BYE is the system-created, permanently-captainless team a league gets when
 * its team count is odd (`status='bye'`). A matchup containing it is NOT a real,
 * playable match — nobody plays it, the real team just gets their bye week. Every
 * match-machinery guard (table assignment, lineup entry, manual scoring
 * eligibility) keys on this single predicate so they can't drift on what counts
 * as a real match.
 */

/** Minimal shape needed to judge a side: just its team status. */
interface TeamStatusLike {
  status?: string | null;
}

/**
 * True when either side of the matchup is the BYE team (`status='bye'`).
 *
 * Pass the two team objects (home/away). Missing/undefined teams are treated as
 * "not a bye" here — absence of a team is a different concern (e.g. a playoff-TBD
 * match with a NULL team) handled by its own guards.
 */
export function isByeMatch(
  homeTeam: TeamStatusLike | null | undefined,
  awayTeam: TeamStatusLike | null | undefined,
): boolean {
  return homeTeam?.status === 'bye' || awayTeam?.status === 'bye';
}
