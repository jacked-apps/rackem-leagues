/**
 * @fileoverview Lineup Change Modal Component
 *
 * Modal for initiating a lineup change request during a match.
 * Allows user to select a replacement player from their team roster.
 * Once submitted, sends a request to the opposing team for approval.
 *
 * Flow:
 * 1. User clicks "Swap Player" on a player who hasn't played yet
 * 2. This modal opens showing available replacement players
 * 3. User selects replacement and submits request
 * 4. Opponent receives notification and can approve/deny
 * 5. If approved, lineup is updated; if denied, nothing changes
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Lineup } from '@/types';

interface TeamPlayer {
  member_id: string;
  members: {
    id: string;
    first_name: string;
    last_name: string;
    nickname: string | null;
  };
}

interface LineupChangeModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Player being swapped out */
  currentPlayer: {
    id: string;
    name: string;
    position: number;
  };
  /** Current lineup to check who's already in */
  lineup: Lineup;
  /** Full team roster */
  teamRoster: TeamPlayer[];
  /** Look up a roster player's handicap for display (outgoing + each option). */
  getPlayerHandicap?: (playerId: string) => number | null;
  /** Handler when user submits the swap request */
  onSubmit: (newPlayerId: string) => void;
  /** Handler when user cancels */
  onCancel: () => void;
  /** Whether request is being submitted */
  isSubmitting?: boolean;
}

/** Format a handicap value for display ("HC 2", "HC -1", or "HC —"). */
function formatHandicap(value?: number | null): string {
  return value == null ? 'HC —' : `HC ${value}`;
}

/**
 * Get full name for a player
 */
function getFullName(player: TeamPlayer['members']): string {
  return `${player.first_name} ${player.last_name}`;
}

/**
 * Modal for selecting a replacement player for lineup change
 */
export function LineupChangeModal({
  isOpen,
  currentPlayer,
  lineup,
  teamRoster,
  getPlayerHandicap,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: LineupChangeModalProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');

  // Get IDs of players already in the lineup
  const playersInLineup = new Set([
    lineup.player1_id,
    lineup.player2_id,
    lineup.player3_id,
    lineup.player4_id,
    lineup.player5_id,
  ].filter(Boolean));

  // Filter roster to show only players NOT already in lineup
  const availablePlayers = teamRoster.filter(
    (tp) => !playersInLineup.has(tp.member_id)
  );

  const handleSubmit = () => {
    if (!selectedPlayerId) return;
    onSubmit(selectedPlayerId);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !isSubmitting) {
      onCancel();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Request Lineup Change</DialogTitle>
          <DialogDescription>
            Select a replacement player for position {currentPlayer.position}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Current player being replaced */}
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">Replacing:</p>
            <p className="font-semibold text-foreground">
              {currentPlayer.name}{' '}
              <span className="text-xs font-medium text-muted-foreground">
                ({formatHandicap(getPlayerHandicap?.(currentPlayer.id))})
              </span>
            </p>
            <p className="text-xs text-muted-foreground">Position {currentPlayer.position}</p>
          </div>

          {/* Replacement player selection */}
          <div className="space-y-2">
            <Label htmlFor="replacement-player">Select Replacement</Label>
            {availablePlayers.length === 0 ? (
              <p className="text-sm text-red-600">
                No available players on roster. All team members are already in the lineup.
              </p>
            ) : (
              <Select
                value={selectedPlayerId}
                onValueChange={setSelectedPlayerId}
              >
                <SelectTrigger id="replacement-player">
                  <SelectValue placeholder="Choose a player..." />
                </SelectTrigger>
                <SelectContent>
                  {availablePlayers.map((tp) => (
                    <SelectItem key={tp.member_id} value={tp.member_id}>
                      {getFullName(tp.members)} · {formatHandicap(getPlayerHandicap?.(tp.member_id))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Info about the request flow */}
          <p className="text-xs text-muted-foreground">
            Your opponent will need to approve this change before it takes effect.
          </p>
        </div>

        <DialogFooter className="flex flex-row justify-around gap-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={!selectedPlayerId || isSubmitting || availablePlayers.length === 0}
            isLoading={isSubmitting}
            loadingText="Requesting..."
          >
            Request Change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
