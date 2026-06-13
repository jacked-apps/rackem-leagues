/**
 * @fileoverview Playoff Bracket Card Component
 *
 * Displays a playoff bracket for a specific week using actual team data.
 * Shows matchups with real team names (or placeholders when season incomplete),
 * and includes a dropdown to change the matchup style (seeded, ranked, etc.).
 *
 * This component differs from PlayoffBracketPreviewCard in that:
 * - It uses real team data from standings (SeededTeam[])
 * - Shows actual team names instead of "1st Place Team" placeholders
 * - Is used on the League Playoff Setup page with live data
 *
 * Used on:
 * - League Playoff Setup page (/league/:id/season/:id/playoffs)
 */

import React, { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  generateMatchupPairs,
  getMatchupStyleLabel,
  getMatchupStyleDescription,
} from '@/hooks/playoff/usePlayoffSettingsReducer';
import type { MatchupStyle } from '@/hooks/playoff/usePlayoffSettingsReducer';
import type { SeededTeam } from '@/types/playoff';

/**
 * Props for PlayoffBracketCard component
 */
export interface PlayoffBracketCardProps {
  /** Week number (1-based) for display */
  weekNum: number;
  /** Zero-based week index for dispatch actions */
  weekIndex: number;
  /** Current matchup style for this week */
  matchupStyle: MatchupStyle;
  /** Seeded teams from standings (used to get team names) */
  seededTeams: SeededTeam[];
  /** Number of teams in the bracket */
  bracketSize: number;
  /** Whether the regular season is complete (affects display style) */
  isSeasonComplete: boolean;
  /** Callback when matchup style changes */
  onMatchupStyleChange: (weekIndex: number, style: MatchupStyle) => void;
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Single matchup within the bracket
 * Shows two teams with their seeds, names, and records
 */
interface MatchupDisplayProps {
  matchNumber: number;
  homeSeed: number;
  awaySeed: number;
  homeTeam: SeededTeam | undefined;
  awayTeam: SeededTeam | undefined;
  isSeasonComplete: boolean;
  matchupStyle: MatchupStyle;
}

/**
 * MatchupDisplay Component
 *
 * Renders a single matchup card showing home and away teams.
 * When season is incomplete, shows team names in italics to indicate
 * that standings may change.
 */
const MatchupDisplay: React.FC<MatchupDisplayProps> = ({
  matchNumber,
  homeSeed,
  awaySeed,
  homeTeam,
  awayTeam,
  isSeasonComplete,
  matchupStyle,
}) => {
  /**
   * Get display info for a team based on matchup style and seed
   * For random style, shows "Random Team" placeholder
   * For bracket style with special seeds (100+, 200+), shows winner/loser refs
   */
  const getTeamDisplay = (
    seed: number,
    team: SeededTeam | undefined
  ) => {
    // Random matchup - show placeholder
    if (matchupStyle === 'random' || seed < 0) {
      return {
        name: 'Random Team',
        record: null,
        isPlaceholder: true,
      };
    }

    // Bracket progression seeds (for week 2+)
    if (seed >= 100) {
      if (seed >= 200 && seed < 300) {
        // Loser of match X
        const matchRef = seed - 200;
        return {
          name: `Loser Match ${matchRef}`,
          record: null,
          isPlaceholder: true,
        };
      }
      if (seed === 300) {
        // Remaining loser (wildcard)
        return {
          name: 'Remaining Loser',
          record: null,
          isPlaceholder: true,
        };
      }
      // Winner of match X (100-199)
      const matchRef = seed - 100;
      return {
        name: `Winner Match ${matchRef}`,
        record: null,
        isPlaceholder: true,
      };
    }

    // Regular seed - show actual team name
    if (team) {
      return {
        name: team.teamName,
        record: `${team.matchWins}W - ${team.matchLosses}L`,
        isPlaceholder: false,
      };
    }

    // Fallback if no team found for seed
    return {
      name: `${getOrdinal(seed)} Place`,
      record: null,
      isPlaceholder: true,
    };
  };

  const homeDisplay = getTeamDisplay(homeSeed, homeTeam);
  const awayDisplay = getTeamDisplay(awaySeed, awayTeam);

  return (
    <div className="border-2 border-border rounded-lg p-4 bg-card shadow-sm">
      <div className="text-sm text-foreground font-medium mb-2 text-center">
        Match {matchNumber}
      </div>
      <div className="space-y-3">
        {/* Home team (higher seed) */}
        <div className="flex items-center justify-between bg-info/10 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
              {homeSeed > 0 && homeSeed < 100 ? homeSeed : '?'}
            </div>
            <div>
              <div
                className={`font-semibold ${
                  homeDisplay.isPlaceholder || !isSeasonComplete
                    ? 'text-muted-foreground italic'
                    : 'text-foreground'
                }`}
              >
                {homeDisplay.name}
              </div>
              {homeDisplay.record && (
                <div className="text-xs text-muted-foreground">{homeDisplay.record}</div>
              )}
            </div>
          </div>
          <div className="text-xs text-info font-medium">HOME</div>
        </div>

        <div className="text-center text-muted-foreground text-sm font-semibold">vs</div>

        {/* Away team (lower seed) */}
        <div className="flex items-center justify-between bg-muted rounded-lg p-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-600 text-white flex items-center justify-center font-bold text-sm">
              {awaySeed > 0 && awaySeed < 100 ? awaySeed : '?'}
            </div>
            <div>
              <div
                className={`font-semibold ${
                  awayDisplay.isPlaceholder || !isSeasonComplete
                    ? 'text-muted-foreground italic'
                    : 'text-foreground'
                }`}
              >
                {awayDisplay.name}
              </div>
              {awayDisplay.record && (
                <div className="text-xs text-muted-foreground">{awayDisplay.record}</div>
              )}
            </div>
          </div>
          <div className="text-xs text-muted-foreground font-medium">AWAY</div>
        </div>
      </div>
    </div>
  );
};

/**
 * PlayoffBracketCard Component
 *
 * Renders a card showing playoff matchups for a specific week.
 * Uses actual team data from standings to display real team names.
 * Includes a dropdown to change the matchup style.
 *
 * @example
 * <PlayoffBracketCard
 *   weekNum={1}
 *   weekIndex={0}
 *   matchupStyle="seeded"
 *   seededTeams={bracket.seededTeams}
 *   bracketSize={bracket.bracketSize}
 *   isSeasonComplete={seasonStatus.isComplete}
 *   onMatchupStyleChange={handleMatchupStyleChange}
 * />
 */
export const PlayoffBracketCard: React.FC<PlayoffBracketCardProps> = ({
  weekNum,
  weekIndex,
  matchupStyle,
  seededTeams,
  bracketSize,
  isSeasonComplete,
  onMatchupStyleChange,
}) => {
  /**
   * Generate matchup pairs based on current style and map to teams
   * For week 1, uses seeded/ranked/random styles
   * For week 2+, typically uses bracket progression
   */
  const matchups = useMemo(() => {
    const pairs = generateMatchupPairs(bracketSize, matchupStyle);

    return pairs.map((pair, index) => {
      const [homeSeed, awaySeed] = pair;

      // Find teams by seed (for regular seeds 1-99)
      const homeTeam =
        homeSeed > 0 && homeSeed < 100
          ? seededTeams.find((t) => t.seed === homeSeed)
          : undefined;
      const awayTeam =
        awaySeed > 0 && awaySeed < 100
          ? seededTeams.find((t) => t.seed === awaySeed)
          : undefined;

      return {
        matchNumber: index + 1,
        homeSeed,
        awaySeed,
        homeTeam,
        awayTeam,
      };
    });
  }, [bracketSize, matchupStyle, seededTeams]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-accent-foreground" />
            Bracket Week {weekNum} ({bracketSize} Teams)
          </CardTitle>
          {/* Matchup Style Dropdown */}
          <Select
            value={matchupStyle}
            onValueChange={(value) =>
              onMatchupStyleChange(weekIndex, value as MatchupStyle)
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="seeded">
                <div className="flex flex-col">
                  <span>Seeded</span>
                  <span className="text-xs text-muted-foreground">
                    {getMatchupStyleDescription('seeded')}
                  </span>
                </div>
              </SelectItem>
              <SelectItem value="ranked">
                <div className="flex flex-col">
                  <span>Ranked</span>
                  <span className="text-xs text-muted-foreground">
                    {getMatchupStyleDescription('ranked')}
                  </span>
                </div>
              </SelectItem>
              <SelectItem value="random">
                <div className="flex flex-col">
                  <span>Random Draw</span>
                  <span className="text-xs text-muted-foreground">
                    {getMatchupStyleDescription('random')}
                  </span>
                </div>
              </SelectItem>
              <SelectItem value="bracket">
                <div className="flex flex-col">
                  <span>Bracket Progression</span>
                  <span className="text-xs text-muted-foreground">
                    {getMatchupStyleDescription('bracket')}
                  </span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Style description below title */}
        <p className="text-sm text-muted-foreground mt-2">
          {getMatchupStyleLabel(matchupStyle)}:{' '}
          {getMatchupStyleDescription(matchupStyle)}
        </p>
        {/* Note about standings when season is incomplete */}
        {!isSeasonComplete && (
          <p className="text-xs text-warning mt-1">
            Team positions may change as more regular season matches are played.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {/* Matchup cards grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {matchups.map((matchup) => (
            <MatchupDisplay
              key={matchup.matchNumber}
              matchNumber={matchup.matchNumber}
              homeSeed={matchup.homeSeed}
              awaySeed={matchup.awaySeed}
              homeTeam={matchup.homeTeam}
              awayTeam={matchup.awayTeam}
              isSeasonComplete={isSeasonComplete}
              matchupStyle={matchupStyle}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PlayoffBracketCard;
