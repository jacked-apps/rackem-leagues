/**
 * @fileoverview Playoff Matchup Card Component
 *
 * Displays a single playoff matchup with home and away teams/seeds.
 * Handles different seed encodings:
 * - Regular seeds (1-99): Show seed numbers and team positions
 * - Winners (100-199): Show "Winner of Match X" references
 * - Losers (200-299): Show "Loser of Match X" references
 * - Wildcards (300): Show "Remaining Loser" for wildcard from losers pool
 * - Random (negative): Show shuffle icons for random matchups
 *
 * This component can be used for:
 * - Organization playoff settings page (generic template preview)
 * - League playoff page (actual team assignments)
 * - Season playoff bracket display
 */

import React from 'react';
import { Trophy, Shuffle, ThumbsDown } from 'lucide-react';
import { JokerIcon } from '@/components/icons/JokerIcon';
import { getOrdinal } from '@/utils/formatters';

/**
 * Props for PlayoffMatchupCard component
 */
export interface PlayoffMatchupCardProps {
  /** Match number for display (1-based) */
  matchNumber: number;
  /** Home team seed - see seed encoding in fileoverview */
  homeSeed: number;
  /** Away team seed - see seed encoding in fileoverview */
  awaySeed: number;
  /** Total bracket size (number of teams in playoffs) */
  bracketSize: number;
  /** Number of wildcard spots (0 = none) */
  wildcardSpots: number;
}

/**
 * Display configuration for a seed
 */
interface SeedDisplay {
  /** Icon to show in the circle (can be a number or React element) */
  icon: React.ReactNode;
  /** Label text (e.g., "1st Place Team", "Winner Match 1") */
  label: string;
  /** Background color class for the row */
  bgColor: string;
  /** Background color class for the circle */
  circleBg: string;
  /** Text color class for the label */
  textColor: string;
  /** Badge color class for HOME/AWAY label */
  badgeColor: string;
}

/**
 * Playoff Matchup Card Component
 *
 * Shows a single matchup with home and away positions.
 * Handles different seed types with appropriate visual styling:
 * - Blue: Home team regular seeds
 * - Gray: Away team regular seeds
 * - Amber: Wildcard positions
 * - Purple: Random matchups
 * - Indigo: Winner references
 * - Gray (darker): Loser references
 *
 * @example
 * // Regular seeded matchup
 * <PlayoffMatchupCard
 *   matchNumber={1}
 *   homeSeed={1}
 *   awaySeed={4}
 *   bracketSize={4}
 *   wildcardSpots={0}
 * />
 *
 * @example
 * // Bracket progression matchup (winners)
 * <PlayoffMatchupCard
 *   matchNumber={3}
 *   homeSeed={101}  // Winner of Match 1
 *   awaySeed={102}  // Winner of Match 2
 *   bracketSize={4}
 *   wildcardSpots={0}
 * />
 */
