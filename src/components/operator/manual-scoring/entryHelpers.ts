/**
 * @fileoverview Pure helpers for the LO Entry phase (game grid + finalize gate),
 * kept out of the component file for testability.
 */

/** The match_games fields the Entry grid reads. */
export interface EntryGame {
  id: string;
  game_number: number;
  home_player_id: string | null;
  away_player_id: string | null;
  home_action?: string | null;
  away_action?: string | null;
  winner_player_id: string | null;
  winner_team_id: string | null;
  break_and_run?: boolean | null;
  golden_break?: boolean | null;
  break_fouled?: boolean | null;
  runout?: boolean | null;
  win_by_forfeit?: boolean | null;
  winner_value?: number | null;
  loser_value?: number | null;
  is_tiebreaker?: boolean | null;
}

/** Regular (non-tiebreaker) games, ordered by game number. */
export function regularGames(games: EntryGame[]): EntryGame[] {
  return games.filter((g) => !g.is_tiebreaker).sort((a, b) => a.game_number - b.game_number);
}

/** A game is scored once it has a winner. */
export function isGameScored(game: EntryGame): boolean {
  return !!game.winner_player_id;
}

/** Count of regular games still needing a result. */
export function countUnscored(games: EntryGame[]): number {
  return regularGames(games).filter((g) => !isGameScored(g)).length;
}

/**
 * Did the winning side hold the break for this game? Drives the ScoringDialog's
 * break-and-run / golden-break eligibility (same logic the live `handlePlayerClick`
 * uses). Engine-assigned breaker; non-authoritative in v1.
 */
export function winnerWasScheduledBreaker(game: EntryGame, winnerIsHome: boolean): boolean {
  return winnerIsHome ? game.home_action === 'breaks' : game.away_action === 'breaks';
}
