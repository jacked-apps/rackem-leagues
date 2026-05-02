/**
 * @fileoverview Team Card Component
 *
 * Displays a team with collapsible roster details.
 * Shows team name, captain, roster count, and action buttons.
 */

import React from 'react';
import { Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TeamRosterList } from '@/components/TeamRosterList';
import { formatPartialMemberNumber } from '@/types/member';
import type { TeamWithQueryDetails } from '@/types/team';

interface TeamCardProps {
  /** Team data with nested details */
  team: TeamWithQueryDetails;
  /** Whether the card is expanded to show roster */
  isExpanded: boolean;
  /** Called when expand/collapse button is clicked */
  onToggleExpand: () => void;
  /** Called when edit button is clicked */
  onEdit: () => void;
  /** Called when delete button is clicked */
  onDelete: () => void;
}

/**
 * TeamCard Component
 *
 * A collapsible card displaying team information:
 * - Header: Team name, captain info, roster count, action buttons
 * - Expanded: Home venue and full roster list
 *
 * @example
 * <TeamCard
 *   team={team}
 *   isExpanded={expandedTeams.has(team.id)}
 *   onToggleExpand={() => toggleTeam(team.id)}
 *   onEdit={() => handleEdit(team)}
 *   onDelete={() => handleDelete(team.id)}
 * />
 */
export const TeamCard: React.FC<TeamCardProps> = ({
  team,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
}) => {
  const captain = team.captain;
  const rosterPlayers = team.team_players?.filter((tp) => tp.members) || [];
  const rosterCount = rosterPlayers.length;
  const captainName = captain
    ? `${captain.first_name} ${captain.last_name}`
    : 'Unknown';
  const displayNumber = captain ? formatPartialMemberNumber(captain) : '';

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Team Header */}
      <div className="p-4 flex items-start gap-3">
        <Button
          size="sm"
          variant="outline"
          onClick={onToggleExpand}
          className="shrink-0"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{team.team_name}</h3>
          <p className="text-sm text-muted-foreground">
            Captain: {captainName} {displayNumber} • Roster: {rosterCount}/
            {team.roster_size}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            loadingText="none"
            size="sm"
            onClick={onEdit}
            aria-label={`Edit ${team.team_name}`}
            data-testid="team-card-edit"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            loadingText="Deleting..."
            size="sm"
            variant="destructive"
            onClick={onDelete}
            aria-label={`Remove ${team.team_name} from season`}
            data-testid="team-card-delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border bg-muted">
          {/* Home Venue */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-foreground uppercase mb-1">
              Home Venue
            </p>
            <p className="text-sm text-foreground">
              {team.venue?.name || 'No venue assigned'}
            </p>
          </div>

          {/* Roster */}
          <div>
            <p className="text-xs font-semibold text-foreground uppercase mb-2">
              Roster
            </p>
            <TeamRosterList rosterPlayers={rosterPlayers} />
          </div>
        </div>
      )}
    </div>
  );
};
