/**
 * @fileoverview TeamNameLink Component
 *
 * Reusable component that wraps team names and makes them interactive.
 * Shows a popover/modal with the team roster when clicked.
 *
 * Usage:
 * <TeamNameLink teamId="uuid" teamName="Team Name" />
 *
 * Replace regular team name displays throughout the app with this component
 * to provide consistent user interaction patterns.
 */

import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { PlayerNameLink } from './PlayerNameLink';
import { formatPartialMemberNumber } from '@/types/member';
import { useTeamRosterWithMembers } from '@/api/hooks/useTeamRosterWithMembers';

interface TeamNameLinkProps {
  teamId: string;
  teamName: string;
  className?: string;
  disablePopover?: boolean; // Use this when inside a button/interactive element
}

export function TeamNameLink({
  teamId,
  teamName,
  className,
  disablePopover = false,
}: TeamNameLinkProps) {
  const [open, setOpen] = useState(false);

  // Lazy: nothing is fetched until someone actually opens the popover, so a
  // page listing a dozen teams costs nothing until one is asked about. Cached
  // after that, because rosters do not change while a table is being read.
  const { data: players = [], isLoading } = useTeamRosterWithMembers(
    teamId,
    open && !disablePopover
  );

  // If used inside a button, just render as plain text
  if (disablePopover) {
    return (
      <span
        className={cn(
          'text-info font-medium',
          className
        )}
      >
        {teamName}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'text-info hover:text-info hover:underline cursor-pointer font-medium transition-colors',
            className
          )}
        >
          {teamName}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        {isLoading ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Loading roster...
          </div>
        ) : players.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No players on this team
          </div>
        ) : (
          <div className="space-y-1">
            {players.map((player) => (
              <div
                key={player.member_id}
                className="px-2 py-1.5 hover:bg-muted rounded transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PlayerNameLink
                      playerId={player.members.id}
                      playerName={`${player.members.first_name} ${player.members.last_name}`}
                      className="text-sm"
                    />
                    <span className="text-xs text-muted-foreground">
                      {formatPartialMemberNumber(player.members)}
                    </span>
                  </div>
                  {player.is_captain && (
                    <span className="text-xs bg-info/10 text-info px-2 py-0.5 rounded">
                      Captain
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
