/**
 * @fileoverview Playoff Bracket Preview Card Component
 *
 * Displays a preview of playoff matchups for a specific week.
 * Shows matchup style selector, informational banners about qualification,
 * and a grid of matchup cards.
 *
 * Used on:
 * - Organization Playoff Settings page
 * - League Playoff Settings page (future)
 *
 * This component is purely presentational for previewing bracket structure.
 * Actual playoff bracket display during a season will use different components.
 */

import React from 'react';
import { Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlayoffMatchupCard } from '@/components/playoff/PlayoffMatchupCard';
import {
  generateMatchupPairs,
  getMatchupStyleLabel,
  getMatchupStyleDescription,
} from '@/hooks/playoff/usePlayoffSettingsReducer';
import { getOrdinal } from '@/utils/formatters';
import type { MatchupStyle, QualificationType } from '@/hooks/playoff/usePlayoffSettingsReducer';

/**
 * Props for PlayoffBracketPreviewCard component
 */
export interface PlayoffBracketPreviewCardProps {
  /** Week number (1-based) */
  weekNum: number;
  /** Zero-based week index for dispatch actions */
  weekIndex: number;
  /** Current matchup style for this week */
  matchupStyle: MatchupStyle;
  /** Number of teams in the bracket */
  bracketSize: number;
  /** Total number of teams (for info messages) */
  totalTeams: number;
  /** Qualification type for info messages */
  qualificationType: QualificationType;
  /** Qualifying percentage (for percentage type info message) */
  qualifyingPercentage: number;
  /** Number of wildcard spots */
  wildcardSpots: number;
  /** Callback when matchup style changes */
  onMatchupStyleChange: (weekIndex: number, style: MatchupStyle) => void;
}

/**
 * PlayoffBracketPreviewCard Component
 *
 * Renders a card showing:
 * - Week title with trophy icon
 * - Matchup style dropdown selector
 * - Style description
 * - Informational banners (qualification rules, wildcard info)
 * - Grid of matchup cards
 *
 * @example
 * <PlayoffBracketPreviewCard
 *   weekNum={1}
 *   weekIndex={0}
 *   matchupStyle="seeded"
 *   bracketSize={8}
 *   totalTeams={10}
 *   qualificationType="fixed"
 *   qualifyingPercentage={50}
 *   wildcardSpots={0}
 *   onMatchupStyleChange={(idx, style) => dispatch({
 *     type: 'SET_WEEK_MATCHUP_STYLE',
 *     payload: { weekIndex: idx, style }
 *   })}
 * />
 */
export const PlayoffBracketPreviewCard: React.FC<PlayoffBracketPreviewCardProps> = ({
  weekNum,
  weekIndex,
  matchupStyle,
  bracketSize,
  totalTeams,
  qualificationType,
  qualifyingPercentage,
  wildcardSpots,
  onMatchupStyleChange,
}) => {
  // Generate matchups for this week
  const pairs = generateMatchupPairs(bracketSize, matchupStyle);
  const matchups = pairs.map((pair, index) => ({
    matchNumber: index + 1,
    homeSeed: pair[0],
    awaySeed: pair[1],
  }));

  /**
   * Get the qualification info message based on settings
   * Returns null if all teams qualify or if wildcards are enabled
   */
  const getQualificationMessage = (): string | null => {
    // Don't show if wildcards are enabled (separate message for that)
    if (wildcardSpots > 0) return null;
    // Don't show if all teams qualify
    if (totalTeams === bracketSize) return null;

    switch (qualificationType) {
      case 'all':
        return `With ${totalTeams} teams, the ${getOrdinal(totalTeams)} place team does not participate in playoffs.`;
      case 'fixed':
        return `Only top ${bracketSize} teams qualify. Teams ranked ${bracketSize + 1}${totalTeams > bracketSize + 1 ? `-${totalTeams}` : ''} do not participate.`;
      case 'percentage':
        return `Based on ${qualifyingPercentage}% qualification, ${bracketSize} of ${totalTeams} teams participate.`;
      default:
        return null;
    }
  };

  /**
   * Get the wildcard info message
   * Only shows for Week 1 since wildcard selection happens at the start of playoffs
   * Returns null if wildcards are disabled or if not Week 1
   */
  const getWildcardMessage = (): string | null => {
    if (wildcardSpots === 0) return null;
    // Wildcard selection only happens in Week 1
    if (weekNum > 1) return null;
    return wildcardSpots === 1
      ? '1 wildcard spot randomly selected from teams that didn\'t automatically qualify.'
      : `${wildcardSpots} wildcard spots randomly selected from teams that didn't automatically qualify.`;
  };

  const qualificationMessage = getQualificationMessage();
  const wildcardMessage = getWildcardMessage();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-purple-600" />
            Example Bracket - Week {weekNum}
          </CardTitle>
          {/* Matchup Style Dropdown */}
          <Select
            value={matchupStyle}
            onValueChange={(value) => onMatchupStyleChange(weekIndex, value as MatchupStyle)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="seeded">
                <div className="flex flex-col">
                  <span>Seeded</span>
                  <span className="text-xs text-muted-foreground">{getMatchupStyleDescription('seeded')}</span>
                </div>
              </SelectItem>
              <SelectItem value="ranked">
                <div className="flex flex-col">
                  <span>Ranked</span>
                  <span className="text-xs text-muted-foreground">{getMatchupStyleDescription('ranked')}</span>
                </div>
              </SelectItem>
              <SelectItem value="random">
                <div className="flex flex-col">
                  <span>Random Draw</span>
                  <span className="text-xs text-muted-foreground">{getMatchupStyleDescription('random')}</span>
                </div>
              </SelectItem>
              <SelectItem value="bracket">
                <div className="flex flex-col">
                  <span>Bracket Progression</span>
                  <span className="text-xs text-muted-foreground">{getMatchupStyleDescription('bracket')}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Style description below title */}
        <p className="text-sm text-muted-foreground mt-2">
          {getMatchupStyleLabel(matchupStyle)}: {getMatchupStyleDescription(matchupStyle)}
        </p>
      </CardHeader>
      <CardContent>
        {/* Qualification info banner */}
        {qualificationMessage && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            {qualificationMessage}
          </div>
        )}
        {/* Wildcard info banner */}
        {wildcardMessage && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            {wildcardMessage}
          </div>
        )}
        {/* Matchup cards grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {matchups.map((matchup) => (
            <PlayoffMatchupCard
              key={matchup.matchNumber}
              matchNumber={matchup.matchNumber}
              homeSeed={matchup.homeSeed}
              awaySeed={matchup.awaySeed}
              bracketSize={bracketSize}
              wildcardSpots={wildcardSpots}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PlayoffBracketPreviewCard;
