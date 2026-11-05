/**
 * @fileoverview Team handicap bonus — the ONE place it is worked out.
 *
 * The team bonus is extra handicap for the HOME team in points-system
 * leagues, from the gap in match wins this season. Every screen that needs
 * it (the lineup screen, the scoring page and match setup, which sets the
 * games each team needs) calls this function, so they can't disagree.
 * Before 2026-11-01 there were two copies: one ignored the league's
 * standard/reduced/none setting, and neither knew about playoffs.
 *
 * Rules:
 *  - Points system only (other systems → 0).
 *  - NEVER in a playoff week (Ed, 2026-11-01: found by a user complaint).
 *  - The league's resolved `team_handicap_variant` sets the divisor:
 *    standard = every 2 wins ahead is +1, reduced = every 3, none = always 0.
 *    Read from `resolved_league_preferences`, the same place the operator's
 *    Preferences card writes to (league → org → default cascade).
 *
 * Any lookup failure returns 0 (neutral) and logs, matching the old helpers.
 */

import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';
import type { HandicapVariant } from '@/types/league';

/** Inputs to the pure bonus rule. */
export interface TeamBonusInputs {
  /** Completed match wins this season for the home team. */
  homeWins: number;
  /** Completed match wins this season for the away team. */
  awayWins: number;
  /** League's resolved team-bonus setting. */
  variant: HandicapVariant;
  /** True when the match sits in a playoff week. */
  isPlayoff: boolean;
}

/**
 * The bonus rule with no database: floor(win gap ÷ divisor), or 0 in a
 * playoff week or a `none` league. Floor means a gap of −1 is −1, not 0.
 *
 * @example computeTeamBonus({ homeWins: 8, awayWins: 3, variant: 'standard', isPlayoff: false }) // 2
 * @example computeTeamBonus({ homeWins: 8, awayWins: 3, variant: 'reduced', isPlayoff: false })  // 1
 * @example computeTeamBonus({ homeWins: 8, awayWins: 3, variant: 'standard', isPlayoff: true })  // 0
 */
export function computeTeamBonus({ homeWins, awayWins, variant, isPlayoff }: TeamBonusInputs): number {
  if (isPlayoff || variant === 'none') return 0;
  const divisor = variant === 'reduced' ? 3 : 2;
  return Math.floor((homeWins - awayWins) / divisor);
}

/**
 * Work out the home team's bonus for one match, straight from the database.
 *
 * @param matchId - The match the bonus is for (its week decides "playoff?")
 * @param handicapType - League's handicap type; only `'points'` uses a bonus
 * @returns The bonus to add to the home team's handicap total (may be negative)
 */
export async function getTeamHandicapBonus(matchId: string, handicapType: string): Promise<number> {
  if (handicapType !== 'points') return 0;

  try {
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('home_team_id, away_team_id, season_id, season_week:season_weeks(week_type), season:seasons!matches_season_id_fkey(league_id)')
      .eq('id', matchId)
      .single();
    if (matchError || !match) throw new Error(matchError?.message ?? 'match not found');

    // Playoffs never get a bonus — skip the rest of the lookups.
    if (match.season_week?.week_type === 'playoffs') return 0;

    const leagueId = match.season?.league_id;
    const { data: prefs, error: prefsError } = await supabase
      .from('resolved_league_preferences')
      .select('team_handicap_variant')
      .eq('league_id', leagueId ?? '')
      .maybeSingle();
    if (prefsError) throw new Error(prefsError.message);
    const variant = (prefs?.team_handicap_variant ?? 'standard') as HandicapVariant;
    if (variant === 'none') return 0;

    const { data: completed, error: winsError } = await supabase
      .from('matches')
      .select('winner_team_id')
      .eq('season_id', match.season_id)
      .eq('status', 'completed');
    if (winsError) throw new Error(winsError.message);

    const winsFor = (teamId: string | null) =>
      (completed ?? []).filter((m) => teamId && m.winner_team_id === teamId).length;

    return computeTeamBonus({
      homeWins: winsFor(match.home_team_id),
      awayWins: winsFor(match.away_team_id),
      variant,
      isPlayoff: false,
    });
  } catch (error) {
    logger.error('Team handicap bonus lookup failed — using 0', {
      matchId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}