export const PlayoffMatchupCard: React.FC<PlayoffMatchupCardProps> = ({
  matchNumber,
  homeSeed,
  awaySeed,
  bracketSize,
  wildcardSpots,
}) => {
  /**
   * Determine if a seed is a wildcard spot
   * Wildcard spots are the last N positions in the bracket
   */
  const isWildcard = (seed: number): boolean => {
    if (wildcardSpots === 0) return false;
    if (seed < 0 || seed > 100) return false; // Random or bracket seeds aren't wildcards
    const wildcardStartSeed = bracketSize - wildcardSpots + 1;
    return seed >= wildcardStartSeed;
  };

  // Check if this is a random matchup (negative seeds)
  const isRandom = homeSeed < 0 || awaySeed < 0;

  // Check if this is a bracket progression matchup (seeds > 100)
  // 100-199 = Winners, 200-299 = Losers, 300 = Wildcard from losers
  const isBracket = homeSeed > 100 || awaySeed > 100;

  /**
   * Get display configuration for a seed based on matchup style
   * Returns icon, label, and color classes for styling
   */
  const getSeedDisplay = (seed: number, isHome: boolean): SeedDisplay => {
    // Random matchup - show shuffle icon
    if (isRandom) {
      return {
        icon: <Shuffle className="h-4 w-4" />,
        label: 'Random Team',
        bgColor: 'bg-purple-50',
        circleBg: 'bg-purple-600',
        textColor: 'text-purple-700',
        badgeColor: isHome ? 'text-purple-600' : 'text-purple-500',
      };
    }

    // Bracket progression - handle winners (100+), losers (200+), and wildcard (300)
    if (isBracket) {
      // Wildcard from losers pool (remaining losers after one was picked)
      if (seed === 300) {
        return {
          icon: <JokerIcon className="h-6 w-6" size={24} />,
          label: 'Remaining Loser',
          bgColor: 'bg-amber-50',
          circleBg: 'bg-amber-600',
          textColor: 'text-amber-700',
          badgeColor: isHome ? 'text-amber-600' : 'text-amber-500',
        };
      }

      // Loser of match X (200-299)
      if (seed >= 200 && seed < 300) {
        const matchRef = seed - 200;
        return {
          icon: <ThumbsDown className="h-4 w-4" />,
          label: `Loser Match ${matchRef}`,
          bgColor: 'bg-muted',
          circleBg: 'bg-muted0',
          textColor: 'text-muted-foreground',
          badgeColor: isHome ? 'text-muted-foreground' : 'text-muted-foreground',
        };
      }

      // Winner of match X (100-199)
      const matchRef = seed - 100;
      return {
        icon: <Trophy className="h-4 w-4" />,
        label: `Winner Match ${matchRef}`,
        bgColor: 'bg-indigo-50',
        circleBg: 'bg-indigo-600',
        textColor: 'text-indigo-700',
        badgeColor: isHome ? 'text-indigo-600' : 'text-indigo-500',
      };
    }

    // Wildcard spot
    if (isWildcard(seed)) {
      return {
        icon: <JokerIcon className="h-6 w-6" size={24} />,
        label: 'Wildcard',
        bgColor: 'bg-amber-50',
        circleBg: 'bg-amber-600',
        textColor: 'text-amber-700',
        badgeColor: isHome ? 'text-amber-600' : 'text-amber-500',
      };
    }

    // Regular seeded/ranked - show seed number
    return {
      icon: seed,
      label: `${getOrdinal(seed)} Place Team`,
      bgColor: isHome ? 'bg-blue-50' : 'bg-muted',
      circleBg: isHome ? 'bg-blue-600' : 'bg-gray-600',
      textColor: 'text-muted-foreground',
      badgeColor: isHome ? 'text-blue-600' : 'text-muted-foreground',
    };
  };

  const homeDisplay = getSeedDisplay(homeSeed, true);
  const awayDisplay = getSeedDisplay(awaySeed, false);

  return (
    <div className="border-2 border-border rounded-lg p-4 bg-card shadow-sm">
      <div className="text-sm text-foreground font-medium mb-2 text-center">
        Match {matchNumber}
      </div>
      <div className="space-y-3">
        {/* Home team */}
        <div className={`flex items-center justify-between rounded-lg p-3 ${homeDisplay.bgColor}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-sm ${homeDisplay.circleBg}`}>
              {homeDisplay.icon}
            </div>
            <div>
              <div className={`font-semibold italic ${homeDisplay.textColor}`}>
                {homeDisplay.label}
              </div>
            </div>
          </div>
          <div className={`text-xs font-medium ${homeDisplay.badgeColor}`}>HOME</div>
        </div>

        <div className="text-center text-muted-foreground text-sm font-semibold">vs</div>

        {/* Away team */}
        <div className={`flex items-center justify-between rounded-lg p-3 ${awayDisplay.bgColor}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-sm ${awayDisplay.circleBg}`}>
              {awayDisplay.icon}
            </div>
            <div>
              <div className={`font-semibold italic ${awayDisplay.textColor}`}>
                {awayDisplay.label}
              </div>
            </div>
          </div>
          <div className={`text-xs font-medium ${awayDisplay.badgeColor}`}>AWAY</div>
        </div>
      </div>
    </div>
  );
};

export default PlayoffMatchupCard;
