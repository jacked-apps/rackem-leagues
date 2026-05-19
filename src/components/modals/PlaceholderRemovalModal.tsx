/**
 * @fileoverview Placeholder Removal Modal
 *
 * Modal shown to captains when they click on a placeholder player in the roster editor.
 * Explains that placeholder players can only be removed by league operators and provides
 * an option to message the league operator to request removal.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageSquare, UserX } from 'lucide-react';

interface PlaceholderRemovalModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** The placeholder player's name */
  playerName: string;
  /** The team name */
  teamName: string;
  /** League ID for messaging context */
  leagueId?: string;
}

/**
 * Modal explaining placeholder player removal restrictions
 *
 * Shows when a captain tries to remove a placeholder player from their team.
 * Offers option to message the league operator to request removal.
 */
export function PlaceholderRemovalModal({
  isOpen,
  onClose,
  playerName,
  teamName,
  leagueId,
}: PlaceholderRemovalModalProps) {
  const navigate = useNavigate();
  const [navigating, setNavigating] = useState(false);

  const handleMessageOperator = () => {
    setNavigating(true);
    // Navigate to messages with context about the removal request
    // The user can compose a message to their league operator
    navigate('/messages', {
      state: {
        prefillSubject: `Request: Remove placeholder player from ${teamName}`,
        prefillMessage: `Hi,\n\nI would like to request the removal of placeholder player "${playerName}" from team "${teamName}".\n\nThank you.`,
        leagueId,
      },
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-amber-600" />
            Cannot Remove Player
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <p>
              <strong>{playerName}</strong> is an unregistered placeholder player.
            </p>
            <p>
              Placeholder players can only be removed from teams by a league operator.
              This restriction protects game history and statistics that may be associated
              with this player.
            </p>
            <p className="text-xs text-muted-foreground">
              If this player has not played any games, the league operator can remove them
              from your team.
            </p>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="default"
            loadingText="Opening messages..."
            onClick={handleMessageOperator}
            isLoading={navigating}
            className="flex items-center gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Message League Operator
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
