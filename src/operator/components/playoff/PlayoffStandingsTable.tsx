/**
 * @fileoverview Playoff Standings Table Component
 *
 * Displays team standings with playoff eligibility status.
 * Shows visual indicators for:
 * - Auto-qualified teams: Teams within (bracketSize - wildcardSpots)
 * - Wildcard eligible: Teams that could be randomly selected for wildcard spots
 * - Not in playoffs: Teams outside playoff bracket (when no wildcards)
 *
 * This component can be used for:
 * - Organization playoff settings page (generic placeholder preview)
 * - League standings page (actual team data)
 * - Season playoff seeding display
 */

import React from 'react';
import { getOrdinal } from '@/utils/formatters';

/**
 * Props for PlayoffStandingsTable component
 */
export interface PlayoffStandingsTableProps {
  /** Total number of teams in the league/season */
  teamCount: number;
  /** Number of teams in the playoff bracket */
  bracketSize: number;
  /** Number of wildcard spots (0 = none) */
  wildcardSpots: number;
}

/**
 * Placeholder team data structure for generic display
 */
interface PlaceholderTeam {
  seed: number;
  name: string;
  isAutoQualified: boolean;
  isWildcardEligible: boolean;
  notInPlayoffs: boolean;
}

/**
 * Playoff Standings Table Component
 *
 * Shows team standings with playoff eligibility status.
 * Uses color coding to indicate qualification status:
 * - Default (white): Auto-qualified teams
 * - Amber: Wildcard eligible teams
 * - Red (faded): Teams not in playoffs
 *
 * @example
 * // 8 teams, 4 qualify, no wildcards
 * <PlayoffStandingsTable
 *   teamCount={8}
 *   bracketSize={4}
 *   wildcardSpots={0}
 * />
 *
 * @example
 * // 8 teams, 6 qualify, 2 wildcard spots
 * <PlayoffStandingsTable
 *   teamCount={8}
 *   bracketSize={6}
 *   wildcardSpots={2}
 * />
 */
export const PlayoffStandingsTable: React.FC<PlayoffStandingsTableProps> = ({
  teamCount,
  bracketSize,
  wildcardSpots,
}) => {
  // Calculate the cutoff for automatic qualification
  // With wildcards, fewer teams auto-qualify (last N spots are for wildcards)
  const autoQualifyCount = bracketSize - wildcardSpots;

  // Generate placeholder teams based on count
  const placeholderTeams: PlaceholderTeam[] = Array.from({ length: teamCount }, (_, i) => {
    const seed = i + 1;
    const isAutoQualified = seed <= autoQualifyCount;
    // Wildcard eligible: any team that didn't auto-qualify (when wildcards exist)
    const isWildcardEligible = !isAutoQualified && wildcardSpots > 0;
    // Not in playoffs: only when no wildcards and outside bracket size
    const notInPlayoffs = !isAutoQualified && wildcardSpots === 0;

    return {
      seed,
      name: `${getOrdinal(seed)} Place Team`,
      isAutoQualified,
      isWildcardEligible,
      notInPlayoffs,
    };
  });

  /**
   * Get row styling based on team playoff status
   */
  const getRowClass = (team: PlaceholderTeam): string => {
    if (team.isAutoQualified) return 'hover:bg-muted';
    if (team.isWildcardEligible) return 'bg-warning/10';
    return 'bg-destructive/10 opacity-60';
  };

  /**
   * Get seed circle styling based on team playoff status
   */
  const getSeedClass = (team: PlaceholderTeam): string => {
    if (team.isAutoQualified) return 'bg-accent text-foreground';
    if (team.isWildcardEligible) return 'bg-warning/20 text-warning';
    return 'bg-destructive/20 text-destructive';
  };

  /**
   * Get status label for team (wildcard eligible or not in playoffs)
   */
  const getStatusLabel = (team: PlaceholderTeam): React.ReactNode => {
    if (team.isAutoQualified) return null;
    if (team.isWildcardEligible) {
      return <span className="ml-2 text-xs text-warning">(Wildcard Eligible)</span>;
    }
    return <span className="ml-2 text-xs text-destructive">(Not in playoffs)</span>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted">
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Seed</th>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Team</th>
            <th className="text-center py-2 px-3 font-medium text-muted-foreground">W</th>
            <th className="text-center py-2 px-3 font-medium text-muted-foreground">L</th>
            <th className="text-center py-2 px-3 font-medium text-muted-foreground">Pts</th>
            <th className="text-center py-2 px-3 font-medium text-muted-foreground">Games</th>
          </tr>
        </thead>
        <tbody>
          {placeholderTeams.map((team) => (
            <tr
              key={team.seed}
              className={`border-b ${getRowClass(team)}`}
            >
              <td className="py-2 px-3">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-semibold text-xs ${getSeedClass(team)}`}>
                  {team.seed}
                </span>
              </td>
              <td className="py-2 px-3 font-medium text-muted-foreground italic">
                {team.name}
                {getStatusLabel(team)}
              </td>
              <td className="py-2 px-3 text-center text-muted-foreground">--</td>
              <td className="py-2 px-3 text-center text-muted-foreground">--</td>
              <td className="py-2 px-3 text-center text-muted-foreground">--</td>
              <td className="py-2 px-3 text-center text-muted-foreground">--</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PlayoffStandingsTable;
