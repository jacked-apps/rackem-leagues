/**
 * @fileoverview Threshold module: BCA 3v3 team bonus.
 *
 * Reads `home_team_id`, `away_team_id`, `season_id` from the bag.
 * Queries the season's completed matches via supabase and computes
 * the home team's standings-based bonus.
 *
 * Writes:
 * - `home_team_bonus` (number): floor((homeWins - awayWins) / 2)
 * - `away_team_bonus` (number): always 0 (BCA Points only credits the
 *   home team with a standings bonus)
 *
 * Never throws. On any failure (missing IDs, DB error), both bonuses
 * are written as 0. Honors principle 7 in CLAUDE.md — math errors
 * fail silently; scoring page continues.
 */

import { supabase } from '@/supabaseClient';
import type { Module, StateBag } from '@/systems/chain-runtime/types';

export const teamBonus: Module = {
  name: 'bca3v3.teamBonus',
  run: async (bag: StateBag) => {
    bag.away_team_bonus = 0;

    const homeTeamId = bag.home_team_id as string | null;
    const awayTeamId = bag.away_team_id as string | null;
    const seasonId = bag.season_id as string | null;

    if (!homeTeamId || !awayTeamId || !seasonId) {
      bag.home_team_bonus = 0;
      return;
    }

    try {
      const { data: matches, error } = await supabase
        .from('matches')
        .select('winner_team_id')
        .eq('season_id', seasonId)
        .eq('status', 'completed');

      if (error || !matches) {
        bag.home_team_bonus = 0;
        return;
      }

      let homeWins = 0;
      let awayWins = 0;
      for (const match of matches) {
        if (match.winner_team_id === homeTeamId) homeWins++;
        else if (match.winner_team_id === awayTeamId) awayWins++;
      }

      bag.home_team_bonus = Math.floor((homeWins - awayWins) / 2);
    } catch {
      bag.home_team_bonus = 0;
    }
  },
};
