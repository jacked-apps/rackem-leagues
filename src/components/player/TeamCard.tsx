/**
 * @fileoverview TeamCard Component
 *
 * Displays a player's team with minimal information:
 * - Team name
 * - Home venue
 * - Captain
 * - Full roster of all players
 *
 * Used in the player-facing "My Teams" view.
 */

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPartialMemberNumber } from '@/types/member';
import { formatGameType, formatDayOfWeek } from '@/types/league';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { PlayerNameLink } from '@/components/PlayerNameLink';

interface Captain {
  id: string;
  first_name: string;
  last_name: string;
  system_player_number: number;
  bca_member_number: string | null;
}

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  system_player_number: number;
  bca_member_number: string | null;
}

interface Venue {
  id: string;
  name: string;
}

interface Season {
  id: string;
  season_name: string;
  league: {
    id: string;
    game_type: string;
    day_of_week: string;
    division: string | null;
  };
}

interface TeamCardProps {
  teamName: string;
  captain: Captain;
  venue: Venue | null;
  rosterSize: number;
  players: Array<{
    member_id: string;
    is_captain: boolean;
    members: Player;
  }>;
  season: Season;
  leagueId: string;
  seasonId: string;
  currentUserId?: string;
  showEditButton?: boolean;
  onEditClick?: () => void;
}

export function TeamCard({
  teamName,
  captain,
  venue,
  rosterSize,
  players,
  season,
  leagueId,
  seasonId,
  currentUserId,
  showEditButton = false,
  onEditClick
}: TeamCardProps) {
  // Calculate team readiness
  const minRoster = rosterSize === 5 ? 3 : 5; // 3/5 or 5/8
  const hasVenue = venue !== null;
  const hasMinRoster = players.length >= minRoster;
  const isReady = hasVenue && hasMinRoster;

  // Filter out captain from roster (already shown separately)
  const nonCaptainPlayers = players.filter(p => !p.is_captain);

  // Create array of all roster slots (including empty ones)
  const rosterSlots = [];

  // Add actual players (excluding captain)
  for (let i = 0; i < nonCaptainPlayers.length; i++) {
    rosterSlots.push({
      type: 'player' as const,
      player: nonCaptainPlayers[i],
      slotNumber: i + 2 // Start at 2 since captain is slot 1
    });
  }

  // Fill remaining slots with placeholders
  const remainingSlots = rosterSize - players.length; // Total - all players (including captain)
  for (let i = 0; i < remainingSlots; i++) {
    rosterSlots.push({
      type: 'empty' as const,
      slotNumber: nonCaptainPlayers.length + i + 2
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">{teamName}</CardTitle>
            <p className="text-base text-foreground dark:text-gray-300 mt-1 font-medium">
              {formatGameType(season.league.game_type as any)} • {formatDayOfWeek(season.league.day_of_week as any)}
              {season.league.division && ` • ${season.league.division}`}
            </p>
          </div>
          {showEditButton && onEditClick && (
            <button
              onClick={onEditClick}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Edit Team
            </button>
          )}
        </div>

        {/* Team Readiness Indicator */}
        {showEditButton && (
          <div className={`mt-4 p-3 rounded-lg border ${isReady ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <div className="flex items-start gap-2">
              {isReady ? (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-semibold ${isReady ? 'text-green-900' : 'text-yellow-900'}`}>
                  {isReady ? 'Team Ready for Play' : 'Team Setup Incomplete'}
                </p>
                {!isReady && (
                  <ul className="text-sm text-yellow-800 mt-1 space-y-1">
                    {!hasVenue && <li>• Home venue required</li>}
                    {!hasMinRoster && <li>• Minimum {minRoster} players required ({players.length}/{rosterSize} currently)</li>}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Home Venue */}
        <div>
          <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">Home Venue</p>
          <p className="text-base text-foreground dark:text-gray-100">{venue?.name || 'No venue assigned'}</p>
        </div>

        {/* Captain */}
        <div>
          <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">Captain</p>
          <div className={`text-base ${captain.id === currentUserId ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-foreground dark:text-gray-100'}`}>
            <PlayerNameLink
              playerId={captain.id}
              playerName={`${captain.first_name} ${captain.last_name}`}
              className={captain.id === currentUserId ? 'font-semibold' : ''}
            />{' '}
            {formatPartialMemberNumber(captain)}
          </div>
        </div>

        {/* Roster (excluding captain) */}
        <div>
          <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-2">
            Roster ({players.length}/{rosterSize})
          </p>
          <ul className="space-y-1">
            {rosterSlots.map((slot, index) => (
              <li
                key={slot.type === 'player' ? slot.player.member_id : `empty-${index}`}
                className={`text-sm ${
                  slot.type === 'player' && slot.player.member_id === currentUserId
                    ? 'font-semibold text-blue-600 dark:text-blue-400'
                    : slot.type === 'empty'
                    ? 'text-muted-foreground dark:text-muted-foreground italic'
                    : 'text-foreground dark:text-gray-100'
                }`}
              >
                {slot.type === 'player' ? (
                  <>
                    <PlayerNameLink
                      playerId={slot.player.members.id}
                      playerName={`${slot.player.members.first_name} ${slot.player.members.last_name}`}
                      className={slot.player.member_id === currentUserId ? 'font-semibold' : ''}
                    />{' '}
                    {formatPartialMemberNumber(slot.player.members)}
                  </>
                ) : (
                  `Player ${slot.slotNumber}`
                )}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>

      {/* Action Buttons */}
      <CardFooter className="flex gap-3 pt-4">
        <Link to={`/league/${leagueId}/season/${seasonId}/schedule?from=player`} className="flex-1">
          <Button variant="outline" className="w-full" loadingText="none">
            View Schedule
          </Button>
        </Link>
        <Link to="/score-match" className="flex-1">
          <Button className="w-full" loadingText="none">
            Score Match
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
