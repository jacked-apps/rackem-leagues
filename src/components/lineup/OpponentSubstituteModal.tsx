/**
 * @fileoverview Opponent Substitute Modal
 *
 * Opens when opponent has locked their lineup with a double-duty placeholder
 * (SUB_*_DD_ID). The captain picks which of the opponent's real players will
 * play in two positions; the chosen player's UUID replaces the placeholder.
 *
 * Anonymous-sub placeholders (SUB_*_ANON_ID) never trigger this modal — they
 * are the final state for that slot.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { isDoubleDutySentinel, isAnySubSentinel } from '@/utils/lineup';

interface OpponentLineupShape {
  player1_id: string | null;
  player1_handicap: number;
  player2_id: string | null;
  player2_handicap: number;
  player3_id: string | null;
  player3_handicap: number;
  player4_id: string | null;
  player4_handicap: number;
  player5_id: string | null;
  player5_handicap: number;
}

interface OpponentSubstituteModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Opponent's locked lineup with a DD placeholder in one position */
  opponentLineup: OpponentLineupShape;
  /** Number of active slots for this match's lineup_size */
  lineupSize: number;
  /** Function to get player display name from ID */
  getPlayerDisplayName: (playerId: string) => string;
  /** Handler when player is chosen — receives player ID, handicap, and the DD slot position */
  onPlayerChosen: (playerId: string, handicap: number, position: number) => void;
  /** Handler to close modal */
  onClose: () => void;
}

export function OpponentSubstituteModal({
  isOpen,
  opponentLineup,
  lineupSize,
  getPlayerDisplayName,
  onPlayerChosen,
  onClose,
}: OpponentSubstituteModalProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');

  // Find the DD placeholder position (anon sentinels never trigger this modal)
  const activeSlots = Array.from({ length: lineupSize }, (_, i) => i + 1);
  const subPosition = activeSlots.find((pos) => {
    const playerId = opponentLineup[`player${pos}_id` as keyof OpponentLineupShape];
    return typeof playerId === 'string' && isDoubleDutySentinel(playerId);
  });

  // Real players are every slot that isn't the DD placeholder and isn't empty
  const realPlayers = activeSlots
    .filter((pos) => pos !== subPosition)
    .map((pos) => ({
      position: pos,
      id: opponentLineup[`player${pos}_id` as keyof OpponentLineupShape] as string,
      handicap: opponentLineup[`player${pos}_handicap` as keyof OpponentLineupShape] as number,
    }))
    .filter((p) => p.id && !isAnySubSentinel(p.id));

  const handleConfirm = () => {
    if (!selectedPlayerId || !subPosition) return;
    const selectedPlayer = realPlayers.find((p) => p.id === selectedPlayerId);
    if (!selectedPlayer) return;
    onPlayerChosen(selectedPlayerId, selectedPlayer.handicap, subPosition);
    setSelectedPlayerId('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Opponent Used Substitute</DialogTitle>
          <DialogDescription>
            Your opponent is short a player. Choose which of their players will play in 2 positions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select player to play double duty:</label>
            <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a player..." />
              </SelectTrigger>
              <SelectContent>
                {realPlayers.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {getPlayerDisplayName(player.id)} (HC: {player.handicap})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loadingText="Confirming..." onClick={handleConfirm} disabled={!selectedPlayerId}>
            Confirm Choice
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
