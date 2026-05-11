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

import { useState, useEffect } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/supabaseClient';
import { PlayerNameLink } from './PlayerNameLink';
import { formatPartialMemberNumber } from '@/types/member';
import { logger } from '@/utils/logger';

interface TeamNameLinkProps {
  teamId: string;
  teamName: string;
  className?: string;
  disablePopover?: boolean; // Use this when inside a button/interactive element
}

interface TeamPlayer {
  member_id: string;
  is_captain: boolean;
  members: {
    id: string;
    first_name: string;
    last_name: string;
    system_player_number: number;
    bca_member_number: string | null;
  };
}

export function TeamNameLink({
  teamId,
  teamName,
  className,
  disablePopover = false,
}: TeamNameLinkProps) {
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState<TeamPlayer[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch team roster when popover opens
  useEffect(() => {
    async function fetchTeamRoster() {
      if (!open || disablePopover) return;

      setLoading(true);
      const { data, error } = await supabase
        .from('team_players')
        .select(`
          member_id,
          is_captain,
          members:members!team_players_member_id_fkey(
            id,
            first_name,
            last_name,
            system_player_number,
            bca_member_number
          )
        `)
        .eq('team_id', teamId)
        .order('is_captain', { ascending: false });

      if (error) {
        logger.error('Error fetching team roster', { error: error.message });
        setLoading(false);
        return;
      }

      setPlayers((data || []) as unknown as TeamPlayer[]);
      setLoading(false);
    }

    fetchTeamRoster();
  }, [teamId, open, disablePopover]);

  // If used inside a button, just render as plain text
  if (disablePopover) {
    return (
      <span
        className={cn(
          'text-blue-600 font-medium',
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
            'text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium transition-colors',
            className
          )}
        >
          {teamName}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        {loading ? (
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
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
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
