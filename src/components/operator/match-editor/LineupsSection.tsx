/**
 * @fileoverview Lineups Section Component
 *
 * Displays and allows editing of both team lineups for a match.
 * Supports flexible player counts (3-6) and multiple handicap systems.
 *
 * Layout:
 * - Collapsible "Lineup Options" card for format config (players per team, handicap type)
 * - Main "Lineups" card with player selection and handicap inputs
 *
 * Features:
 * - Lineup size selector (3-6 players)
 * - Handicap system toggle: %, Points, Custom
 * - Player selection from team roster dropdowns
 * - Editable handicap values for each player
 * - Team handicap totals display
 *
 * This component works with the useMatchEditorState hook for state management.
 * All changes update local state; database writes happen on explicit save.
 *
 * @example
 * <LineupsSection
 *   homeTeamId={match.home_team_id}
 *   awayTeamId={match.away_team_id}
 *   homeTeamName="Ball Busters"
 *   awayTeamName="Chalk & Awe"
 *   editorState={state}
 *   editorActions={actions}
 * />
 */

import { useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Loader2 } from 'lucide-react';
import { useTeamRosterWithDetails } from '@/api/hooks/useTeams';
import { usePlayerHandicaps } from '@/api/hooks/usePlayerHandicaps';
import type { TeamRosterMember } from '@/api/queries/teams';
import type { TeamFormat, HandicapVariant, GameType } from '@/types/league';
import type {
  MatchEditorState,
  HandicapType,
  LineupPlayer,
} from './useMatchEditorState';

/**
 * Map editor HandicapType to league TeamFormat for handicap calculation
 * - 'points' mode uses 3v3 (5_man) integer handicaps (-2 to +2)
 * - 'percentage' mode uses 5v5 (8_man) percentage handicaps (0-100%)
 * - 'custom' mode doesn't auto-calculate
 */
function getTeamFormatForHandicapType(handicapType: HandicapType): TeamFormat {
  return handicapType === 'percentage' ? '8_man' : '5_man';
}

interface LineupsSectionProps {
  /** Home team ID for fetching roster */
  homeTeamId: string;
  /** Away team ID for fetching roster */
  awayTeamId: string;
  /** Home team display name */
  homeTeamName: string;
  /** Away team display name */
  awayTeamName: string;
  /** Match ID for handicap calculation caching */
  matchId?: string;
  /** Existing home lineup data (for initial population - not used with state hook) */
  homeLineup?: any | null;
  /** Existing away lineup data (for initial population - not used with state hook) */
  awayLineup?: any | null;
  /** League settings for handicap calculation */
  leagueSettings?: {
    id?: string;
    handicap_variant?: string;
    team_format?: string;
    game_type?: string;
  };
  /** Current editor state (from useMatchEditorState) */
  editorState?: MatchEditorState;
  /** Editor actions (from useMatchEditorState) */
  editorActions?: {
    setLineupSize: (size: number) => void;
    setHandicapType: (type: HandicapType) => void;
    setPlayer: (team: 'home' | 'away', position: number, playerId: string | null, playerName: string) => void;
    setPlayerHandicap: (team: 'home' | 'away', position: number, handicap: number) => void;
  };
  /** Callback when any value changes (legacy - deprecated with state hook) */
  onChange?: () => void;
}

// LineupOptionsCard has been removed - functionality moved to SetupOptions component

/**
 * Single team lineup card
 *
 * Displays player slots based on the lineup size set in formatConfig.
 * Player count is controlled via the LineupSizeSelector dropdown, not via add/remove buttons.
 * When a player is selected, their handicap is auto-calculated based on game history.
 */
