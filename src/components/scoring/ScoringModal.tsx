/**
 * @fileoverview Scoring Modal Component
 *
 * Modal for selecting game winner and marking special achievements.
 * Shows Break & Run and Golden Break checkboxes based on league settings.
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ScoringModalProps {
  isOpen: boolean;
  gameNumber: number;
  winnerPlayerName: string;
  showGoldenBreak?: boolean; // League setting
  gameType?: string; // '8-ball', '9-ball', '10-ball', etc.
  onConfirm: (options: { breakAndRun: boolean; goldenBreak: boolean }) => void;
  onCancel: () => void;
}

/**
 * Modal for confirming game winner and selecting special achievements
 *
 * Features:
 * - Break & Run checkbox (always shown)
 * - Golden Break checkbox (only if league allows)
 * - Mutual exclusivity (can't have both B&R and Golden Break)
 * - Dynamic Golden Break label based on game type
 */
export function ScoringModal({
  isOpen,
  gameNumber,
  winnerPlayerName,
  showGoldenBreak = false,
  gameType = '8-ball',
  onConfirm,
  onCancel,
}: ScoringModalProps) {
  const [breakAndRun, setBreakAndRun] = useState(false);
  const [goldenBreak, setGoldenBreak] = useState(false);

  // Reset checkboxes when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setBreakAndRun(false);
      setGoldenBreak(false);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    // Check mutual exclusivity
    if (breakAndRun && goldenBreak) {
      toast.error('A game cannot have both Break & Run and Golden Break.');
      return;
    }

    onConfirm({ breakAndRun, goldenBreak });
  };

  // Determine Golden Break label based on game type
  const getGoldenBreakLabel = () => {
    if (gameType === '8-ball') return '8 on the Break';
    if (gameType === '9-ball') return '9 on the Break';
    if (gameType === '10-ball') return '10 on the Break';
    return 'Golden Break';
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Select Game Winner</DialogTitle>
          <DialogDescription>
            Select any special achievements for this game.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Game {gameNumber}</p>
            <p className="text-lg font-semibold mt-2">Winner: {winnerPlayerName}</p>
          </div>

          {/* Break & Run Checkbox (always visible) */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="breakAndRun"
              checked={breakAndRun}
              onChange={(e) => {
                setBreakAndRun(e.target.checked);
                if (e.target.checked) setGoldenBreak(false); // Uncheck golden break if B&R is checked
              }}
              className="w-4 h-4 text-blue-600 border-border rounded focus:ring-blue-500"
            />
            <label htmlFor="breakAndRun" className="text-sm font-normal cursor-pointer">
              Break & Run
            </label>
          </div>

          {/* Golden Break Checkbox (only if league allows it) */}
          {showGoldenBreak && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="goldenBreak"
                checked={goldenBreak}
                onChange={(e) => {
                  setGoldenBreak(e.target.checked);
                  if (e.target.checked) setBreakAndRun(false); // Uncheck B&R if golden break is checked
                }}
                className="w-4 h-4 text-blue-600 border-border rounded focus:ring-blue-500"
              />
              <label htmlFor="goldenBreak" className="text-sm font-normal cursor-pointer">
                {getGoldenBreakLabel()}
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} loadingText="none">
            Cancel
          </Button>
          <Button onClick={handleConfirm} loadingText="none">
            Select Winner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
