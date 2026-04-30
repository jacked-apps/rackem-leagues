/**
 * @fileoverview All Players Roster Card Component
 *
 * Displays a list of all players assigned to any team in the league.
 * Shows players alphabetically by last name with their player number.
 * Player names are clickable links that open a popover with actions.
 * Placeholder players show invite status badges (Invited/Expired).
 */

import React, { useMemo } from 'react';
import type { TeamWithQueryDetails } from '@/types/team';
import type { Member } from '@/types/member';
import { formatPartialMemberNumber } from '@/types/member';
import { PlayerNameLink } from '@/components/PlayerNameLink';
import { InviteStatusBadge } from '@/components/InviteStatusBadge';
import { useInviteStatuses } from '@/api/hooks';

interface AllPlayersRosterCardProps {
  /** All teams with their rosters */
  teams: TeamWithQueryDetails[];
}

interface PlayerInfo {
  memberId: string;
  firstName: string;
  lastName: string;
  playerNumber: string;
  teamName: string;
  isCaptain: boolean;
  /** True if this is a placeholder player (no user_id) */
  isPlaceholder: boolean;
}

/**
 * AllPlayersRosterCard Component
 *
 * Displays all players currently on teams, sorted alphabetically.
 * Includes:
 * - Player name
 * - Player number
 * - Team assignment indicator (captain icon)
 *
 * @example
 * <AllPlayersRosterCard teams={teams} />
 */
export const AllPlayersRosterCard: React.FC<AllPlayersRosterCardProps> = ({ teams }) => {
  /**
   * Extract all players from all teams and sort alphabetically
   */
  const players = useMemo((): PlayerInfo[] => {
    const playersMap = new Map<string, PlayerInfo>();

    teams.forEach((team) => {
      // Add captain
      if (team.captain) {
        const captain = team.captain as Member;
        playersMap.set(team.captain_id, {
          memberId: team.captain_id,
          firstName: captain.first_name,
          lastName: captain.last_name,
          playerNumber: formatPartialMemberNumber(captain),
          teamName: team.team_name,
          isCaptain: true,
          isPlaceholder: captain.user_id === null,
        });
      }

      // Add roster players
      team.team_players?.forEach((tp) => {
        if (tp.members && tp.member_id && !playersMap.has(tp.member_id)) {
          const member = tp.members as Member;
          playersMap.set(tp.member_id, {
            memberId: tp.member_id,
            firstName: member.first_name,
            lastName: member.last_name,
            playerNumber: formatPartialMemberNumber(member),
            teamName: team.team_name,
            isCaptain: tp.is_captain ?? false,
            isPlaceholder: member.user_id === null,
          });
        }
      });
    });

    // Convert to array and sort by last name, then first name
    return Array.from(playersMap.values()).sort((a, b) => {
      const lastNameCompare = a.lastName.localeCompare(b.lastName);
      if (lastNameCompare !== 0) return lastNameCompare;
      return a.firstName.localeCompare(b.firstName);
    });
  }, [teams]);

  // Get placeholder player IDs for invite status lookup
  const placeholderPlayerIds = useMemo(() => {
    return players.filter(p => p.isPlaceholder).map(p => p.memberId);
  }, [players]);

  // Fetch invite statuses for placeholder players
  const { getInviteStatus } = useInviteStatuses(placeholderPlayerIds);

  if (players.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-sm p-4">
        <h3 className="text-base font-semibold text-foreground mb-3">All Players</h3>
        <p className="text-sm text-muted-foreground">No players assigned yet</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-sm p-4">
      <h3 className="text-base font-semibold text-foreground mb-3">
        All Players ({players.length})
      </h3>
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {players.map((player) => (
          <div
            key={player.memberId}
            className="flex items-center justify-between py-1.5 px-2 hover:bg-muted rounded text-sm"
          >
            <div className="flex items-center gap-2">
              <PlayerNameLink
                playerId={player.memberId}
                playerName={`${player.lastName}, ${player.firstName}`}
              />
              {player.isCaptain && (
                <span
                  className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded cursor-help"
                  title="Captain"
                >
                  C
                </span>
              )}
              {player.isPlaceholder && (
                <>
                  <span
                    className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded cursor-help"
                    title="Unregistered"
                  >
                    U
                  </span>
                  <InviteStatusBadge status={getInviteStatus(player.memberId)} />
                </>
              )}
            </div>
            <span className="text-muted-foreground text-xs">{player.playerNumber}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
