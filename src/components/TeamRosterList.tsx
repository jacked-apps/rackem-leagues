/**
 * @fileoverview Team Roster List Component
 *
 * Displays a team's roster with player names and captain badge.
 * Shows a message if no players are assigned.
 */

import React from 'react';
import { formatPartialMemberNumber, type PartialMember } from '@/types/member';
import { PlayerNameLink } from '@/components/PlayerNameLink';

interface RosterPlayer {
  member_id?: string;
  is_captain?: boolean;
  members?: PartialMember;
}

interface TeamRosterListProps {
  /** Array of roster players with member details */
  rosterPlayers: RosterPlayer[];
}

/**
 * TeamRosterList Component
 *
 * Renders a formatted list of team roster players.
 * Each player shows their name, player number, and captain badge if applicable.
 *
 * @example
 * <TeamRosterList
 *   rosterPlayers={team.team_players?.filter(tp => tp.members) || []}
 * />
 */
export const TeamRosterList: React.FC<TeamRosterListProps> = ({
  rosterPlayers,
}) => {
  if (rosterPlayers.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No players assigned</p>;
  }

  return (
    <ul className="space-y-1">
      {rosterPlayers.map((tp) => {
        const member = tp.members;
        if (!member) return null;

        return (
          <li
            key={tp.member_id}
            className="text-sm text-foreground flex items-center gap-2"
          >
            <PlayerNameLink
              playerId={tp.member_id!}
              playerName={`${member.first_name} ${member.last_name} ${formatPartialMemberNumber(member)}`}
            />
            {tp.is_captain && (
              <span className="text-xs bg-info/10 text-info px-2 py-0.5 rounded">
                Captain
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
};
