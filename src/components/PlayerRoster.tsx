/**
 * @fileoverview Generic Player Roster Component
 *
 * Displays a list of players fetched by player IDs.
 * Reusable across the app (My Teams, Lineup, Tiebreaker, etc.)
 * Handles its own data fetching and handicap calculations.
 */

import { useMembersByIds } from '@/api/hooks/useCurrentMember';
import { usePlayerHandicaps } from '@/api/hooks/usePlayerHandicaps';
import { PlayerNameLink } from '@/components/PlayerNameLink';
import type { HandicapVariant, GameType } from '@/types/league';

interface PlayerRosterProps {
  playerIds: string[];
  /** Which handicap system: 'points', 'percentage', 'fargo', 'none' */
  handicapType: string;
  handicapVariant: HandicapVariant;
  gameType: GameType;
  leagueId?: string;
  gameLimit?: number;
  hidePlayerNumber?: boolean;
  hideName?: boolean;
  hideNickname?: boolean;
  hideHandicap?: boolean;
  captainId?: string; // ID of the team captain to display with (C) badge
  /** Team's max roster size. When provided, the header reads "X of Y players". */
  rosterSize?: number;
}

/**
 * Generic player roster component
 *
 * Takes an array of player IDs and displays them with their info.
 * Fetches player data and calculates handicaps internally.
 */
export function PlayerRoster({
  playerIds,
  handicapType,
  handicapVariant,
  gameType,
  leagueId,
  gameLimit = 200,
  hidePlayerNumber = false,
  hideName = false,
  hideNickname = false,
  hideHandicap = false,
  captainId,
  rosterSize,
}: PlayerRosterProps) {
  const { data: players = [], isLoading: loadingPlayers } = useMembersByIds(playerIds);
  const { handicaps, isLoading: loadingHandicaps } = usePlayerHandicaps({
    playerIds,
    handicapType,
    handicapVariant,
    gameType,
    leagueId,
    gameLimit,
  });

  if (loadingPlayers || loadingHandicaps) {
    return <div>Loading players...</div>;
  }

  // Sort players: captain first, then others in reverse order
  const sortedPlayers = [...players].sort((a, b) => {
    const aIsCaptain = a.id === captainId;
    const bIsCaptain = b.id === captainId;

    if (aIsCaptain && !bIsCaptain) return -1; // Captain comes first
    if (!aIsCaptain && bIsCaptain) return 1;  // Non-captain comes after

    // For non-captains, reverse the order (assume they came in reverse from DB)
    const aIndex = playerIds.indexOf(a.id);
    const bIndex = playerIds.indexOf(b.id);
    return bIndex - aIndex; // Reverse order
  });

  // Build grid class based on visible columns
  // Order: H/C Nickname Name Player#
  const getGridClass = () => {
    if (!hidePlayerNumber && !hideName && !hideNickname && !hideHandicap) {
      return 'grid-cols-[48px_120px_1fr_64px]'; // H/C Nickname Name Player#
    }
    if (hidePlayerNumber && !hideName && !hideNickname && !hideHandicap) {
      return 'grid-cols-[48px_120px_1fr]'; // H/C Nickname Name
    }
    if (hidePlayerNumber && !hideName && !hideNickname && hideHandicap) {
      return 'grid-cols-[120px_1fr]'; // Nickname Name
    }
    if (!hidePlayerNumber && !hideName && !hideNickname && hideHandicap) {
      return 'grid-cols-[120px_1fr_64px]'; // Nickname Name Player#
    }
    // Default fallback
    return 'grid-cols-1';
  };

  const gridCols = getGridClass();

  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground mb-2">
        Roster ({rosterSize ? `${players.length} of ${rosterSize}` : players.length} players)
      </p>

      {/* Header Row */}
      <div className={`grid ${gridCols} gap-4 text-xs font-medium text-muted-foreground pb-1 border-b`}>
        {!hideHandicap && <span className="text-center">H/C</span>}
        {!hideNickname && <span>Nickname</span>}
        {!hideName && <span>Name</span>}
        {!hidePlayerNumber && <span>Player #</span>}
      </div>

      {/* Player Rows */}
      <div className="mt-1">
        {sortedPlayers.map((player) => {
          const result = handicaps.get(player.id);
          const isCaptain = player.id === captainId;

          // Format handicap display based on type and stale flag
          let handicapDisplay = '-';
          if (result?.value != null) {
            const val = handicapType === 'percentage' ? `${result.value}%` : `${result.value}`;
            handicapDisplay = result.stale ? `${val}*` : val;
          } else if (handicapType === 'fargo') {
            handicapDisplay = 'Unrated';
          }

          return (
            <div key={player.id} className={`grid ${gridCols} gap-4 text-sm py-1 px-2 bg-muted rounded`}>
              {!hideHandicap && (
                <span className="text-muted-foreground text-center">
                  {handicapDisplay}
                </span>
              )}
              {!hideNickname && (
                <span className={`truncate ${isCaptain ? 'text-foreground font-semibold' : 'text-foreground'}`}>
                  <PlayerNameLink
                    playerId={player.id}
                    playerName={player.nickname || `${player.first_name} ${player.last_name}`}
                    className={isCaptain ? 'font-semibold' : ''}
                  />
                </span>
              )}
              {!hideName && (
                <span className="text-muted-foreground text-xs truncate">
                  {player.first_name} {player.last_name}
                  {isCaptain && <span className="ml-1 text-blue-600 font-bold">(C)</span>}
                </span>
              )}
              {!hidePlayerNumber && (
                <span className="text-muted-foreground">
                  {player.system_player_number}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