function TeamLineupCard({
  teamName,
  teamId,
  players,
  teamTotal,
  handicapType,
  calculatedHandicaps,
  isCalculatingHandicaps,
  onPlayerSelect,
  onHandicapChange,
}: {
  teamName: string;
  teamId: string;
  players: LineupPlayer[];
  teamTotal: number;
  handicapType: HandicapType;
  /** Map of playerId -> calculated handicap for this handicap type */
  calculatedHandicaps: Map<string, number>;
  /** Whether handicaps are currently being calculated */
  isCalculatingHandicaps: boolean;
  onPlayerSelect: (position: number, playerId: string | null, playerName: string, member: TeamRosterMember | null) => void;
  onHandicapChange: (position: number, handicap: number) => void;
}) {
  // Fetch team roster for dropdown
  const { data: roster = [], isLoading } = useTeamRosterWithDetails(teamId);

  // Get already selected player IDs to prevent duplicates
  const selectedPlayerIds = new Set(
    players.filter((p) => p.playerId).map((p) => p.playerId)
  );

  // Whether handicap input should be editable (custom mode only)
  const isHandicapEditable = handicapType === 'custom';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">{teamName}</h4>
        <div className="flex items-center gap-2">
          {isCalculatingHandicaps && (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          )}
          <span className="text-sm text-gray-500">
            Total: <span className="font-medium">{teamTotal.toFixed(1)}</span>
          </span>
        </div>
      </div>

      {/* Player slots */}
      <div className="space-y-2">
        {players.map((player) => {
          // Get calculated handicap for this player (if available)
          const calculatedHandicap = player.playerId
            ? calculatedHandicaps.get(player.playerId)
            : undefined;

          return (
            <div key={player.position} className="flex items-center gap-2">
              {/* Position number */}
              <span className="w-6 text-center text-sm text-gray-400 font-medium">
                {player.position}.
              </span>

              {/* Player dropdown */}
              <Select
                value={player.playerId || 'none'}
                onValueChange={(value) => {
                  if (value === 'none') {
                    onPlayerSelect(player.position, null, '', null);
                  } else {
                    const member = roster.find((m) => m.memberId === value) || null;
                    const name = member
                      ? member.nickname || `${member.firstName} ${member.lastName}`
                      : '';
                    onPlayerSelect(player.position, value, name, member);
                  }
                }}
                disabled={isLoading}
              >
                <SelectTrigger className="flex-1 h-9">
                  <SelectValue placeholder="Select player..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Select player --</SelectItem>
                  {roster.map((member) => {
                    const isSelected = selectedPlayerIds.has(member.memberId);
                    const isCurrentSlot = player.playerId === member.memberId;
                    // Allow current selection but disable others that are selected
                    const disabled = isSelected && !isCurrentSlot;
                    const displayName = member.nickname
                      ? `${member.nickname} (${member.firstName} ${member.lastName})`
                      : `${member.firstName} ${member.lastName}`;

                    return (
                      <SelectItem
                        key={member.memberId}
                        value={member.memberId}
                        disabled={disabled}
                      >
                        {displayName}
                        {member.isCaptain && ' (C)'}
                        {disabled && ' - Already selected'}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Handicap input - readonly for points/percentage, editable for custom */}
              <Input
                type="number"
                step="0.5"
                min="0"
                value={player.handicap}
                onChange={(e) => onHandicapChange(player.position, parseFloat(e.target.value) || 0)}
                className={`w-20 h-9 text-center ${!isHandicapEditable ? 'bg-gray-50' : ''}`}
                placeholder="HC"
                readOnly={!isHandicapEditable}
                title={
                  isHandicapEditable
                    ? 'Enter handicap'
                    : calculatedHandicap !== undefined
                      ? `Calculated from game history (${handicapType} mode)`
                      : 'Select a player to calculate handicap'
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Lineups Section
 *
 * Main component for editing both team lineups.
 * Includes a collapsible "Lineup Options" section for format config.
 * Integrates with useMatchEditorState for state management.
 *
 * Auto-calculates handicaps dynamically from player game history:
 * - Points mode: Uses 3v3 format (-2 to +2 integer handicaps)
 * - Percentage mode: Uses 5v5 format (0-100% handicaps)
 * - Custom mode: Manual input allowed
 *
 * When handicap type changes, all player handicaps are recalculated.
 */
export function LineupsSection({
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  matchId,
  leagueSettings,
  editorState,
  editorActions,
}: LineupsSectionProps) {
  // Collect all selected player IDs for handicap calculation
  const allSelectedPlayerIds = [
    ...(editorState?.homeLineup.players.filter(p => p.playerId).map(p => p.playerId!) || []),
    ...(editorState?.awayLineup.players.filter(p => p.playerId).map(p => p.playerId!) || []),
  ];

  // Determine team format based on current handicap type selection
  const currentHandicapType = editorState?.formatConfig.handicapType || 'points';
  const teamFormat = getTeamFormatForHandicapType(currentHandicapType);

  // Calculate handicaps for all selected players using the usePlayerHandicaps hook
  // This calculates based on game history, not static skill levels
  const { handicaps: calculatedHandicaps, isLoading: isCalculatingHandicaps } = usePlayerHandicaps({
    playerIds: allSelectedPlayerIds,
    teamFormat,
    handicapVariant: (leagueSettings?.handicap_variant as HandicapVariant) || 'standard',
    gameType: (leagueSettings?.game_type as GameType) || 'eight_ball',
    leagueId: leagueSettings?.id,
    matchId: matchId,
  });

  /**
   * Effect to update handicaps when calculations complete or when type changes
   * This syncs the calculated handicaps back to the editor state
   */
  useEffect(() => {
    if (!editorState || !editorActions || isCalculatingHandicaps) return;
    if (currentHandicapType === 'custom') return; // Don't auto-update in custom mode

    const { homeLineup, awayLineup } = editorState;
    const { setPlayerHandicap } = editorActions;

    // Update home team handicaps
    homeLineup.players.forEach(player => {
      if (player.playerId) {
        const calculatedHandicap = calculatedHandicaps.get(player.playerId);
        if (calculatedHandicap !== undefined && calculatedHandicap !== player.handicap) {
          setPlayerHandicap('home', player.position, calculatedHandicap);
        }
      }
    });

    // Update away team handicaps
    awayLineup.players.forEach(player => {
      if (player.playerId) {
        const calculatedHandicap = calculatedHandicaps.get(player.playerId);
        if (calculatedHandicap !== undefined && calculatedHandicap !== player.handicap) {
          setPlayerHandicap('away', player.position, calculatedHandicap);
        }
      }
    });
  }, [calculatedHandicaps, isCalculatingHandicaps, currentHandicapType, editorState, editorActions]);

  // Note: Handicap type changes are now handled by SetupOptions at MatchDataPage level
  // The useEffect above will recalculate handicaps when the type changes

  /**
   * Handle player selection - add player to lineup
   * Handicap calculation happens automatically via the usePlayerHandicaps hook
   */
  const handlePlayerSelect = useCallback((
    team: 'home' | 'away',
    position: number,
    playerId: string | null,
    playerName: string,
    _member: TeamRosterMember | null
  ) => {
    if (!editorActions) return;

    const { setPlayer, setPlayerHandicap } = editorActions;

    // Set the player
    setPlayer(team, position, playerId, playerName);

    // If player was cleared, reset handicap to 0
    if (!playerId) {
      setPlayerHandicap(team, position, 0);
    }
    // Note: Handicap will be calculated and set via useEffect when calculatedHandicaps updates
  }, [editorActions]);

  // If no state hook provided, show placeholder
  if (!editorState || !editorActions) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Lineups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6">
            <div className="text-center text-gray-500">
              <p className="font-medium mb-2">Lineups Section</p>
              <p className="text-sm">State management not connected</p>
              <p className="mt-4 text-xs text-gray-400">
                Wire editorState and editorActions props to enable editing
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { formatConfig, homeLineup, awayLineup } = editorState;
  const { setPlayerHandicap } = editorActions;

  // Note: Lineup options (lineupSize, handicapType) are now managed by SetupOptions
  // component at the MatchDataPage level

  return (
    <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Lineups
          </CardTitle>
        </CardHeader>

        <CardContent>
          {/* Two-column layout for home and away teams */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Home Team */}
            <TeamLineupCard
              teamName={homeTeamName}
              teamId={homeTeamId}
              players={homeLineup.players}
              teamTotal={homeLineup.teamTotal}
              handicapType={formatConfig.handicapType}
              calculatedHandicaps={calculatedHandicaps}
              isCalculatingHandicaps={isCalculatingHandicaps}
              onPlayerSelect={(position, playerId, playerName, member) =>
                handlePlayerSelect('home', position, playerId, playerName, member)
              }
              onHandicapChange={(position, handicap) =>
                setPlayerHandicap('home', position, handicap)
              }
            />

            {/* Away Team */}
            <TeamLineupCard
              teamName={awayTeamName}
              teamId={awayTeamId}
              players={awayLineup.players}
              teamTotal={awayLineup.teamTotal}
              handicapType={formatConfig.handicapType}
              calculatedHandicaps={calculatedHandicaps}
              isCalculatingHandicaps={isCalculatingHandicaps}
              onPlayerSelect={(position, playerId, playerName, member) =>
                handlePlayerSelect('away', position, playerId, playerName, member)
              }
              onHandicapChange={(position, handicap) =>
                setPlayerHandicap('away', position, handicap)
              }
            />
          </div>
        </CardContent>
      </Card>
  );
}
